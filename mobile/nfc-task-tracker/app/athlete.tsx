import { StaffArea } from "@/components/staff-area";
import { useState } from "react";
import {
  CoachText as Text,
  CoachButton,
  CoachCard,
  CoachShell,
  CoachField,
  coachStyle,
  workoutLabels,
} from "@/components/coaching-ui";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCoaching } from "@/hooks/use-coaching";
export default function AthleteDetail() {
  return (
    <StaffArea>
      <AthleteDetailContent />
    </StaffArea>
  );
}
function AthleteDetailContent() {
  const { id, tenant } = useLocalSearchParams<{ id: string; tenant: string }>();
  const query = useCoaching(id);
  const data = query.data;
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [program, setProgram] = useState("");
  const [state, setState] = useState("");
  const plans =
    data?.plans.filter((p) => p.athlete_id === id && p.tenant_id === tenant) ??
    [];
  const workouts = (data?.workouts ?? []).filter(
    (w) =>
      plans.some((p) => p.id === w.plan_id) &&
      (!program || w.plan_id === program) &&
      (!state || w.state === state) &&
      (!from || w.scheduled_date >= from) &&
      (!until || w.scheduled_date <= until),
  );
  return (
    <CoachShell title="Sporcu detayı">
      {query.isPending && <Text style={coachStyle.muted}>Yükleniyor…</Text>}
      {query.error && (
        <Text style={coachStyle.error}>{query.error.message}</Text>
      )}
      <CoachButton
        title="Yenile"
        secondary
        onPress={() => void query.refetch()}
      />
      {data && (
        <>
          <CoachButton title="Üyeye yeni plan hazırla" onPress={()=>router.push(`/plan-builder?athlete=${id}&tenant=${tenant}` as never)}/>
          <View style={coachStyle.row}>
            <CoachButton
              title="Raporlar ve ilerleme"
              onPress={() =>
                router.push(`/progress?athlete=${id}&tenant=${tenant}` as never)
              }
            />
            <CoachButton
              title="Mesaj gönder"
              secondary
              onPress={() => router.push(`/messages?athlete=${id}` as never)}
            />
          </View>
          {data.plans
            .filter((p) => p.athlete_id === id && p.tenant_id === tenant)
            .map((p) => (
              <CoachCard key={p.id} title={p.content.name}>
                <Text style={coachStyle.muted}>
                  Sürüm {p.version} · {p.content.goal}
                </Text>
                <CoachButton
                  title="Gelecek seansları düzenle"
                  onPress={() =>
                    router.push(
                      `/plan-builder?id=${p.id}&athlete=${id}` as never,
                    )
                  }
                />
                <CoachButton
                  title="Değişiklikleri incele"
                  secondary
                  onPress={() =>
                    router.push(
                      `/plan-versions?id=${p.id}&athlete=${id}` as never,
                    )
                  }
                />
              </CoachCard>
            ))}
          <CoachCard title="Antrenman filtreleri">
            <CoachField
              label="Başlangıç (YYYY-AA-GG, isteğe bağlı)"
              value={from}
              onChange={setFrom}
            />
            <CoachField
              label="Bitiş (YYYY-AA-GG, isteğe bağlı)"
              value={until}
              onChange={setUntil}
            />
            <View style={coachStyle.row}>
              <CoachButton
                title="Tüm programlar"
                secondary={!program}
                onPress={() => setProgram("")}
              />
              {plans.map((p) => (
                <CoachButton
                  key={p.id}
                  title={p.content.name}
                  secondary={program !== p.id}
                  onPress={() => setProgram(p.id)}
                />
              ))}
            </View>
            <View style={coachStyle.row}>
              <CoachButton
                title="Tüm durumlar"
                secondary={!state}
                onPress={() => setState("")}
              />
              {Object.entries(workoutLabels).map(([key, label]) => (
                <CoachButton
                  key={key}
                  title={label}
                  secondary={state !== key}
                  onPress={() => setState(key)}
                />
              ))}
            </View>
          </CoachCard>
          <CoachCard title="Gerçekleşen antrenmanlar">
            {!workouts.length && (
              <Text style={coachStyle.muted}>Henüz antrenman yok.</Text>
            )}
            {workouts.map((w) => (
              <View key={w.id} style={{ gap: 8, marginBottom: 16 }}>
                <Text style={coachStyle.sub}>
                  {w.scheduled_date} · {w.snapshot.name}
                </Text>
                <Text style={coachStyle.muted}>
                  {workoutLabels[w.state]} · Hedef sürümü {w.plan_version}
                </Text>
                {[...w.snapshot.exercises, ...w.actual.added].map((e) => (
                  <View key={e.id}>
                    <Text style={coachStyle.text}>
                      {e.name ?? e.exercise_id} · Hedef {e.sets} ×{" "}
                      {e.reps ?? e.seconds ?? e.meters}
                    </Text>
                    {w.actual.sets
                      .filter((s) => s.exercise_key === e.id)
                      .map((s) => (
                        <Text key={s.id} style={coachStyle.muted}>
                          Set {s.set_number}:{" "}
                          {s.status === "skipped"
                            ? "Atlandı"
                            : `${s.reps ?? "—"} tekrar · ${s.kg ?? "—"} kg · ${s.seconds ?? "—"} sn · ${s.meters ?? "—"} m`}
                          {s.notes ? " · " + s.notes : ""}
                        </Text>
                      ))}
                  </View>
                ))}
                {w.actual.notes !== "" && (
                  <Text style={coachStyle.text}>
                    Sporcu notu: {w.actual.notes}
                  </Text>
                )}
              </View>
            ))}
          </CoachCard>
          <CoachCard title="Paylaşılan iyi yaşam kayıtları">
            <Text style={coachStyle.muted}>
              Yalnızca sporcunun açıkça izin verdiği ölçütler gösterilir.
            </Text>
            {!data.wellness.length && (
              <Text style={coachStyle.muted}>Paylaşılan kayıt yok.</Text>
            )}
            {data.wellness.slice(0, 20).map((w) => (
              <Text key={w.id} style={coachStyle.text}>
                {w.kind} · {new Date(w.occurred_at).toLocaleDateString("tr-TR")}{" "}
                · {w.content.amount ?? w.content.energy ?? "—"}{" "}
                {w.content.notes ?? ""}
              </Text>
            ))}
          </CoachCard>
        </>
      )}
    </CoachShell>
  );
}
