import type {
  PlanContent,
  PlanDay,
} from "../../mobile/nfc-task-tracker/lib/coaching-types";
export const dayDate = (start: string, offset: number) => {
  const d = new Date(start + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
export function cloneWorkout(day: PlanDay, dates: string[]): PlanDay {
  return {
    ...structuredClone(day),
    id: crypto.randomUUID(),
    dates,
    exercises: day.exercises.map((e) => ({ ...e, id: crypto.randomUUID() })),
  };
}
// Detach one date before editing so recurring legacy days cannot mutate another week.
export function detachDay(
  content: PlanContent,
  id: string,
  date: string,
): { content: PlanContent; day: PlanDay } {
  const original = content.days.find((d) => d.id === id)!;
  const day =
    original.dates.length === 1
      ? structuredClone(original)
      : {
          ...structuredClone(original),
          id: crypto.randomUUID(),
          dates: [date],
        };
  return {
    day,
    content: {
      ...content,
      days: content.days.flatMap((d) =>
        d.id !== id
          ? [d]
          : d.dates.length === 1
            ? [day]
            : [{ ...d, dates: d.dates.filter((dt) => dt !== date) }, day],
      ),
    },
  };
}
export function copyWeek(
  content: PlanContent,
  source: number,
  destination: number,
): PlanContent {
  const start = dayDate(content.start_date, source * 7),
    end = dayDate(start, 7);
  const dest = dayDate(content.start_date, destination * 7),
    destEnd = dayDate(dest, 7);
  const shifted = (value: string) => dayDate(value, (destination - source) * 7);
  const copies = content.days.flatMap((d) =>
    d.dates
      .filter((dt) => dt >= start && dt < end)
      .map((dt) => cloneWorkout(d, [shifted(dt)])),
  );
  return {
    ...content,
    days: [
      ...content.days
        .map((d) => ({
          ...d,
          dates: d.dates.filter((dt) => dt < dest || dt >= destEnd),
        }))
        .filter((d) => d.dates.length),
      ...copies,
    ],
    rest_dates: [
      ...(content.rest_dates ?? []).filter((dt) => dt < dest || dt >= destEnd),
      ...(content.rest_dates ?? [])
        .filter((dt) => dt >= start && dt < end)
        .map(shifted),
    ],
  };
}

/** Count distinct configured dates; multiple workouts are still one training day. */
export function planningCoverage(content: PlanContent) {
  const training = new Set(content.days.flatMap((day) => day.dates));
  const rest = new Set(content.rest_dates ?? []);
  const weeks = Array.from({ length: content.weeks }, (_, index) => {
    const dates = Array.from({ length: 7 }, (_, day) =>
      dayDate(content.start_date, index * 7 + day),
    );
    const trainingDays = dates.filter((date) => training.has(date)).length;
    const restDays = dates.filter(
      (date) => !training.has(date) && rest.has(date),
    ).length;
    return {
      week: index + 1,
      trainingDays,
      restDays,
      unconfiguredDates: dates.filter(
        (date) => !training.has(date) && !rest.has(date),
      ),
    };
  });
  return {
    weeks,
    emptyWeeks: weeks
      .filter((week) => !week.trainingDays && !week.restDays)
      .map((week) => week.week),
    unconfiguredDates: weeks.flatMap((week) => week.unconfiguredDates),
  };
}

/** Date-only intervals mirror the existing assignment API (exclusive end). */
export function assignmentImpact(
  plans: import("../../mobile/nfc-task-tracker/lib/coaching-types").Plan[],
  start: string,
  weeks: number,
) {
  const end = dayDate(start, weeks * 7);
  return plans
    .filter(
      (plan) => (plan.content.planning_status ?? "published") === "published",
    )
    .map((plan) => ({
      id: plan.id,
      name: plan.content.name,
      start: plan.content.start_date,
      end: dayDate(plan.content.start_date, plan.content.weeks * 7 - 1),
      endExclusive: dayDate(plan.content.start_date, plan.content.weeks * 7),
      overlaps:
        plan.content.start_date < end &&
        start < dayDate(plan.content.start_date, plan.content.weeks * 7),
    }));
}

/** Prescriptions come only from the frozen snapshot, never from actual additions. */
export function recordedSetProgress(
  workout: import("../../mobile/nfc-task-tracker/lib/coaching-types").Workout,
  exerciseKey: string,
) {
  const planned =
    workout.snapshot.exercises.find((e) => e.id === exerciseKey)?.sets ?? 0;
  const completed = workout.actual.sets.filter(
    (s) => s.exercise_key === exerciseKey && s.status === "completed",
  ).length;
  return {
    planned,
    completed,
    extra: Math.max(0, completed - planned),
    achieved: planned > 0 && completed >= planned,
  };
}

export const exerciseSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .trim();
