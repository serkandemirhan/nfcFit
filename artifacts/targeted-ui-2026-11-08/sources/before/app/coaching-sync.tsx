import { readableSyncError } from "@/lib/console-transport";
import { coachingJobKeys } from "@/lib/coaching-query-keys";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachShell,
  coachStyle,
} from "@/components/coaching-ui";
import { useState } from "react";
import { Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { offlineStore } from "@/lib/offline-store";
export default function CoachingSync() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: coachingJobKeys.details(user?.id),
    queryFn: async () => ({
      jobs: await coachingStore.jobs(user!.id),
      archives: await coachingStore.archives(user!.id),
      error: await offlineStore.getDoc<string>(user!.id, "coaching-error"),
      last: await coachingStore.lastSync(user!.id),
    }),
    enabled: !!user?.id,
    networkMode: "always",
  });
  const data = query.data;
  return (
    <CoachShell title="Antrenman eşitlemesi">
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {data?.error && <Text style={coachStyle.error}>{readableSyncError(data.error)}</Text>}
      <Text style={coachStyle.muted}>
        Son başarılı eşitleme:{" "}
        {data?.last ? new Date(data.last).toLocaleString("tr-TR") : "Henüz yok"}
      </Text>
      <CoachButton
        title={busy ? "Eşitleniyor…" : "Şimdi eşitle"}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          void syncCoaching(user!.id)
            .then(() => query.refetch())
            .catch((e) => setError(readableSyncError(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Text style={coachStyle.muted}>
        Gönderim hataları güvenli biçimde tekrar denenir. Program/üyelik
        çakışmaları otomatik olarak üzerine yazılmaz. Çakışan kayıtları
        paylaşabilir ve antrenörünle uzlaştırabilirsin.
      </Text>
      {query.isPending && <Text style={coachStyle.muted}>Telefondaki kayıtlar kontrol ediliyor…</Text>}
      {query.error && <Text accessibilityRole="alert" style={coachStyle.error}>{readableSyncError(query.error)}</Text>}
      {data && !data.jobs.length && (
        <Text style={coachStyle.text}>Bekleyen kayıt yok.</Text>
      )}
      {data?.jobs.map((j) => {
        const value = JSON.parse(j.payload);
        return (
          <CoachCard
            key={j.id}
            title={
              j.path.includes("messages")
                ? "Mesaj"
                : j.path.includes("wellness")
                  ? "İyi yaşam"
                  : ({start:"Antrenman başlangıcı",pause:"Antrenman duraklatma",resume:"Antrenmana devam",finish:"Antrenman bitirme",set:"Set kaydı",record_set:"Set kaydı"}[value.action as string] ?? "Antrenman kaydı")
            }
          >
            <Text style={coachStyle.text}>
              {j.state === "pending"
                ? "Eşitleme bekliyor"
                : j.state === "rejected"
                  ? "İnceleme gerekli"
                  : "Arşivlendi / sunucu sürümü kullanılıyor"}
            </Text>
            {j.error && <Text style={coachStyle.error}>{j.error}</Text>}
            {value.actual_set && (
              <Text style={coachStyle.muted}>
                Set {value.actual_set.set_number} ·{" "}
                {value.actual_set.reps ?? "—"} tekrar ·{" "}
                {value.actual_set.kg ?? "—"} kg
              </Text>
            )}
            {value.body && <Text style={coachStyle.text}>{value.body}</Text>}
            <CoachButton
              title="Kaydı paylaş"
              secondary
              onPress={() =>
                void Share.share({
                  message: JSON.stringify(
                    { id: j.id, state: j.state, error: j.error, record: value },
                    null,
                    2,
                  ),
                }).catch((e) => setError(readableSyncError(e)))
              }
            />
          </CoachCard>
        );
      })}
      {data?.archives.map((a) => (
        <CoachCard key={a.key} title={"Arşiv · " + a.workout.snapshot.name}>
          <Text style={coachStyle.muted}>
            {a.workout.scheduled_date} · {a.workout.actual.sets.length} set
          </Text>
          <CoachButton
            title="Arşivlenen antrenmanı paylaş"
            secondary
            onPress={() =>
              void Share.share({
                message: JSON.stringify(a.workout, null, 2),
              }).catch((e) => setError(readableSyncError(e)))
            }
          />
        </CoachCard>
      ))}
    </CoachShell>
  );
}
