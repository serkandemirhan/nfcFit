import { useSessionClock } from "@/hooks/use-session-clock";
import {
  actualSessionDate,
  calendarLabel,
  sessionContext,
  sessionDisplayName,
  todaySessions,
} from "@/lib/session-presentation";
import { sessionProgressLabel } from "@/lib/member-experience";
import { FitCard, f } from "@/components/fitness-ui";
import { ActivityTrends } from "@/components/activity-trends";
import { StaffArea } from "@/components/staff-area";
import { lastFinishedMonday } from "@/lib/coaching-performance";
import type { CoachingOverview } from "@/lib/coaching-types";
import { ExercisePerformance } from "@/components/exercise-performance";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachCard,
  CoachField,
  CoachShell,
  CoachQueryState,
  coachStyle,
  percent,
  workoutLabels,
} from "@/components/coaching-ui";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { useAuth } from "@/hooks/use-auth";
import { coachingRequest } from "@/lib/tenant-console";
import { coachingStore, syncCoaching } from "@/lib/coaching";
const reportLabels: Record<string, string> = {
  generated: "Oluşturuldu",
  awaiting_review: "Antrenör incelemesi bekliyor",
  reviewed: "İncelendi",
  revision_recommended: "Program değişikliği önerildi",
  closed: "Kapatıldı",
};
export default function Progress() {
  const { athlete } = useLocalSearchParams<{ athlete?: string }>();
  return athlete ? (
    <StaffArea>
      <ProgressContent />
    </StaffArea>
  ) : (
    <ProgressContent />
  );
}
function ProgressContent() {
  const { athlete, tenant } = useLocalSearchParams<{
    athlete?: string;
    tenant?: string;
  }>();
  const { user } = useAuth();
  const query = useCoaching(athlete);
  const library = useCoachingLibrary();
  const [reportTools, setReportTools] = useState(false);
  const [week, setWeek] = useState(() => lastFinishedMonday());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const data = query.data;
  useEffect(() => {
    if (data?.timezone) setWeek(lastFinishedMonday(data.timezone));
  }, [data?.timezone]);
  const trainer = !!athlete && athlete !== data?.account_id;
  const act = async (path: string, value: unknown) => {
    setBusy(true);
    setError("");
    try {
      if (!athlete) await syncCoaching(user!.id);
      await coachingRequest(user!.id, path, value);
      if (!athlete) {
        const current = await coachingRequest<CoachingOverview>(
          user!.id,
          "/overview",
        );
        await coachingStore.saveOverview(user!.id, current);
      }
      await query.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const workouts = (data?.workouts ?? []).filter(
    (w) =>
      !tenant ||
      data?.plans.some((p) => p.id === w.plan_id && p.tenant_id === tenant),
  );
  const scoped = data
    ? {
        ...data,
        workouts,
        plans: data.plans.filter((p) => !tenant || p.tenant_id === tenant),
      }
    : undefined;
  const now = useSessionClock(data?.timezone);
  const sessions = scoped ? todaySessions(scoped, now) : null;
  return (
    <CoachShell title="İlerleme ve raporlar" bottom={!athlete}>
      {error !== "" && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      <CoachQueryState pending={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
      {!!data && <ActivityTrends
        workouts={workouts}
        timezone={data?.timezone}
        overview={scoped}
      />}
      <FitCard>
        <Text style={f.sectionTitle}>Son antrenmanlar</Text>
        <Text style={f.muted}>
          Tamamlanan seans, tüm programın tamamlandığı anlamına gelmez. Kısmi
          seansta yalnızca yapılan hedef setler sayılır.
        </Text>
        {!workouts.some(
          (w) =>
            ["completed", "partial"].includes(w.state) &&
            w.sync_state !== "rejected",
        ) && (
          <Text style={f.muted}>
            Bitirdiğin ve kısmen tamamladığın antrenmanlar burada görünecek.
          </Text>
        )}
        {workouts
          .filter(
            (w) =>
              ["completed", "partial"].includes(w.state) &&
              w.sync_state !== "rejected",
          )
          .sort((a, b) =>
            (b.actual.finished_at ?? b.scheduled_date).localeCompare(
              a.actual.finished_at ?? a.scheduled_date,
            ),
          )
          .slice(0, 4)
          .map((w) => (
            <Pressable
              key={w.id}
              accessibilityRole={trainer ? undefined : "button"}
              disabled={trainer}
              onPress={() => router.push(`/workout/${w.id}` as never)}
              style={{ gap: 5, minHeight: 64, justifyContent: "center" }}
            >
              <Text style={f.body}>
                {sessionDisplayName(w.snapshot, w.scheduled_date, library.data)}
              </Text>
              <Text style={f.muted}>
                {actualSessionDate(w, sessions?.timezone)
                  ? calendarLabel(actualSessionDate(w, sessions?.timezone)!)
                  : "Gerçekleşme tarihi kayıtlı değil"}{" "}
                · {workoutLabels[w.state]} · {sessionProgressLabel(w)}
              </Text>
              {actualSessionDate(w, sessions?.timezone) !==
                w.scheduled_date && (
                <Text style={f.muted}>
                  Planlanan: {calendarLabel(w.scheduled_date)}
                </Text>
              )}
            </Pressable>
          ))}
      </FitCard>
      {!!sessions?.missed.length && (
        <FitCard compact>
          <Text style={f.sectionTitle}>Kaçırılan seanslar</Text>
          {sessions.missed.slice(-3).map((e) => (
            <View
              key={(e.plan?.id ?? e.workout!.plan_id) + e.day.id + e.date}
              style={{ gap: 4 }}
            >
              <Text style={f.body}>
                {sessionDisplayName(e.day, e.date, library.data)}
              </Text>
              <Text style={f.muted}>
                {sessionContext(e, sessions.today, sessions.timezone)} ·
                Başlanmadı
              </Text>
            </View>
          ))}
          {!trainer && (
            <CoachButton
              title="Telafi seçeneklerini gör"
              secondary
              onPress={() => router.push("/(drawer)/plans" as never)}
            />
          )}
        </FitCard>
      )}
      <ExercisePerformance
        workouts={workouts}
        timezone={data?.timezone ?? data?.plans[0]?.content.timezone}
      />
      {!trainer && (
        <CoachButton
          title="Serbest egzersiz hedefleri ve salon raporu"
          secondary
          onPress={() => router.push("/(drawer)/fitness" as never)}
        />
      )}
      {!trainer && (
        <CoachButton
          title={
            reportTools
              ? "Rapor seçeneklerini gizle"
              : "Geçmiş hafta raporu oluştur"
          }
          secondary
          onPress={() => setReportTools((v) => !v)}
        />
      )}
      {(trainer || reportTools) && (
        <CoachCard title="Haftalık rapor oluştur">
          <Text style={coachStyle.muted}>
            Bitmiş bir haftanın pazartesi tarihini gir. Rapor kayıtlı plan ve
            gerçek setlerden hesaplanır. Çevrimdışı setleri önce eşitle.
          </Text>
          <CoachField
            label="Hafta başlangıcı (YYYY-AA-GG)"
            value={week}
            onChange={setWeek}
          />
          <CoachButton
            title={busy ? "Hesaplanıyor…" : "Raporu oluştur / aç"}
            disabled={busy || !data}
            onPress={() =>
              void act(`/athletes/${athlete ?? data!.account_id}/reports`, {
                week,
                timezone: data?.timezone ?? "Europe/Istanbul",
                ...(tenant ? { tenant_id: tenant } : {}),
              })
            }
          />
        </CoachCard>
      )}
      {!data?.reports.length && (
        <Text style={coachStyle.muted}>Henüz haftalık rapor yok.</Text>
      )}
      {data?.reports
        .filter((r) => !tenant || r.scope === tenant)
        .map((r) => (
          <CoachCard key={r.id} title={`${r.week} haftası`}>
            <Text style={{ color: brand.lime }}>
              {reportLabels[r.status] ?? r.status}
            </Text>
            {r.content.insufficient_data && (
              <Text style={coachStyle.muted}>
                Bazı karşılaştırmalar için yeterli veri yok.
              </Text>
            )}
            <Text style={coachStyle.text}>
              Tamamlanan / planlanan seans: {r.content.completed_sessions} /{" "}
              {r.content.scheduled_sessions}
            </Text>
            <Text style={coachStyle.text}>
              Kısmi: {r.content.partial_sessions} · Kaçırılan:{" "}
              {r.content.missed_sessions}
            </Text>
            <Text style={coachStyle.text}>
              Seans tamamlama: {percent(r.content.completion_rate)}
            </Text>
            <Text style={coachStyle.text}>
              Gerçekleşen / planlanan set: {r.content.completed_sets} /{" "}
              {r.content.planned_sets}
            </Text>
            <Text style={coachStyle.text}>
              Planlı set uyumu: {percent(r.content.set_adherence)}
            </Text>
            <Text style={coachStyle.text}>
              Gerçekleşen / hedef tekrar: {r.content.actual_reps} /{" "}
              {r.content.planned_reps}
            </Text>
            <Text style={coachStyle.text}>
              Kayıtlı yük hacmi:{" "}
              {r.content.recorded_volume_kg_reps == null
                ? "Yeterli ağırlık verisi yok"
                : r.content.recorded_volume_kg_reps.toLocaleString("tr-TR") +
                  " kg × tekrar"}
            </Text>
            <Text style={coachStyle.text}>
              Kayıtlı aktif süre:{" "}
              {r.content.active_duration_seconds == null
                ? "Yeterli veri yok"
                : Math.round(r.content.active_duration_seconds / 60) + " dk"}
            </Text>
            <Text style={coachStyle.muted}>
              {r.content.changes.length} program değişikliği · Eksik ölçümler
              tahmin edilmez.
            </Text>
            {trainer && (
              <View style={coachStyle.row}>
                {(["reviewed", "revision_recommended", "closed"] as const).map(
                  (status) => (
                    <CoachButton
                      key={status}
                      title={reportLabels[status]}
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void act(`/reports/${r.id}/review`, { status })
                      }
                    />
                  ),
                )}
              </View>
            )}
            <CoachButton
              title={
                trainer ? "Geri bildirim yaz" : "Antrenör geri bildirimleri"
              }
              secondary
              onPress={() =>
                router.push(
                  `/messages?${athlete ? "athlete=" + athlete + "&" : ""}context_type=report&context_id=${r.id}` as never,
                )
              }
            />
          </CoachCard>
        ))}
      <CoachButton
        title="Programlara dön"
        secondary
        onPress={() => router.push("/(drawer)/plans" as never)}
      />
    </CoachShell>
  );
}
