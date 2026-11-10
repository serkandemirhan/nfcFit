import type { OfflineDatabase, SqlOps } from "./offline-store-core";
import type {
  CoachingOverview,
  Exercise,
  Plan,
  Workout,
  WorkoutCommand,
  WellnessEntry,
} from "./coaching-types";
import { reduceWorkout } from "./coaching-reducer";
export const COACHING_SCHEMA = `
CREATE TABLE IF NOT EXISTS coaching_workouts(user_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS coaching_jobs(sequence INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,id TEXT NOT NULL,workout_id TEXT,path TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',error TEXT,UNIQUE(user_id,id));
CREATE INDEX IF NOT EXISTS coaching_jobs_user_state ON coaching_jobs(user_id,state,sequence);
`;
export type CoachingJob = {
  sequence: number;
  id: string;
  workout_id: string | null;
  path: string;
  payload: string;
  state: "pending" | "rejected" | "resolved";
  error: string | null;
};
export function createCoachingStore(db: OfflineDatabase) {
  const doc = async <T>(
    tx: SqlOps,
    user: string,
    key: string,
  ): Promise<T | null> => {
    const row = await tx.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM offline_docs WHERE user_id=? AND key=?",
      user,
      key,
    );
    return row ? JSON.parse(row.payload) : null;
  };
  const put = (tx: SqlOps, user: string, key: string, value: unknown) =>
    tx.runAsync(
      "INSERT OR REPLACE INTO offline_docs(user_id,key,payload) VALUES(?,?,?)",
      user,
      key,
      JSON.stringify(value),
    );
  const workout = async (
    tx: SqlOps,
    user: string,
    id: string,
  ): Promise<Workout | null> => {
    const row = await tx.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM coaching_workouts WHERE user_id=? AND id=?",
      user,
      id,
    );
    return row ? JSON.parse(row.payload) : null;
  };
  const saveWorkout = (tx: SqlOps, user: string, w: Workout) =>
    tx.runAsync(
      "INSERT OR REPLACE INTO coaching_workouts(user_id,id,payload) VALUES(?,?,?)",
      user,
      w.id,
      JSON.stringify(w),
    );
  const enqueue = (
    tx: SqlOps,
    user: string,
    id: string,
    workoutId: string | null,
    path: string,
    payload: unknown,
  ) =>
    tx.runAsync(
      "INSERT INTO coaching_jobs(user_id,id,workout_id,path,payload,state) VALUES(?,?,?,?,?,'pending')",
      user,
      id,
      workoutId,
      path,
      JSON.stringify(payload),
    );
  async function overview(user: string): Promise<CoachingOverview | null> {
    const result = await doc<CoachingOverview>(db, user, "coaching-overview");
    if (!result) return null;
    result.workouts = (
      await db.getAllAsync<{ payload: string }>(
        "SELECT payload FROM coaching_workouts WHERE user_id=?",
        user,
      )
    ).map((r) => JSON.parse(r.payload));
    const pending = await db.getAllAsync<CoachingJob>(
      "SELECT * FROM coaching_jobs WHERE user_id=? AND state IN ('pending','rejected') AND workout_id IS NULL ORDER BY sequence",
      user,
    );
    for (const job of pending) {
      if (job.path === "/coaching/wellness/goal" && job.state === "pending")
        result.water_goal_ml = JSON.parse(job.payload).water_goal_ml;
      if (job.path === "/coaching/preferences" && job.state === "pending")
        result.timezone = JSON.parse(job.payload).timezone;
      if (job.path === "/coaching/messages") {
        const value = JSON.parse(job.payload);
        if (!result.messages.some((m) => m.id === value.id))
          result.messages.unshift({
            ...value,
            author_id: result.account_id,
            created_at: new Date().toISOString(),
            read_at: null,
            sync_state: job.state,
            sync_error: job.error,
          });
      }
      if (job.path === "/coaching/wellness") {
        const value = JSON.parse(job.payload);
        if (!result.wellness.some((w) => w.id === value.id))
          result.wellness.unshift({
            id: value.id,
            kind: value.kind,
            occurred_at: value.occurred_at,
            content: value,
            sync_state: job.state === "rejected" ? "rejected" : "pending",
            sync_error: job.error ?? undefined,
          });
      }
    }
    return result;
  }
  async function saveOverview(user: string, value: CoachingOverview) {
    await db.transaction(async (tx) => {
      await put(tx, user, "coaching-overview", value);
      const jobs = await tx.getAllAsync<CoachingJob>(
        "SELECT * FROM coaching_jobs WHERE user_id=? AND state IN ('pending','rejected')",
        user,
      );
      const protectedIds = new Set(jobs.map((j) => j.workout_id));
      for (const w of value.workouts)
        if (!protectedIds.has(w.id))
          await saveWorkout(tx, user, { ...w, sync_state: "synced" });
    });
  }
  async function createWorkout(
    user: string,
    id: string,
    plan: Plan,
    dayId: string,
    dt: string,
    library: Exercise[],
  ) {
    return db.transaction(async (tx) => {
      const current = await doc<CoachingOverview>(
        tx,
        user,
        "coaching-overview",
      );
      if (
        !current ||
        current.account_id !== plan.athlete_id ||
        !current.plans.some(
          (p) => p.id === plan.id && p.version === plan.version,
        )
      )
        throw new Error("Önce güncel programını internetten indir.");
      if (plan.tenant_id) {
        const identity = await doc<{
          memberships: {
            tenant_id: string;
            status: string;
            tenant_status?: string;
          }[];
        }>(tx, user, "identity");
        if (
          !identity?.memberships.some(
            (m) =>
              m.tenant_id === plan.tenant_id &&
              m.status === "active" &&
              m.tenant_status !== "suspended",
          )
        )
          throw new Error("Tesis üyeliğini internetten doğrula.");
      }
      const day = plan.content.days.find(
        (d) => d.id === dayId && d.dates.includes(dt),
      );
      if (!day) throw new Error("Seans programda bulunamadı.");
      const existing = (
        await tx.getAllAsync<{ payload: string }>(
          "SELECT payload FROM coaching_workouts WHERE user_id=?",
          user,
        )
      )
        .map((r) => JSON.parse(r.payload) as Workout)
        .find(
          (w) =>
            w.plan_id === plan.id &&
            w.session_key === dayId &&
            w.scheduled_date === dt,
        );
      if (existing) return existing;
      const snapshot = JSON.parse(JSON.stringify(day));
      for (const e of snapshot.exercises) {
        const entry = library.find((x) => x.id === e.exercise_id);
        e.name = entry?.name ?? e.exercise_id;
        e.measurements = entry?.measurements ?? [
          "reps",
          "kg",
          "seconds",
          "meters",
        ];
      }
      const w: Workout = {
        id,
        athlete_id: plan.athlete_id!,
        plan_id: plan.id,
        plan_version: plan.version,
        session_key: dayId,
        scheduled_date: dt,
        state: "not_started",
        version: 1,
        snapshot,
        actual: {
          sets: [],
          added: [],
          skipped: [],
          order: snapshot.exercises.map((e: { id: string }) => e.id),
          notes: "",
        },
        sync_state: "pending",
      };
      await saveWorkout(tx, user, w);
      await enqueue(tx, user, id, w.id, "/coaching/workouts", {
        id,
        plan_id: plan.id,
        plan_version: plan.version,
        session_key: dayId,
        scheduled_date: dt,
      });
      return w;
    });
  }
  async function command(user: string, id: string, c: WorkoutCommand) {
    return db.transaction(async (tx) => {
      const previous = await workout(tx, user, id);
      if (!previous) throw new Error("Antrenman telefonda bulunamadı.");
      if (previous.sync_state === "rejected")
        throw new Error("Önce eşitleme çakışmasını çöz.");
      const overview = await doc<CoachingOverview>(
        tx,
        user,
        "coaching-overview",
      );
      const plan = overview?.plans.find((p) => p.id === previous.plan_id);
      if (plan?.tenant_id) {
        const identity = await doc<{
          memberships: { tenant_id: string; status: string }[];
        }>(tx, user, "identity");
        if (
          !identity?.memberships.some(
            (m) => m.tenant_id === plan.tenant_id && m.status === "active",
          )
        )
          throw new Error(
            "Tesis üyeliğin aktif değil. Yerel kayıtların korunuyor.",
          );
      }
      const clean = {
        ...c,
        ...(c.exercise
          ? {
              exercise: Object.fromEntries(
                Object.entries(c.exercise).filter(
                  ([key]) => !["name", "measurements"].includes(key),
                ),
              ),
            }
          : {}),
      };
      const old = await tx.getFirstAsync<CoachingJob>(
        "SELECT * FROM coaching_jobs WHERE user_id=? AND id=?",
        user,
        c.request_id,
      );
      if (old) {
        if (old.workout_id !== id || old.payload !== JSON.stringify(clean))
          throw new Error("İstek kimliği çakıştı.");
        return previous;
      }
      const next = reduceWorkout(previous, c);
      await saveWorkout(tx, user, next);
      await enqueue(
        tx,
        user,
        c.request_id,
        id,
        `/coaching/workouts/${encodeURIComponent(id)}/commands`,
        clean,
      );
      return next;
    });
  }
  async function jobs(user: string) {
    return db.getAllAsync<CoachingJob>(
      "SELECT * FROM coaching_jobs WHERE user_id=? ORDER BY sequence",
      user,
    );
  }
  async function acknowledge(
    user: string,
    job: CoachingJob,
    receipt: Workout | unknown,
  ) {
    await db.transaction(async (tx) => {
      await tx.runAsync(
        "DELETE FROM coaching_jobs WHERE user_id=? AND id=?",
        user,
        job.id,
      );
      if (!job.workout_id) {
        const cached = await doc<CoachingOverview>(
          tx,
          user,
          "coaching-overview",
        );
        if (cached) {
          const value = JSON.parse(job.payload);
          if (
            job.path === "/coaching/wellness" &&
            !cached.wellness.some((w) => w.id === value.id)
          )
            cached.wellness.unshift({
              id: value.id,
              kind: value.kind,
              occurred_at: value.occurred_at,
              content: value,
            });
          if (
            job.path === "/coaching/messages" &&
            !cached.messages.some((m) => m.id === value.id)
          )
            cached.messages.unshift({
              ...value,
              author_id: cached.account_id,
              created_at: new Date().toISOString(),
              read_at: null,
            });
          if (job.path === "/coaching/wellness/goal")
            cached.water_goal_ml = value.water_goal_ml;
          if (job.path === "/coaching/preferences")
            cached.timezone = value.timezone;
          await put(tx, user, "coaching-overview", cached);
        }
      }
      if (job.workout_id) {
        const left = await tx.getFirstAsync(
          "SELECT id FROM coaching_jobs WHERE user_id=? AND workout_id=? AND state IN ('pending','rejected')",
          user,
          job.workout_id,
        );
        if (!left)
          await saveWorkout(tx, user, {
            ...(receipt as Workout),
            sync_state: "synced",
          });
      }
    });
  }
  async function reject(user: string, job: CoachingJob, error: string) {
    await db.transaction(async (tx) => {
      if (job.workout_id) {
        await tx.runAsync(
          "UPDATE coaching_jobs SET state='rejected',error=? WHERE user_id=? AND workout_id=? AND state='pending'",
          error,
          user,
          job.workout_id,
        );
        const w = await workout(tx, user, job.workout_id);
        if (w)
          await saveWorkout(tx, user, {
            ...w,
            sync_state: "rejected",
            sync_error: error,
          });
      } else
        await tx.runAsync(
          "UPDATE coaching_jobs SET state='rejected',error=? WHERE user_id=? AND id=?",
          error,
          user,
          job.id,
        );
    });
  }
  async function queueEntry(
    user: string,
    id: string,
    path:
      | "/coaching/wellness"
      | "/coaching/messages"
      | "/coaching/wellness/goal"
      | "/coaching/preferences",
    value: unknown,
  ) {
    await db.transaction(async (tx) =>
      enqueue(tx, user, id, null, path, value),
    );
  }
  return {
    archives: async (user: string) =>
      (
        await db.getAllAsync<{ key: string; payload: string }>(
          "SELECT key,payload FROM offline_docs WHERE user_id=? AND key LIKE 'coaching-conflict:%'",
          user,
        )
      ).map((r) => ({ key: r.key, workout: JSON.parse(r.payload) as Workout })),
    overview,
    async upsertPlan(user: string, plan: Plan) {
      await db.transaction(async (tx) => {
        const cached = await doc<CoachingOverview>(
          tx,
          user,
          "coaching-overview",
        );
        if (cached) {
          cached.plans = [
            ...cached.plans.filter((p) => p.id !== plan.id),
            plan,
          ];
          await put(tx, user, "coaching-overview", cached);
        }
      });
    },
    saveOverview,
    createWorkout,
    command,
    jobs,
    acknowledge,
    reject,
    queueEntry,
    workout: (user: string, id: string) => workout(db, user, id),
    library: (user: string) => doc<Exercise[]>(db, user, "coaching-library"),
    saveLibrary: (user: string, values: Exercise[]) =>
      db.transaction((tx) => put(tx, user, "coaching-library", values)),
    markSynced: (user: string) => db.transaction((tx) => put(tx, user, "coaching-last-sync", new Date().toISOString())),
    lastSync: (user: string) => doc<string>(db, user, "coaching-last-sync"),
    async resolveWithServer(user: string, id: string, server: Workout) {
      await db.transaction(async (tx) => {
        const previous = await workout(tx, user, id);
        await put(
          tx,
          user,
          "coaching-conflict:" + id + ":" + Date.now(),
          previous,
        );
        await tx.runAsync(
          "UPDATE coaching_jobs SET state='resolved' WHERE user_id=? AND workout_id=? AND state='rejected'",
          user,
          id,
        );
        if (id !== server.id)
          await tx.runAsync(
            "DELETE FROM coaching_workouts WHERE user_id=? AND id=?",
            user,
            id,
          );
        await saveWorkout(tx, user, { ...server, sync_state: "synced" });
      });
    },
    async pendingWellness(user: string): Promise<WellnessEntry[]> {
      return (await overview(user))?.wellness ?? [];
    },
  };
}
