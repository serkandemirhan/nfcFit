export type SaveOperation = "draft" | "publish" | "template";
export type SavePhase =
  "saved" | "unsaved" | "saving" | "failed" | "published" | "unpublished";

/** Presentation only: the server's persisted publication state remains authoritative. */
export function planningSaveState({
  dirty,
  published,
  operation,
  failure,
}: {
  dirty: boolean;
  published: boolean;
  operation?: SaveOperation | null;
  failure?: { operation: SaveOperation; message: string } | null;
}): { phase: SavePhase; title: string } {
  if (operation)
    return {
      phase: "saving",
      title:
        operation === "publish"
          ? "Program yayınlanıyor…"
          : operation === "template"
            ? "Antrenman şablonu kaydediliyor…"
            : "Program taslağı kaydediliyor…",
    };
  if (failure) return { phase: "failed", title: "Kaydetme başarısız" };
  if (dirty)
    return published
      ? { phase: "unpublished", title: "Yayında · Yayınlanmamış değişiklikler" }
      : { phase: "unsaved", title: "Kaydedilmemiş değişiklikler" };
  return published
    ? { phase: "published", title: "Güncel sürüm yayında" }
    : { phase: "saved", title: "Kaydedildi" };
}
