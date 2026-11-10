import type { Workout } from "./coaching-types";
export type ExercisePerformance = {
  id: string;
  name: string;
  days: {
    date: string;
    sets: number;
    reps: number | null;
    maxKg: number | null;
    volume: number | null;
    seconds: number | null;
    meters: number | null;
  }[];
};
export function exercisePerformance(
  workouts: Workout[],
  zone = "Europe/Istanbul",
): ExercisePerformance[] {
  const groups = new Map<string, ExercisePerformance>();
  const dateKey = (timestamp: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
  };
  for (const w of workouts) {
    if (w.sync_state === "rejected") continue;
    for (const s of w.actual.sets) {
      if (s.status !== "completed") continue;
      const e = [...w.snapshot.exercises, ...w.actual.added].find(
        (e) => e.id === s.exercise_key,
      );
      if (!e) continue;
      let group = groups.get(e.exercise_id);
      if (!group) {
        group = { id: e.exercise_id, name: e.name ?? e.exercise_id, days: [] };
        groups.set(e.exercise_id, group);
      }
      const date = dateKey(s.occurred_at);
      let day = group.days.find((d) => d.date === date);
      if (!day) {
        day = {
          date,
          sets: 0,
          reps: null,
          maxKg: null,
          volume: null,
          seconds: null,
          meters: null,
        };
        group.days.push(day);
      }
      day.sets++;
      if (s.reps != null) day.reps = (day.reps ?? 0) + s.reps;
      if (s.kg != null) day.maxKg = Math.max(day.maxKg ?? 0, s.kg);
      if (s.kg != null && s.reps != null)
        day.volume = (day.volume ?? 0) + s.kg * s.reps;
      if (s.seconds != null) day.seconds = (day.seconds ?? 0) + s.seconds;
      if (s.meters != null) day.meters = (day.meters ?? 0) + s.meters;
    }
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      days: g.days.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

/** Calendar day in the account's zone, independent of the device's zone. */
export function zonedDate(
  timestamp = new Date(),
  zone = "Europe/Istanbul",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function lastFinishedMonday(zone = "Europe/Istanbul"): string {
  const day = new Date(zonedDate(new Date(), zone) + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) - 7);
  return day.toISOString().slice(0, 10);
}
