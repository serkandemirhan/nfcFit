import type { Exercise } from "./coaching-types";
export type ExerciseAsset = Exercise["media"][number];
export function imageFrames(exercise: Exercise): ExerciseAsset[] {
  return (exercise.media ?? []).filter((m) => m.media_type === "image" && m.role !== "thumbnail" && m.url.startsWith("https://"));
}
export function thumbnail(exercise: Exercise): ExerciseAsset | undefined {
  const safe = (exercise.media ?? []).filter((m) => m.media_type === "image" && m.url.startsWith("https://"));
  return safe.find((m) => m.role === "thumbnail") ?? safe[0];
}
export function positionLabel(asset: ExerciseAsset, index: number): string {
  return asset.role === "pose" ? "Sabit duruş" : `Pozisyon ${index + 1}`;
}
