import type { Workout } from "./coaching-types";
import type { MemberExerciseLog } from "./member-activity";
import { workoutProgress } from "./athlete-presentation";
import { zonedDate } from "./coaching-performance";

export function sessionProgressLabel(workout: Workout) {
  const p = workoutProgress(workout);
  return `${p.completed}/${p.total} hedef set`;
}

/** One row per session or free activity, without folding unlike units together. */
export function memberDayTimeline(
  workouts: Workout[],
  records: MemberExerciseLog[],
  date: string,
  timezone?: string,
) {
  const sessions = workouts
    .filter((w) => w.sync_state !== "rejected")
    .flatMap((w) => {
      const timestamps = [
        w.actual.finished_at,
        w.actual.started_at,
        ...w.actual.sets.map((s) => s.occurred_at),
      ]
        .filter((v): v is string => !!v && Number.isFinite(Date.parse(v)))
        .filter((v) => zonedDate(new Date(v), timezone) === date)
        .sort((a, b) => Date.parse(a) - Date.parse(b));
      const at = timestamps.at(-1);
      return at
        ? [{ id: `workout:${w.id}`, kind: "workout" as const, at, workout: w }]
        : [];
    });
  const free = records
    .filter(
      (r) =>
        r.sync_state !== "rejected" &&
        zonedDate(new Date(r.createdat), timezone) === date,
    )
    .map((record) => ({
      id: record.id,
      kind: "activity" as const,
      at: record.createdat,
      record,
    }));
  return [...sessions, ...free].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
  );
}

export function plannedCardMatches(
  data: import("./coaching-types").CoachingOverview,
  exerciseIds: string[],
  date: string,
) {
  return data.plans
    .filter((p) => p.athlete_id === data.account_id && (p.content.planning_status??"published")==="published")
    .flatMap((plan) =>
      plan.content.days
        .filter((day) => day.dates.includes(date))
        .flatMap((day) => {
          // Existing sessions are handled by the active-session route or retained as history.
          const existing = data.workouts.find(
            (w) =>
              w.plan_id === plan.id &&
              w.session_key === day.id &&
              w.scheduled_date === date,
          );
          if (
            existing &&
            (existing.sync_state === "rejected" ||
              existing.state !== "not_started")
          )
            return [];
          return day.exercises
            .filter((e) => exerciseIds.includes(e.exercise_id))
            .map((exercise) => ({ plan, day, exercise, date }));
        }),
    );
}
