import type { CoachingOverview, Workout } from "./coaching-types";
import { zonedDate } from "./coaching-performance";

export function workoutProgress(workout: Workout) {
  // Extra movements contribute actual activity, but never change program targets.
  const targets = workout.snapshot.exercises;
  let completed = 0;
  let exercises = 0;
  const total = targets.reduce((sum, target) => sum + target.sets, 0);
  for (const target of targets) {
    const slots = new Set(
      workout.actual.sets
        .filter(
          (s) =>
            s.exercise_key === target.id &&
            s.status === "completed" &&
            s.set_number >= 1 &&
            s.set_number <= target.sets,
        )
        .map((s) => s.set_number),
    );
    completed += slots.size;
    if (slots.size >= target.sets) exercises++;
  }
  return {
    completed,
    total,
    ratio: total ? completed / total : 0,
    exercises,
    exerciseCount: targets.length,
  };
}
export function nextWorkout(
  data: CoachingOverview,
  date = zonedDate(new Date(), data.timezone),
) {
  const own = data.plans.filter((p) => p.athlete_id === data.account_id && (p.content.planning_status??"published")==="published");
  const active = data.workouts.find(
    (w) =>
      w.sync_state !== "rejected" &&
      ["in_progress", "paused"].includes(w.state),
  );
  const sessions = own
    .flatMap((plan) =>
      plan.content.days.flatMap((day) =>
        day.dates.map((date) => ({ plan, day, date })),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = sessions.find(
    (s) =>
      s.date >= date &&
      !data.workouts.some(
        (w) =>
          w.plan_id === s.plan.id &&
          w.session_key === s.day.id &&
          w.scheduled_date === s.date &&
          ["completed", "partial", "skipped", "cancelled"].includes(w.state),
      ),
  );
  return { active, next, own };
}
export function wellnessToday(
  data: CoachingOverview,
  date = zonedDate(new Date(), data.timezone),
) {
  const entries = data.wellness.filter(
    (w) =>
      w.sync_state !== "rejected" &&
      zonedDate(new Date(w.occurred_at), data.timezone) === date,
  );
  const lastFeeling = entries
    .filter((w) => w.kind === "wellbeing")
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  return {
    waterMl: entries
      .filter((w) => w.kind === "water")
      .reduce((s, w) => s + (w.content.amount ?? 0), 0),
    coffeeCount: entries.filter((w) => w.kind === "coffee").length,
    sleepMinutes: entries
      .filter((w) => w.kind === "sleep")
      .reduce((s, w) => s + (w.content.amount ?? 0), 0),
    mood: lastFeeling?.content.mood ?? null,
    waterGoal: data.water_goal_ml ?? 2000,
  };
}
export const muscleLabels: Record<string, string> = {
  chest: "Göğüs",
  back: "Sırt",
  shoulders: "Omuz",
  biceps: "Biceps",
  triceps: "Triceps",
  legs: "Bacak",
  quadriceps: "Ön bacak",
  hamstrings: "Arka bacak",
  glutes: "Kalça",
  calves: "Baldır",
  core: "Core",
  abs: "Karın",
  cardio: "Kardiyo",
  full_body: "Tüm vücut",
  other: "Diğer",
  mobility: "Mobilite",
  arms: "Kol",
};
export const equipmentLabels: Record<string, string> = {
  barbell: "Bar",
  dumbbell: "Dumbbell",
  bodyweight: "Vücut ağırlığı",
  machine: "Makine",
  cable: "Kablo",
  kettlebell: "Kettlebell",
  band: "Direnç bandı",
  none: "Ekipmansız",
  bench: "Sehpa",
  bike: "Bisiklet",
  elliptical: "Eliptik",
  rower: "Kürek",
  treadmill: "Koşu bandı",
};
export const difficultyLabels: Record<string, string> = {
  beginner: "Başlangıç",
  intermediate: "Orta",
  advanced: "İleri",
};

/** Recorded clock plus the currently running segment; never adds paused time. */
export function workoutElapsedSeconds(workout: Workout, at = Date.now()) {
  const recorded = workout.actual.active_seconds ?? 0;
  if (workout.state !== "in_progress" || !workout.actual.active_since)
    return recorded;
  const elapsed = (at - Date.parse(workout.actual.active_since)) / 1000;
  return recorded + (Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0);
}
