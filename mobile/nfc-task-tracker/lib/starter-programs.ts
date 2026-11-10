import type { PlanContent, Target } from "./coaching-types";

// Editable starting points. Nothing is persisted or assigned until explicit save.
export const starterPrograms = [
  {
    id: "full-body",
    name: "Başlangıç · Tüm vücut",
    goal: "Düzenli hareket",
    description: "Vücut ağırlığıyla temel hareketler · 4 egzersiz",
    exercises: [
      "lib-bodyweight-squat",
      "lib-knee-push-up",
      "lib-glute-bridge",
      "lib-knee-plank",
    ],
  },
  {
    id: "core",
    name: "Başlangıç · Core",
    goal: "Gövde kontrolü",
    description: "Gövde ve kalça odaklı · 3 egzersiz",
    exercises: ["lib-dead-bug", "lib-glute-bridge", "lib-knee-plank"],
  },
] as const;
export type StarterId = (typeof starterPrograms)[number]["id"];
export function starterTargets(id: string, uuid: () => string): Target[] {
  const preset = starterPrograms.find((p) => p.id === id);
  if (!preset) throw new Error("Hazır plan bulunamadı.");
  return preset.exercises.map((exercise_id) => ({
    id: uuid(),
    exercise_id,
    sets: 2,
    reps: exercise_id.includes("plank") ? null : 8,
    seconds: exercise_id.includes("plank") ? 15 : null,
    rest_seconds: 60,
    notes: "Hedefi seviyene göre düzenle.",
  }));
}
export function starterContent(
  id: string,
  start: string,
  timezone: string,
  uuid: () => string,
): PlanContent {
  const preset = starterPrograms.find((p) => p.id === id);
  if (!preset) throw new Error("Hazır plan bulunamadı.");
  const startMs = Date.parse(start + "T12:00:00Z");
  if (
    !Number.isFinite(startMs) ||
    new Date(startMs).toISOString().slice(0, 10) !== start
  )
    throw new Error("Geçerli başlangıç tarihi seç.");
  const dates = [0, 3].map((offset) =>
    Array.from({ length: 4 }, (_, week) =>
      new Date(startMs + (week * 7 + offset) * 86400000)
        .toISOString()
        .slice(0, 10),
    ),
  );
  return {
    name: preset.name,
    goal: preset.goal,
    difficulty: "beginner",
    start_date: start,
    weeks: 4,
    timezone,
    days: dates.map((items, i) => ({
      id: uuid(),
      name: "Antrenman " + (i + 1),
      dates: items,
      exercises: starterTargets(id, uuid),
    })),
  };
}
