import { useSessionClock } from "@/hooks/use-session-clock";
import { coachingJobKeys } from "@/lib/coaching-query-keys";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  actualSessionDate,
  calendarLabel,
  sessionDisplayName,
  sessionTimezone,
} from "@/lib/session-presentation";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { useMemberActivities } from "@/hooks/use-member-activities";
import { useMemberFitness } from "@/hooks/use-member-fitness";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { syncOffline } from "@/lib/offline-sync";
import { fetchExerciseLogs } from "@/lib/api";
import {
  combineMemberExerciseLogs,
  recordedMinutes,
} from "@/lib/member-activity";
import { zonedDate } from "@/lib/coaching-performance";
import {
  wellnessToday,
  workoutElapsedSeconds,
} from "@/lib/athlete-presentation";
import { AppBottomNav } from "./app-bottom-nav";
import { CoachText as Text, workoutLabels } from "./coaching-ui";
import {
  BrandHeader,
  FitCard,
  FitSection,
  ProgressBar,
  f,
  fit,
  type FitnessIcon,
} from "./fitness-ui";
import {
  memberDayTimeline,
  sessionProgressLabel,
} from "@/lib/member-experience";
import { TodayProgram } from "./today-program";

export function AthleteDashboard() {
  const { user } = useAuth();
  const coaching = useCoaching();
  const library = useCoachingLibrary();
  const activities = useMemberActivities();
  const fitness = useMemberFitness();
  const logs = useQuery({
    queryKey: ["exercise_logs", user?.id],
    queryFn: () => fetchExerciseLogs(user!.id),
    enabled: !!user,
  });
  const jobs = useQuery({
    queryKey: coachingJobKeys.list(user?.id),
    queryFn: () => coachingStore.jobs(user!.id),
    enabled: !!user,
    networkMode: "always",
    staleTime: Infinity,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const data = coaching.data;
  const timezone = sessionTimezone(data?.timezone);
  const now = useSessionClock(timezone);
  const today = zonedDate(now, timezone);
  const records = combineMemberExerciseLogs(
    logs.data ?? [],
    activities.data ?? [],
    user?.id ?? "",
  );
  const todayRecords = records.filter(
    (r) => zonedDate(new Date(r.createdat), timezone) === today,
  );
  const workouts = (data?.workouts ?? []).filter(
    (w) => w.sync_state !== "rejected",
  );
  const sets = workouts
    .flatMap((w) => w.actual.sets)
    .filter(
      (s) =>
        s.status === "completed" &&
        zonedDate(new Date(s.occurred_at), timezone) === today,
    );
  const hasPlan = !!data?.plans.some((p) => p.athlete_id === data.account_id);
  const sessionMinutes = Math.round(
    workouts
      .filter((w) => actualSessionDate(w, timezone) === today)
      .reduce((sum, w) => sum + workoutElapsedSeconds(w), 0) / 60,
  );
  const activeMinutes = hasPlan
    ? sessionMinutes
    : Math.round(recordedMinutes(todayRecords));
  const weekStart = new Date(today + "T12:00:00Z");
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const start = weekStart.toISOString().slice(0, 10);
  const days = new Set(
    [
      ...workouts.flatMap((w) =>
        w.actual.sets
          .filter((s) => s.status === "completed")
          .map((s) => zonedDate(new Date(s.occurred_at), timezone)),
      ),
      ...records.map((r) => zonedDate(new Date(r.createdat), timezone)),
    ].filter((d) => d >= start && d <= today),
  );
  const wellness = data ? wellnessToday(data, today) : null;
  const pending = (jobs.data ?? []).filter((j) => j.state === "pending").length;
  const rejected =
    (jobs.data ?? []).filter((j) => j.state === "rejected").length +
    (activities.data ?? []).filter((a) => a.sync_state === "rejected").length;
  const freePending = (activities.data ?? []).filter(
    (a) => a.sync_state === "pending",
  ).length;
  const timeline = memberDayTimeline(workouts, records, today, timezone);
  const goals = (fitness.data?.exercises ?? [])
    .filter((g) => g.target_quantity && g.can_edit)
    .slice(0, 3);
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      await Promise.all([syncCoaching(user!.id), syncOffline(user!.id)]);
      await Promise.all([
        coaching.refetch(),
        activities.refetch(),
        fitness.refetch(),
        logs.refetch(),
      ]);
    } catch {
      setRefreshError(
        "Bağlantı kurulamadı. Telefonundaki kayıtlarla devam edebilirsin.",
      );
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <SafeAreaView edges={["top"]} style={f.page}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={f.content}
          refreshControl={
            <RefreshControl
              tintColor={fit.lime}
              colors={[fit.lime]}
              refreshing={refreshing}
              onRefresh={() => void refresh()}
            />
          }
        >
          <BrandHeader />
          <View style={{ gap: 5 }}>
            <Text style={f.heading}>
              Merhaba{user?.name ? " " + user.name.split(" ")[0] : ""} 👋
            </Text>
            <Text style={f.muted}>Hedefine her gün bir adım daha.</Text>
          </View>
          <TodayProgram />
          <View style={f.row}>
            <Metric
              icon="barbell"
              color={fit.lime}
              value={String(hasPlan ? sets.length : todayRecords.length)}
              label={hasPlan ? "Bugünkü set" : "Egzersiz kaydı"}
            />
            <Metric
              icon="time-outline"
              color={fit.cyan}
              value={String(activeMinutes)}
              label="Seans süresi (dk)"
            />
            <Metric
              icon="calendar-outline"
              color={fit.orange}
              value={days.size + "/7"}
              label="Aktif gün"
            />
          </View>
          {goals.length > 0 && (
            <FitCard>
              <FitSection
                title={`Günlük hedefler · ${calendarLabel(zonedDate(new Date(), sessionTimezone()))}`}
                action="Tümü"
                onPress={() => router.push("/goals" as never)}
              />
              {goals.map((goal) => (
                <View
                  key={goal.tenant_id + goal.exercise_id}
                  style={{ gap: 7 }}
                >
                  <View style={[f.row, { justifyContent: "space-between" }]}>
                    <Text style={[f.body, { flex: 1 }]}>{goal.name}</Text>
                    <Text style={f.muted}>
                      {goal.day.quantity}/{goal.target_quantity} ·{" "}
                      {Math.max(0, goal.target_quantity! - goal.day.quantity)}{" "}
                      kaldı
                    </Text>
                  </View>
                  <ProgressBar
                    value={goal.day.quantity / goal.target_quantity!}
                    label={goal.name + " günlük hedefi"}
                  />
                </View>
              ))}
            </FitCard>
          )}
          <FitCard>
            <FitSection
              title="Bugünkü iyi yaşam"
              action="Ekle"
              onPress={() => router.push("/(drawer)/wellness" as never)}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              <WellnessTile
                icon="water-outline"
                color={fit.cyan}
                value={
                  wellness
                    ? (wellness.waterMl / 1000).toLocaleString("tr-TR", {
                        maximumFractionDigits: 2,
                      }) + " L"
                    : "—"
                }
                label={
                  wellness
                    ? "/ " +
                      (wellness.waterGoal / 1000).toLocaleString("tr-TR") +
                      " L"
                    : "Su"
                }
              />
              <WellnessTile
                icon="cafe-outline"
                color={fit.orange}
                value={wellness ? String(wellness.coffeeCount) : "—"}
                label="Kahve kaydı"
              />
              <WellnessTile
                icon="moon-outline"
                color="#C5AEFF"
                value={
                  wellness?.sleepMinutes
                    ? (wellness.sleepMinutes / 60).toLocaleString("tr-TR", {
                        maximumFractionDigits: 1,
                      }) + " s"
                    : "—"
                }
                label="Kayıtlı uyku"
              />
              <WellnessTile
                icon="heart-outline"
                color={fit.pink}
                value={wellness?.mood ? wellness.mood + "/5" : "—"}
                label="Ruh hali"
              />
            </View>
          </FitCard>
          <FitSection
            title="Günün aktiviteleri"
            action="Geçmiş"
            onPress={() => router.push("/(drawer)/history" as never)}
          />
          {!timeline.length ? (
            <FitCard>
              <Text style={f.muted}>
                İlk kaydın burada görünecek. Planından bir antrenman başlat veya
                kartını okut.
              </Text>
            </FitCard>
          ) : (
            <FitCard>
              {timeline.slice(0, 5).map((entry) => {
                const time = new Date(entry.at).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: timezone,
                });
                if (entry.kind === "workout")
                  return (
                    <ActivityRow
                      key={entry.id}
                      icon="barbell-outline"
                      title={sessionDisplayName(
                        entry.workout.snapshot,
                        entry.workout.scheduled_date,
                        library.data,
                      )}
                      detail={`${time} · ${workoutLabels[entry.workout.state]} · ${sessionProgressLabel(entry.workout)}`}
                      onPress={() =>
                        router.push(`/workout/${entry.workout.id}` as never)
                      }
                    />
                  );
                const r = entry.record;
                return (
                  <ActivityRow
                    key={entry.id}
                    icon={
                      r.source === "nfc" ? "radio-outline" : "fitness-outline"
                    }
                    title={r.exercise_name ?? "Egzersiz"}
                    detail={`${time} · ${r.quantity} ${{ repetition: "tekrar", seconds: "sn", minutes: "dk", meters: "m" }[r.unit] ?? r.unit} · Günlük egzersiz${r.sync_state === "pending" ? " · Telefonda kayıtlı" : ""}`}
                    onPress={() => router.push("/(drawer)/history" as never)}
                  />
                );
              })}
            </FitCard>
          )}
          {pending + freePending + rejected > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  ((jobs.data ?? []).some(
                    (j) => j.state === "pending" || j.state === "rejected",
                  )
                    ? "/coaching-sync"
                    : "/sync-status") as never,
                )
              }
              style={[
                f.row,
                { padding: 12, borderRadius: 14, backgroundColor: fit.card },
              ]}
            >
              <Ionicons
                name={
                  rejected
                    ? "alert-circle-outline"
                    : pending + freePending
                      ? "cloud-upload-outline"
                      : "shield-checkmark-outline"
                }
                size={19}
                color={rejected ? fit.orange : fit.lime}
              />
              <Text style={[f.muted, { flex: 1 }]}>
                {rejected
                  ? `${rejected} kayıt kontrol bekliyor`
                  : pending + freePending
                    ? `${pending + freePending} gönderim eşitleme bekliyor`
                    : "Kayıtların telefonunda · Eşitleme ayrıntıları"}
              </Text>
              <Ionicons name="chevron-forward" size={17} color={fit.muted} />
            </Pressable>
          )}
          {!!refreshError && (
            <Text accessibilityRole="alert" style={{ color: fit.orange }}>
              {refreshError}
            </Text>
          )}
          {!!coaching.error && (
            <Text style={{ color: fit.orange }}>{coaching.error.message}</Text>
          )}
        </ScrollView>
        <AppBottomNav />
      </View>
    </SafeAreaView>
  );
}
function Metric({
  icon,
  color,
  value,
  label,
}: {
  icon: FitnessIcon;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: 5,
        paddingVertical: 10,
        backgroundColor: fit.card,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: fit.line,
      }}
    >
      <Ionicons name={icon} color={color} size={22} />
      <Text style={{ fontSize: 23, fontWeight: "900", color: fit.text }}>
        {value}
      </Text>
      <Text style={[f.muted, { fontSize: 11, lineHeight: 14 }]}>{label}</Text>
    </View>
  );
}
function WellnessTile({
  icon,
  color,
  value,
  label,
}: {
  icon: FitnessIcon;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 55, gap: 4, alignItems: "center" }}>
      <Ionicons name={icon} size={21} color={color} />
      <Text style={{ color: fit.text, fontWeight: "800", fontSize: 16 }}>
        {value}
      </Text>
      <Text
        style={[f.muted, { fontSize: 10, lineHeight: 14, textAlign: "center" }]}
      >
        {label}
      </Text>
    </View>
  );
}
function ActivityRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: FitnessIcon;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[f.row, { minHeight: 62 }]}
    >
      <View
        style={{ padding: 12, borderRadius: 13, backgroundColor: fit.raised }}
      >
        <Ionicons name={icon} size={22} color={fit.lime} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={2} style={[f.body, { fontWeight: "800" }]}>
          {title}
        </Text>
        <Text style={f.muted}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={fit.muted} />
    </Pressable>
  );
}
