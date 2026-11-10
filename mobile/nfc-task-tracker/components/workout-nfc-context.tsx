import { CoachText as Text } from "@/components/coaching-ui";
import { FitButton, FitCard, f, fit } from "@/components/fitness-ui";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
import { zonedDate } from "@/lib/coaching-performance";
import { plannedCardMatches } from "@/lib/member-experience";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
export function useWorkoutNfcContext(tagId?: string) {
  const query = useCoaching();
  const equipment = query.data?.equipment?.find(
    (e) => e.tag_id === tagId && e.active,
  );
  const matches = equipment
    ? (query.data?.workouts ?? [])
        .filter(
          (w) =>
            w.sync_state !== "rejected" &&
            ["in_progress", "paused"].includes(w.state),
        )
        .flatMap((workout) =>
          [...workout.snapshot.exercises, ...workout.actual.added]
            .filter((e) => equipment.exercise_ids.includes(e.exercise_id))
            .map((exercise) => ({ workout, exercise })),
        )
    : [];
  const planned =
    equipment && query.data
      ? plannedCardMatches(
          query.data,
          equipment.exercise_ids,
          zonedDate(new Date(), query.data.timezone),
        )
      : [];
  return { equipment, matches, planned };
}
export function WorkoutNfcContext({
  context,
}: {
  context: ReturnType<typeof useWorkoutNfcContext>;
}) {
  const { user } = useAuth();
  const library = useCoachingLibrary();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async (entry: (typeof context.planned)[number]) => {
    if (!user || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const workout = await coachingStore.createWorkout(
        user.id,
        localUuid(),
        entry.plan,
        entry.day.id,
        entry.date,
        library.data ?? [],
      );
      offlineChanged(user.id);
      void syncCoaching(user.id).catch(() => undefined);
      router.push(
        `/workout/${workout.id}?exercise=${entry.exercise.id}&method=nfc` as never,
      );
    } catch {
      setError("Antrenman açılamadı. Kart için henüz set kaydedilmedi.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!context.equipment) return null;
  return (
    <FitCard accent>
      <Ionicons name="checkmark-circle-outline" size={44} color={fit.lime} />
      <Text style={f.sectionTitle}>Egzersiz tanındı</Text>
      <Text style={f.body}>{context.equipment.name}</Text>
      <Text style={f.muted}>
        Kart tanındı; henüz set kaydedilmedi. Egzersizi seçip gerçekleşen
        değerleri onayla.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: fit.orange }}>
          {error}
        </Text>
      )}
      {context.planned.map((entry) => (
        <FitButton
          key={entry.plan.id + entry.day.id + entry.exercise.id}
          title={
            busy
              ? "Antrenman açılıyor…"
              : `${entry.exercise.name ?? library.data?.find((e) => e.id === entry.exercise.exercise_id)?.name ?? context.equipment!.name} · Bugünkü plan`
          }
          disabled={busy}
          onPress={() => void open(entry)}
        />
      ))}
      {context.matches.length ? (
        context.matches.map(({ workout, exercise }) => (
          <FitButton
            key={workout.id + exercise.id}
            title={`${exercise.name ?? exercise.exercise_id} · ${workout.snapshot.name}`}
            icon="barbell-outline"
            onPress={() =>
              router.push(
                `/workout/${workout.id}?exercise=${exercise.id}&method=nfc` as never,
              )
            }
          />
        ))
      ) : !context.planned.length ? (
        <>
          <Text style={f.muted}>
            Bu kart için devam eden veya bugün planlanan bir egzersiz
            bulunamadı. Günlük egzersiz olarak kaydetmek program hedef setlerini
            değiştirmez.
          </Text>
          <FitButton
            title="Programımı aç / elle seç"
            secondary
            onPress={() => router.push("/(drawer)/plans" as never)}
          />
        </>
      ) : null}
    </FitCard>
  );
}
