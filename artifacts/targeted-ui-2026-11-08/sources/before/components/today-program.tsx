import { useTenantIdentity } from "@/hooks/use-tenant-identity";
import { useSessionClock } from "@/hooks/use-session-clock";
import { useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
import { workoutProgress } from "@/lib/athlete-presentation";
import {
  calendarLabel,
  sessionContext,
  sessionDisplayName,
  todaySessions,
  type SessionEntry,
} from "@/lib/session-presentation";
import { CoachQueryState, CoachText as Text, workoutLabels } from "./coaching-ui";
import { FitButton, FitCard, ProgressBar, f, fit } from "./fitness-ui";

export function TodayProgram() {
  const identity = useTenantIdentity();
  const query = useCoaching();
  const {data,isPending} = query;
  const { user } = useAuth();
  const library = useCoachingLibrary();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useSessionClock(data?.timezone);
  const view = data ? todaySessions(data, now) : null;
  const primary = view?.primary;
  const workout = primary?.workout;
  const ended =
    !!workout &&
    ["completed", "partial", "skipped", "cancelled"].includes(workout.state);
  const progress = workout
    ? workoutProgress(workout)
    : {
        completed: 0,
        total: primary?.day.exercises.reduce((s, e) => s + e.sets, 0) ?? 0,
        ratio: 0,
      };
  const open = async (entry: SessionEntry) => {
    if (!user || lock.current) return;
    if (entry.workout) {
      router.push(`/workout/${entry.workout.id}` as never);
      return;
    }
    if (!entry.plan) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const created = await coachingStore.createWorkout(
        user.id,
        localUuid(),
        entry.plan,
        entry.day.id,
        entry.date,
        library.data ?? [],
      );
      offlineChanged(user.id);
      void syncCoaching(user.id).catch(() => undefined);
      router.push(`/workout/${created.id}` as never);
    } catch {
      setError("Antrenman açılamadı. Yeniden deneyebilirsin.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if(identity.data && !identity.data.memberships.some(m=>m.status==='active') && !data?.plans.some(p=>p.athlete_id===data.account_id)) {
    const pending=identity.data.memberships.some(m=>m.status==='pending');
    return <FitCard accent><Text style={f.eyebrow}>KULÜP ÜYELİĞİ</Text><Text style={f.sectionTitle}>{pending?'Üyelik onayın bekleniyor':'Kulübüne katıl'}</Text><Text style={f.muted}>{pending?'Kulüp yöneticin onayladığında planlarını ve kart egzersizlerini kullanabilirsin. Telefona indirilen tanımlar onaya kadar bekler.':'Kulübündeki kayıtlı NFC kartını okut. Katılım isteğin onaylandıktan sonra antrenmanlarını kaydedebilirsin.'}</Text><FitButton title={pending?'Üyelik durumunu yenile':'Kulüp kartını okut'} icon={pending?'refresh':'radio-outline'} disabled={identity.isFetching} onPress={()=>pending?void identity.refetch():router.push('/(drawer)/nfc' as never)}/></FitCard>;
  }
  return (
    <View style={{ gap: 12 }}>
      {query.error && <CoachQueryState pending={false} error={query.error} onRetry={()=>void query.refetch()}/>}
      <FitCard accent>
        <Text style={f.eyebrow}>
          {view ? `BUGÜN · ${calendarLabel(view.today)}` : "BUGÜN"}
        </Text>
        {primary && view ? (
          <>
            <Text style={f.sectionTitle}>
              {sessionDisplayName(primary.day, primary.date, library.data)}
            </Text>
            <Text style={f.muted}>
              {sessionContext(primary, view.today, view.timezone)}
            </Text>
            {!!primary.plan && (
              <Text numberOfLines={1} style={f.muted}>
                {primary.plan.content.name}
              </Text>
            )}
            <Text
              style={[
                f.body,
                {
                  fontWeight: "800",
                  color: workout?.state === "partial" ? fit.orange : fit.text,
                },
              ]}
            >
              {workout ? workoutLabels[workout.state] : "Bugünkü planın hazır"}
            </Text>
            <Text style={f.body}>
              {progress.completed}/{progress.total} hedef set ·{" "}
              {Math.max(0, progress.total - progress.completed)} set{" "}
              {ended ? "yapılmadı" : "kaldı"}
            </Text>
            <ProgressBar
              value={progress.ratio}
              label="Bu seansın hedef setleri"
            />
            {ended && (
              <Text style={f.muted}>
                Bu seansın sonucu korunur. Seansı bitirmek, tüm program
                hedeflerinin tamamlandığı anlamına gelmez.
              </Text>
            )}
            {workout?.sync_state === "pending" && (
              <Text style={f.muted}>
                Telefona kaydedildi · Eşitleme bekliyor
              </Text>
            )}
            {workout?.sync_state === "rejected" && (
              <Text style={{ color: fit.orange }}>
                Kayıt eşitleme incelemesi bekliyor; hedeflere onaylanmış kayıt
                olarak eklenmez.
              </Text>
            )}
            <FitButton
              title={
                busy
                  ? "Antrenman açılıyor…"
                  : ended
                    ? "Seans sonucunu gör"
                    : workout &&
                        ["in_progress", "paused"].includes(workout.state)
                      ? "Antrenmana devam et"
                      : "Antrenmanı aç"
              }
              icon={ended ? "stats-chart-outline" : "play"}
              disabled={busy}
              onPress={() => void open(primary)}
            />
          </>
        ) : (
          <>
            <Text style={f.sectionTitle}>
              {isPending && !data
                ? "Günün hazırlanıyor…"
                : data?.plans.some((p) => p.athlete_id === data.account_id)
                  ? "Bugün planlı antrenman yok"
                  : "İlk programını oluştur"}
            </Text>
            <Text style={f.muted}>
              Bugünkü kayıtların ve gelecek seansların ayrı gösterilir.
            </Text>
            <FitButton
              title={
                data?.plans.length ? "Haftalık planımı gör" : "Plan oluştur"
              }
              icon="calendar-outline"
              onPress={() =>
                router.push(
                  (data?.plans.length
                    ? "/(drawer)/plans"
                    : "/plan-setup") as never,
                )
              }
            />
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: fit.orange }}>
            {error}
          </Text>
        )}
      </FitCard>
      {view?.results
        .filter((e) => e !== primary)
        .map((entry) => (
          <FitCard key={entry.workout!.id}>
            <Text style={f.eyebrow}>BUGÜNÜN DİĞER SONUCU</Text>
            <Text style={f.body}>
              {sessionDisplayName(entry.day, entry.date, library.data)}
            </Text>
            <Text style={f.muted}>
              {workoutLabels[entry.workout!.state]} ·{" "}
              {workoutProgress(entry.workout!).completed}/
              {workoutProgress(entry.workout!).total} hedef set
            </Text>
            <FitButton
              title="Seans sonucunu gör"
              secondary
              onPress={() => void open(entry)}
            />
          </FitCard>
        ))}
      {view?.previousActive && (
        <FitCard>
          <Text style={f.eyebrow}>ÖNCEKİ GÜNDEN DEVAM EDEN</Text>
          <Text style={f.body}>
            {sessionDisplayName(
              view.previousActive.day,
              view.previousActive.date,
              library.data,
            )}
          </Text>
          <Text style={f.muted}>
            {sessionContext(view.previousActive, view.today, view.timezone)}
          </Text>
          <FitButton
            title="Önceki seansı aç"
            secondary
            onPress={() => void open(view.previousActive!)}
          />
        </FitCard>
      )}
      {!!view?.missed.length && (
        <FitButton
          title={`${view.missed.length} kaçırılan seans · Telafi seçenekleri`}
          secondary
          icon="calendar-outline"
          onPress={() => router.push("/(drawer)/plans" as never)}
        />
      )}
      {view?.upcoming && (
        <FitCard>
          <Text style={f.eyebrow}>
            SIRADAKİ ANTRENMAN · {calendarLabel(view.upcoming.date)}
          </Text>
          <Text style={f.body}>
            {sessionDisplayName(
              view.upcoming.day,
              view.upcoming.date,
              library.data,
            )}
          </Text>
          <Text style={f.muted}>
            Gelecek plan · Bugünkü sonuca eklenmez.
            {view.upcoming.workout
              ? ` · ${workoutLabels[view.upcoming.workout.state]}`
              : ""}
          </Text>
          <FitButton
            title="Gelecek planı gör"
            secondary
            icon="calendar-outline"
            onPress={() => router.push("/(drawer)/plans" as never)}
          />
        </FitCard>
      )}
    </View>
  );
}
