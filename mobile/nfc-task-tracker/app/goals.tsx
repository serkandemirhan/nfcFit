import { useSessionClock } from "@/hooks/use-session-clock";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  CoachShell,
  CoachQueryState,
  CoachText as Text,
  workoutLabels,
} from "@/components/coaching-ui";
import { MemberTenantGoals } from "@/components/member-tenant-goals";
import { FitButton, FitCard, ProgressBar, f } from "@/components/fitness-ui";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { workoutProgress } from "@/lib/athlete-presentation";
import {
  calendarLabel,
  sessionGoalContext,
  sessionDisplayName,
  todaySessions,
} from "@/lib/session-presentation";
export default function Goals() {
  const query = useCoaching();
  const {data} = query;
  const library = useCoachingLibrary();
  const now = useSessionClock(data?.timezone);
  const view = data ? todaySessions(data, now) : null;
  const entries = view
    ? [view.primary, view.upcoming].filter(
        (e): e is NonNullable<typeof e> => !!e,
      )
    : [];
  return (
    <CoachShell title="Hedeflerim" bottom compact>
      <MemberTenantGoals focused />
      <View style={{gap:4}}><Text style={f.sectionTitle}>Program seansları</Text><Text style={f.muted}>Her seansın hedef setleri ayrı izlenir.</Text></View>
      <CoachQueryState pending={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
      {!!data && !entries.length && (
        <Text style={f.muted}>
          Planlı seansın yok. Programım bölümünden plan oluşturabilirsin.
        </Text>
      )}
      {entries.map((entry) => {
        const p = entry.workout
          ? workoutProgress(entry.workout)
          : {
              completed: 0,
              total: entry.day.exercises.reduce((sum, e) => sum + e.sets, 0),
              ratio: 0,
            };
        const ended =
          entry.workout &&
          ["completed", "partial", "skipped", "cancelled"].includes(
            entry.workout.state,
          );
        const context = sessionGoalContext(entry, view!.today, view!.timezone);
        return (
          <FitCard
            compact
            key={
              entry.workout?.id ?? entry.plan!.id + entry.day.id + entry.date
            }
          >
            <Text style={[f.body, { fontWeight: "800" }]}>
              {context.label} · {calendarLabel(context.date)}
            </Text>
            <Text style={f.body}>
              {sessionDisplayName(entry.day, entry.date, library.data)}
            </Text>
            {context.detail && <Text style={f.muted}>{context.detail}</Text>}
            <Text style={f.body}>
              {p.completed}/{p.total} hedef set · {p.total - p.completed} set{" "}
              {ended ? "yapılmadı" : "kaldı"}
            </Text>
            <ProgressBar value={p.ratio} label="Seans hedef setleri" />
            {entry.workout && (
              <Text style={f.muted}>{workoutLabels[entry.workout.state]}</Text>
            )}
          </FitCard>
        );
      })}
      <FitButton
        title="Programımı gör"
        secondary
        icon="calendar-outline"
        onPress={() => router.push("/(drawer)/plans" as never)}
      />
      <Pressable accessibilityRole="link" style={{minHeight:44,justifyContent:"center"}} onPress={()=>router.push("/(drawer)/personal-goals" as never)}><Text style={f.muted}>Diğer kişisel hedefler ve önceki kayıtlar</Text></Pressable>
    </CoachShell>
  );
}
