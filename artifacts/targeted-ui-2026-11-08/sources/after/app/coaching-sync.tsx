import { createManualSync, syncFailure, syncRecordCounts, type SyncNotice } from "@/lib/manual-sync-status";
import { hasConnection } from "@/lib/offline-sync";
import { coachingJobKeys } from "@/lib/coaching-query-keys";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachShell,
  coachStyle,
} from "@/components/coaching-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { offlineStore } from "@/lib/offline-store";
export default function CoachingSync() {
  const { user } = useAuth();
  const userId=user?.id??"";
  const [attempt, setAttempt] = useState<SyncNotice | {kind:"idle"|"syncing";message:string}>({kind:"idle",message:""});
  const generation=useRef(0);
  useEffect(()=>{const token=++generation.current;setAttempt({kind:"idle",message:""});return()=>{generation.current=token+1;};},[userId]);
  const manual=useMemo(()=>createManualSync({online:hasConnection,read:async()=>({jobs:await coachingStore.jobs(userId),error:await offlineStore.getDoc<string>(userId,"coaching-error"),last:await coachingStore.lastSync(userId)}),sync:()=>syncCoaching(userId)}),[userId]);
  const busy=attempt.kind==="syncing";
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
  const counts=data?syncRecordCounts(data.jobs):null;
  const notice=attempt.kind!=="idle"?attempt:data?.error?syncFailure(data.error):null;
  const run=async()=>{
    if(!user||manual.running)return;
    const token=generation.current;setAttempt({kind:"syncing",message:"Sunucuyla eşitleniyor..."});
    const result=await manual.run();
    if(token!==generation.current)return;
    setAttempt(result);
    void query.refetch();
  };
  return (
    <CoachShell title="Antrenman eşitlemesi">
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {notice && <Text accessibilityLiveRegion="polite" accessibilityRole={notice.kind==="success"||busy?undefined:"alert"} style={notice.kind==="success"?coachStyle.text:busy?coachStyle.muted:coachStyle.error}>{notice.message}</Text>}
      <Text style={coachStyle.muted}>
        Son başarılı eşitleme:{" "}
        {data?.last ? new Date(data.last).toLocaleString("tr-TR") : "Henüz yok"}
      </Text>
      <CoachButton
        title={busy ? "Eşitleniyor..." : notice&&notice.kind!=="success" ? "Yeniden eşitle" : "Şimdi eşitle"}
        disabled={busy||!user}
        onPress={()=>void run()}
      />
      {counts&&<Text style={coachStyle.text}>{counts.pending} kayıt bekliyor · {counts.failed} kayıt inceleme gerektiriyor</Text>}
      <Text style={coachStyle.muted}>Çakışan kayıtlar silinmez. İnceleme gereken kaydı antrenörünle paylaşabilirsin.</Text>
      {query.isPending && <Text style={coachStyle.muted}>Telefondaki kayıtlar kontrol ediliyor…</Text>}
      {query.error && <Text accessibilityRole="alert" style={coachStyle.error}>{syncFailure(query.error).message}</Text>}
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
            {j.error && <Text style={coachStyle.error}>{syncFailure(j.error).message}</Text>}
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
                }).catch(() => setError("Paylaşım açılamadı. Yeniden dene."))
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
              }).catch(() => setError("Paylaşım açılamadı. Yeniden dene."))
            }
          />
        </CoachCard>
      ))}
    </CoachShell>
  );
}
