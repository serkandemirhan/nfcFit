import type {
  CoachingOverview,
  Exercise,
  Plan,
  PlanDay,
  Workout,
} from "./coaching-types";
import { zonedDate } from "./coaching-performance";
import { workoutProgress } from "./athlete-presentation";

export const fullWeekdays = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
export function sessionTimezone(preferred?: string) {
  return preferred || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function calendarLabel(date: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
export function weekdayLabel(date: string) {
  return fullWeekdays[(new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7];
}
/** Display only: never rename a stored snapshot or infer targets from a newer plan. */
export function sessionDisplayName(
  day: PlanDay,
  date: string,
  library: Exercise[] | null = [],
) {
  const weekday = weekdayLabel(date);
  const name = day.name.trim();
  const weekdayPrefix =
    /^(?:pzt|pazartesi|salı|sal|çarşamba|çar|perşembe|per|cuma|cum|cumartesi|cmt|pazar|paz)(?:\s*[·–—-]\s*|$)/i;
  const specific = name.replace(weekdayPrefix, "").trim();
  if (specific && !/^(antrenman|workout|day|gün)$/i.test(specific))
    return `${weekday} · ${specific}`;
  const muscles = day.exercises.map((target) => {
    const entry = library?.find((e) => e.id === target.exercise_id);
    if (entry) return entry.muscle;
    const text = `${target.name ?? ""} ${target.exercise_id}`.toLocaleLowerCase(
      "tr-TR",
    );
    if (/squat|lunge|bridge|köprü|kalça/.test(text)) return "legs";
    if (/plank|crunch|core/.test(text)) return "core";
    if (/push.?up|şınav|press|row|pull/.test(text)) return "chest";
    return "other";
  });
  const upper = muscles.some((m) =>
    ["chest", "back", "shoulders", "biceps", "triceps", "arms"].includes(m),
  );
  const lower = muscles.some((m) =>
    ["legs", "quadriceps", "hamstrings", "glutes", "calves"].includes(m),
  );
  const known = muscles.filter((m) => m !== "other");
  const type =
    muscles.includes("full_body") || (upper && lower)
      ? "Tüm Vücut"
      : upper
        ? "Üst Vücut"
        : lower
          ? "Alt Vücut"
          : known.length && known.every((m) => ["core", "abs"].includes(m))
            ? "Core"
            : known.length && known.every((m) => m === "cardio")
              ? "Kardiyo"
              : "Antrenman";
  return `${weekday} · ${type}`;
}
export function actualSessionDate(workout: Workout, timezone?: string) {
  const valid = (value?: string) =>
    !!value && Number.isFinite(Date.parse(value));
  // A real finish timestamp is authoritative, including a cross-midnight session.
  const timestamp = valid(workout.actual.finished_at)
    ? workout.actual.finished_at
    : [
        ...workout.actual.sets
          .filter((s) => s.status === "completed")
          .map((s) => s.occurred_at),
        workout.actual.started_at,
      ]
        .filter((s): s is string => valid(s))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return timestamp
    ? zonedDate(new Date(timestamp), sessionTimezone(timezone))
    : null;
}
export function targetSetsAchieved(workout: Workout) {
  const p = workoutProgress(workout);
  return (
    workout.sync_state !== "rejected" &&
    workout.state === "completed" &&
    p.total > 0 &&
    p.completed === p.total
  );
}
export type SessionEntry = {
  plan?: Plan;
  day: PlanDay;
  date: string;
  workout?: Workout;
};
export function sessionEntries(data: CoachingOverview): SessionEntry[] {
  const athlete = data.athlete_id || data.account_id;
  const workouts = data.workouts.filter((w) => w.athlete_id === athlete);
  const entries: SessionEntry[] = data.plans
    .filter((p) => p.athlete_id === athlete)
    .flatMap((plan) =>
      plan.content.days.flatMap((day) =>
        day.dates.map((date) => {
          const workout = workouts.find(
            (w) =>
              w.plan_id === plan.id &&
              w.session_key === day.id &&
              w.scheduled_date === date,
          );
          return { plan, day: workout?.snapshot ?? day, date, workout };
        }),
      ),
    );
  // Keep immutable sessions even when their original plan/day is no longer in the current definition.
  for (const workout of workouts)
    if (!entries.some((e) => e.workout?.id === workout.id)) {
      entries.push({
        plan: data.plans.find((p) => p.id === workout.plan_id),
        day: workout.snapshot,
        date: workout.scheduled_date,
        workout,
      });
    }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
export function sessionRelation(date: string, today: string) {
  return date < today ? "past" : date > today ? "upcoming" : "today";
}
export function isMissedSession(entry: SessionEntry, today: string) {
  return (
    entry.date < today &&
    (!entry.workout ||
      (entry.workout.state === "not_started" &&
        entry.workout.sync_state !== "rejected"))
  );
}
export function sessionContext(
  entry: SessionEntry,
  today: string,
  timezone?: string,
) {
  const actual = entry.workout
    ? actualSessionDate(entry.workout, timezone)
    : null;
  const planned = `${sessionRelation(entry.date, today) === "today" ? "Bugün planlanan" : entry.date > today ? "Gelecek seans" : "Geçmiş plan"} · ${calendarLabel(entry.date)}`;
  if (!actual)
    return (
      planned +
      (entry.workout && ["completed", "partial"].includes(entry.workout.state)
        ? " · Gerçekleşme tarihi kayıtlı değil"
        : "")
    );
  return `${actual === today ? "Bugün yapılan" : "Yapılan"} · ${calendarLabel(actual)}${entry.date !== actual ? ` · Planlanan: ${calendarLabel(entry.date)}` : ""}`;
}
export function todaySessions(data: CoachingOverview, now = new Date()) {
  const timezone = sessionTimezone(data.timezone);
  const today = zonedDate(now, timezone);
  const entries = sessionEntries(data);
  const valid = entries.filter((e) => e.workout?.sync_state !== "rejected");
  const results = valid
    .filter(
      (e) =>
        e.workout &&
        ["completed", "partial"].includes(e.workout.state) &&
        actualSessionDate(e.workout, timezone) === today,
    )
    .sort(
      (a, b) =>
        Date.parse(b.workout!.actual.finished_at ?? "") -
        Date.parse(a.workout!.actual.finished_at ?? ""),
    );
  const activeToday = valid.find(
    (e) =>
      e.workout &&
      ["in_progress", "paused"].includes(e.workout.state) &&
      (e.date === today || actualSessionDate(e.workout, timezone) === today),
  );
  const scheduledToday = entries.filter((e) => e.date === today);
  const primary =
    activeToday ??
    results[0] ??
    scheduledToday.find(
      (e) => e.workout && ["completed", "partial"].includes(e.workout.state),
    ) ??
    scheduledToday[0];
  const upcoming = valid.find(
    (e) =>
      e !== primary &&
      e.date > today &&
      (!e.workout ||
        ["not_started", "in_progress", "paused"].includes(e.workout.state)),
  );
  const previousActive = valid.find(
    (e) =>
      e !== primary &&
      e.date < today &&
      e.workout &&
      ["in_progress", "paused"].includes(e.workout.state),
  );
  return {
    today,
    timezone,
    primary,
    results,
    scheduledToday,
    upcoming,
    previousActive,
    missed: valid.filter((e) => isMissedSession(e, today)),
  };
}
export function sessionPeriodSummary(
  data: CoachingOverview,
  start: string,
  end: string,
  today: string,
  timezone?: string,
) {
  const entries = sessionEntries(data);
  const performed = entries.filter((e) => {
    const actual =
      e.workout && e.workout.sync_state !== "rejected"
        ? actualSessionDate(e.workout, timezone ?? data.timezone)
        : null;
    return actual && actual >= start && actual <= end;
  });
  return {
    completed: performed.filter((e) => e.workout?.state === "completed").length,
    partial: performed.filter((e) => e.workout?.state === "partial").length,
    missed: entries.filter(
      (e) => e.date >= start && e.date <= end && isMissedSession(e, today),
    ).length,
    skipped: entries.filter(
      (e) =>
        e.date >= start &&
        e.date <= end &&
        e.workout?.state === "skipped" &&
        e.workout.sync_state !== "rejected",
    ).length,
  };
}

export function planSessionProgress(plan: Plan, workouts: Workout[]) {
  const entries = plan.content.days.flatMap((day) =>
    day.dates.map((date) => ({ day, date })),
  );
  const achieved = entries.filter((e) =>
    workouts.some(
      (w) =>
        w.plan_id === plan.id &&
        w.session_key === e.day.id &&
        w.scheduled_date === e.date &&
        targetSetsAchieved(w),
    ),
  ).length;
  return {
    achieved,
    total: entries.length,
    complete: entries.length > 0 && achieved === entries.length,
  };
}

export function sessionGoalContext(
  entry: SessionEntry,
  today: string,
  timezone?: string,
) {
  const actual = entry.workout
    ? actualSessionDate(entry.workout, timezone)
    : null;
  const ended =
    entry.workout && ["completed", "partial"].includes(entry.workout.state);
  return {
    label:
      actual === today
        ? ended
          ? "Bugünün gerçekleşen sonucu"
          : "Bugünün seans hedefi"
        : entry.date === today
          ? "Bugün planlanan seans"
          : entry.date > today
            ? "Sıradaki antrenman"
            : "Geçmiş seans hedefi",
    date: actual === today ? actual : entry.date,
    detail:
      (actual && actual !== entry.date) || (ended && !actual)
        ? sessionContext(entry, today, timezone)
        : null,
  };
}
