import { readableSyncError } from "./console-transport";
import { createCoachingStore } from "./coaching-store-core";
import { offlineDatabase, offlineStore, localUuid } from "./offline-store";
import { coachingRequest, ConsoleApiError } from "./tenant-console";
import { hasConnection, offlineChanged } from "./offline-sync";
import type { CoachingOverview, Exercise, Workout } from "./coaching-types";
export const coachingStore = createCoachingStore(offlineDatabase);
const flights = new Map<string, Promise<void>>();
export function syncCoaching(user: string): Promise<void> {
  const old = flights.get(user);
  if (old) return old;
  const lock = "coaching:" + user;
  const owner = localUuid();
  let acquired = false;
  const task = (async () => {
    if (!(await hasConnection())) return;
    acquired = await offlineStore.acquireSync(lock, owner);
    if (!acquired) return;
    const lease = async () => {
      if (!(await offlineStore.renewSync(lock, owner)))
        throw new Error("Antrenman eşitlemesi başka işleme geçti.");
    };
    try {
      const jobs = await coachingStore.jobs(user);
      const blocked = new Set<string>();
      for (const job of jobs) {
        if (
          job.state !== "pending" ||
          (job.workout_id && blocked.has(job.workout_id))
        )
          continue;
        try {
          const receipt = await coachingRequest<Workout>(
            user,
            job.path.replace(/^\/coaching/, ""),
            JSON.parse(job.payload),
          );
          await lease();
          if (job.workout_id && receipt.id !== job.workout_id)
            throw new ConsoleApiError(
              "Bu seans başka cihazda başlatılmış. Yerel setlerin korundu; sunucudaki antrenmanla uzlaştır.",
              409,
            );
          await coachingStore.acknowledge(user, job, receipt);
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (
            status &&
            status >= 400 &&
            status < 500 &&
            ![401, 408, 429].includes(status)
          ) {
            await coachingStore.reject(
              user,
              job,
              error instanceof Error ? error.message : "Kayıt uzlaştırılamadı.",
            );
            if (job.workout_id) blocked.add(job.workout_id);
          } else throw error;
        }
      }
      const overview = await coachingRequest<CoachingOverview>(
        user,
        "/overview",
      );
      await lease();
      await coachingStore.saveOverview(user, overview);
      const libraryStamp = await offlineStore.getDoc<number>(
        user,
        "coaching-library-at",
      );
      if (
        !libraryStamp ||
        Date.now() - libraryStamp > 15 * 60_000 ||
        !(await coachingStore.library(user))
      ) {
        const library = await coachingRequest<Exercise[]>(user, "/library");
        await lease();
        await coachingStore.saveLibrary(user, library);
        await offlineStore.putDoc(user, "coaching-library-at", Date.now());
      }
      await offlineStore.putDoc(user, "coaching-error", null);
      // Report success only after the entire worker, including the library pull, succeeds.
      await coachingStore.markSynced(user);
    } catch (error) {
      await offlineStore.putDoc(
        user,
        "coaching-error",
        readableSyncError(error),
      );
      throw error;
    } finally {
      offlineChanged(user);
    }
  })().finally(async () => {
    try {
      if (acquired) await offlineStore.releaseSync(lock, owner);
    } finally {
      flights.delete(user);
    }
  });
  flights.set(user, task);
  return task;
}
export async function loadCoachingOverview(user: string, athlete?: string) {
  if (athlete)
    return coachingRequest<CoachingOverview>(
      user,
      `/overview?athlete_id=${encodeURIComponent(athlete)}`,
    );
  const cached = await coachingStore.overview(user);
  if (cached) return cached;
  await syncCoaching(user);
  return coachingStore.overview(user);
}
export async function resolveWorkoutConflict(user: string, id: string) {
  if (!(await hasConnection()))
    throw new Error("Uzlaştırmak için internet bağlantısı gerekli.");
  const remote = await coachingRequest<CoachingOverview>(user, "/overview");
  const local = await coachingStore.workout(user, id);
  const server =
    remote.workouts.find((w) => w.id === id) ||
    remote.workouts.find(
      (w) =>
        local &&
        w.plan_id === local.plan_id &&
        w.session_key === local.session_key &&
        w.scheduled_date === local.scheduled_date,
    );
  if (!server)
    throw new Error(
      "Sunucuda eşleşen antrenman yok. Yerel kaydın korunuyor; programı antrenörünle kontrol et.",
    );
  await coachingStore.resolveWithServer(user, id, server);
  offlineChanged(user);
  return server;
}
