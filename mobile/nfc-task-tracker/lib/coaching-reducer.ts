import {
  terminalStates,
  type Workout,
  type WorkoutCommand,
} from "./coaching-types";
export function reduceWorkout(
  previous: Workout,
  command: WorkoutCommand,
): Workout {
  if (terminalStates.has(previous.state))
    throw new Error("Tamamlanmış antrenman değiştirilemez.");
  if (previous.version !== command.expected_version)
    throw new Error("Antrenman değişti. Yeniden aç.");
  const next: Workout = JSON.parse(JSON.stringify(previous));
  const a = next.actual;
  const c = command;
  const at = c.occurred_at ?? new Date().toISOString();
  const stopClock = () => {
    if (a.active_since) {
      const elapsed =
        (new Date(at).getTime() - new Date(a.active_since).getTime()) / 1000;
      if (elapsed < 0) throw new Error("Telefon saati geriye alınmış.");
      a.active_seconds = (a.active_seconds ?? 0) + elapsed;
      a.active_since = null;
    }
  };

  const requireState = (state: Workout["state"]) => {
    if (next.state !== state)
      throw new Error("Bu işlem için antrenman durumu uygun değil.");
  };
  if (c.action === "start") {
    requireState("not_started");
    next.state = "in_progress";
    a.started_at = at;
    a.active_since = at;
    a.active_seconds = 0;
  } else if (c.action === "pause") {
    requireState("in_progress");
    stopClock();
    next.state = "paused";
  } else if (c.action === "resume") {
    requireState("paused");
    next.state = "in_progress";
    a.active_since = at;
  } else if (c.action === "skip" || c.action === "cancel") {
    next.state = c.action === "skip" ? "skipped" : "cancelled";
    stopClock();
    a.finished_at = at;
  } else {
    requireState("in_progress");
    const exercises = [...next.snapshot.exercises, ...a.added];
    if (c.action === "set") {
      const s = c.actual_set;
      const e = exercises.find((e) => e.id === s?.exercise_key);
      if (!s || !e) throw new Error("Set egzersizi bulunamadı.");
      if (
        !Number.isInteger(s.set_number) ||
        s.set_number < 1 ||
        s.set_number > 100
      )
        throw new Error("Set numarası 1–100 olmalı.");
      for (const key of ["reps", "kg", "seconds", "meters"] as const) {
        const value = s[key];
        if (
          value != null &&
          (!Number.isFinite(value) ||
            value < 0 ||
            !e.measurements?.includes(key))
        )
          throw new Error("Ölçüm türü veya miktarı geçersiz.");
      }
      if (s.reps != null && !Number.isInteger(s.reps))
        throw new Error("Tekrar tam sayı olmalı.");
      if (
        s.status === "completed" &&
        s.reps == null &&
        s.seconds == null &&
        s.meters == null
      )
        throw new Error("Gerçekleşen tekrar, süre veya mesafe gerekli.");
      const old = a.sets.find((x) => x.id === s.id);
      if (
        old &&
        (old.exercise_key !== s.exercise_key || old.set_number !== s.set_number)
      )
        throw new Error("Set kimliği taşınamaz.");
      if (
        a.sets.some(
          (x) =>
            x.id !== s.id &&
            x.exercise_key === s.exercise_key &&
            x.set_number === s.set_number,
        )
      )
        throw new Error("Set zaten var. Düzenlemeyi seç.");
      a.sets = [...a.sets.filter((x) => x.id !== s.id), s];
    } else if (c.action === "skip_exercise") {
      if (!exercises.some((e) => e.id === c.exercise_key))
        throw new Error("Egzersiz bulunamadı.");
      a.skipped = [...new Set([...a.skipped, c.exercise_key!])];
    } else if (c.action === "add_exercise") {
      if (!c.exercise || exercises.some((e) => e.id === c.exercise!.id))
        throw new Error("Egzersiz kimliği geçersiz.");
      a.added.push(c.exercise);
      a.order.push(c.exercise.id);
    } else if (c.action === "reorder") {
      if (
        !c.order ||
        c.order.length !== exercises.length ||
        new Set(c.order).size !== exercises.length ||
        c.order.some((id) => !exercises.some((e) => e.id === id))
      )
        throw new Error("Her egzersiz sıralamada bir kez bulunmalı.");
      a.order = c.order;
    } else if (c.action === "note") {
      a.notes = c.notes ?? "";
    } else if (c.action === "finish") {
      const complete = next.snapshot.exercises.every(
        (e) =>
          a.sets.filter(
            (s) => s.exercise_key === e.id && s.status === "completed",
          ).length >= e.sets && !a.skipped.includes(e.id),
      );
      if (!complete && !c.partial)
        throw new Error("Eksik set var. Kısmi tamamlamayı seç.");
      next.state = complete ? "completed" : "partial";
      stopClock();
      a.finished_at = at;
    }
  }
  next.version++;
  next.sync_state = "pending";
  return next;
}
