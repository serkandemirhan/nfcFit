import type {
  ActualSet,
  CoachingOverview,
  Target,
  Workout,
} from "./coaching-types";
import { zonedDate } from "./coaching-performance";
import { targetSetsAchieved, sessionTimezone } from "./session-presentation";
import { workoutProgress } from "./athlete-presentation";

/** Occupied slots include skips; editing a skip must retain its original identity. */
export function setDraft(
  workout: Workout,
  target: Target,
  editing?: ActualSet,
) {
  const sets = workout.actual.sets.filter((s) => s.exercise_key === target.id);
  const previous = sets
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.set_number - a.set_number)[0];
  const number =
    editing?.set_number ??
    Array.from({ length: target.sets }, (_, i) => i + 1).find(
      (n) => !sets.some((s) => s.set_number === n),
    ) ??
    Math.max(0, ...sets.map((s) => s.set_number), target.sets) + 1;
  const result: Record<string, string> = {};
  for (const key of ["reps", "kg", "seconds", "meters"] as const) {
    const value = editing ? editing[key] : (previous?.[key] ?? target[key]);
    result[key] = value == null ? "" : String(value);
  }
  return { number, values: result };
}
export function targetCompleted(workout: Workout, target: Target) {
  return new Set(
    workout.actual.sets
      .filter(
        (s) =>
          s.exercise_key === target.id &&
          s.status === "completed" &&
          s.set_number >= 1 &&
          s.set_number <= target.sets,
      )
      .map((s) => s.set_number),
  ).size;
}
export function durationLabel(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function measurementsLabel(set: Partial<ActualSet>) {
  return [
    set.reps != null ? `${set.reps} tekrar` : "",
    set.kg != null ? `${set.kg} kg` : "",
    set.seconds != null ? `${set.seconds} sn` : "",
    set.meters != null ? `${set.meters} m` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function workoutHighlights(workout: Workout, history: Workout[]) {
  const before = workout.actual.started_at ?? workout.actual.finished_at;
  if (!before) return [];
  return [...workout.snapshot.exercises, ...workout.actual.added].flatMap(
    (target) => {
      const current = workout.actual.sets.filter(
        (s) =>
          s.exercise_key === target.id &&
          s.status === "completed" &&
          s.kg != null,
      );
      const previous = history
        .filter((w) => w.id !== workout.id && w.sync_state !== "rejected")
        .flatMap((w) => {
          const keys = [...w.snapshot.exercises, ...w.actual.added]
            .filter((t) => t.exercise_id === target.exercise_id)
            .map((t) => t.id);
          return w.actual.sets.filter(
            (s) =>
              keys.includes(s.exercise_key) &&
              s.status === "completed" &&
              s.occurred_at < before &&
              s.kg != null,
          );
        });
      if (!current.length || !previous.length) return [];
      const now = Math.max(...current.map((s) => s.kg!));
      const old = Math.max(...previous.map((s) => s.kg!));
      return now > old
        ? [
            {
              id: target.id,
              name: target.name ?? target.exercise_id,
              kg: now,
              delta: now - old,
            },
          ]
        : [];
    },
  );
}
export function memberSchedule(
  data: CoachingOverview,
  today = zonedDate(new Date(), sessionTimezone(data.timezone)),
) {
  const plans = data.plans.filter((p) => p.athlete_id === data.account_id && (p.content.planning_status??"published")==="published");
  const entries = plans.flatMap((plan) =>
    plan.content.days.flatMap((day) =>
      day.dates.map((date) => ({
        plan,
        day,
        date,
        workout: data.workouts.find(
          (w) =>
            w.plan_id === plan.id &&
            w.session_key === day.id &&
            w.scheduled_date === date,
        ),
      })),
    ),
  );
  const monday = new Date(today + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    return { date: key, sessions: entries.filter((e) => e.date === key) };
  });
  const due = entries
    .filter(
      (e) =>
        e.date < today && (!e.workout || e.workout.state === "not_started"),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const completed = days
    .flatMap((d) => d.sessions)
    .filter((e) => !!e.workout && targetSetsAchieved(e.workout)).length;
  const total = days.reduce((s, d) => s + d.sessions.length, 0);
  const active = data.workouts.some(
    (w) =>
      w.sync_state !== "rejected" &&
      ["in_progress", "paused"].includes(w.state),
  );
  return {
    days,
    missed: due[0],
    completed,
    total,
    rest: plans.length > 0 && !active && !entries.some((e) => e.date === today),
    allDone: total > 0 && total === completed,
  };
}
export function exerciseSessionSummary(workout: Workout) {
  const progress = workoutProgress(workout);
  return {
    ...progress,
    sets: workout.actual.sets.filter((s) => s.status === "completed").length,
  };
}
export function activityTrend(
  workouts: Workout[],
  range: 7 | 30 | 90,
  today: string,
  timezone?: string,
) {
  const shift = (date: string, days: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const start = shift(today, 1 - range);
  const clean = workouts.filter((w) => w.sync_state !== "rejected");
  const completed = clean
    .filter(
      (w) => ["completed", "partial"].includes(w.state) && w.actual.finished_at,
    )
    .map((w) => ({
      workout: w,
      date: zonedDate(new Date(w.actual.finished_at!), timezone),
    }))
    .filter((e) => e.date >= start && e.date <= today);
  const size = range === 7 ? 1 : range === 30 ? 7 : 30;
  const bins = Array.from({ length: Math.ceil(range / size) }, (_, i) => {
    const date = shift(start, i * size);
    const end = shift(date, size);
    return {
      date,
      end_date: shift(end, -1) > today ? today : shift(end, -1),
      count: completed.filter((e) => e.date >= date && e.date < end).length,
    };
  });
  const active = new Set(
    clean
      .flatMap((w) =>
        w.actual.sets
          .filter((s) => s.status === "completed")
          .map((s) => zonedDate(new Date(s.occurred_at), timezone)),
      )
      .filter((d) => d >= start && d <= today),
  );
  return {
    bins,
    count: completed.length,
    activeDays: active.size,
    seconds: completed.reduce(
      (sum, e) => sum + (e.workout.actual.active_seconds ?? 0),
      0,
    ),
    sets: clean
      .flatMap((w) => w.actual.sets)
      .filter(
        (s) =>
          s.status === "completed" &&
          zonedDate(new Date(s.occurred_at), timezone) >= start &&
          zonedDate(new Date(s.occurred_at), timezone) <= today,
      ).length,
  };
}
