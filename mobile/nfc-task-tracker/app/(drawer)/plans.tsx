import {
  calendarLabel,
  sessionDisplayName,
  sessionTimezone,
  planSessionProgress,
} from "@/lib/session-presentation";
import { PlanCoachContext } from "@/components/plan-coach-context";
import { MemberWeek } from "@/components/member-week";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BrandHeader,
  FitButton,
  FitCard,
  FitSection,
  IconAction,
  ProgressBar,
  f,
  fit,
} from "@/components/fitness-ui";
import { MovementArt } from "@/components/fitness-art";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { difficultyLabels, workoutProgress } from "@/lib/athlete-presentation";
import {
  canOpenCoachArea,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";
import { zonedDate } from "@/lib/coaching-performance";
import {
  CoachText as Text,
  CoachButton,
  CoachField,
  coachStyle,
  workoutLabels,
} from "@/components/coaching-ui";
import { useRef, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid } from "@/lib/offline-store";
import { coachingRequest } from "@/lib/tenant-console";
import type { Plan } from "@/lib/coaching-types";
import { offlineChanged } from "@/lib/offline-sync";
export default function Plans() {
  const { user } = useAuth();
  const overview = useCoaching();
  const identity = useTenantIdentity();
  const library = useCoachingLibrary();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [assign, setAssign] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const assignment = useRef(localUuid());
  const [assignmentStart, setAssignmentStart] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actions, setActions] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const [moreSessions, setMoreSessions] = useState<string | null>(null);
  const open = async (p: Plan, day: string, date: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const w = await coachingStore.createWorkout(
        user!.id,
        localUuid(),
        p,
        day,
        date,
        library.data ?? [],
      );
      offlineChanged(user!.id);
      void syncCoaching(user!.id).catch(() => undefined);
      router.push(`/workout/${w.id}` as never);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const assignPlan = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await coachingRequest(user!.id, `/plans/${assign}/assign`, {
        athlete_ids: selected,
        request_id: assignment.current,
        start_date: assignmentStart,
      });
      setAssign(null);
      setSelected([]);
      setNotice("Programlar bağımsız kopyalar olarak atandı.");
      await syncCoaching(user!.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const plans = overview.data?.plans ?? [];
  const account = overview.data?.account_id;
  const links = (overview.data?.links ?? []).filter(
    (l) => l.trainer_id === account,
  );
  const canCreatePersonal = identity.data?.memberships.some(m=>m.status==='active') ?? false;
  const today = zonedDate(new Date(), sessionTimezone(overview.data?.timezone));
  return (
    <SafeAreaView edges={["top"]} style={f.page}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={f.content}>
          <BrandHeader />
          <View style={[f.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={f.heading}>Programım</Text>
              <Text style={f.muted}>Planla, uygula ve gelişimini gör.</Text>
            </View>
            {!!plans.length && (
              <IconAction
                icon="ellipsis-horizontal"
                label="Program seçenekleri"
                onPress={() => setMenu((v) => !v)}
              />
            )}
          </View>
          {menu && (
            <FitCard>
              <FitButton
                title="Yeni plan oluştur"
                icon="add"
                onPress={() => router.push("/plan-setup" as never)}
              />
              <FitButton
                title="Egzersiz kütüphanesi"
                secondary
                icon="library-outline"
                onPress={() =>
                  router.push("/(drawer)/exercise-library" as never)
                }
              />
              <FitButton
                title="Hedeflerim"
                secondary
                icon="flag-outline"
                onPress={() => router.push("/goals" as never)}
              />
            </FitCard>
          )}
          <MemberWeek />
          {identity.data && !canCreatePersonal && !canOpenCoachArea(identity.data) && !plans.length && <FitCard accent><Text style={f.sectionTitle}>Önce kulübüne katıl</Text><Text style={f.muted}>Plan oluşturmak ve kart egzersizlerini kaydetmek için aktif kulüp üyeliği gerekir.</Text><FitButton title="Kulüp kartını okut" icon="radio-outline" onPress={()=>router.push('/(drawer)/nfc' as never)}/></FitCard>}
          {!!error && (
            <Text accessibilityRole="alert" style={coachStyle.error}>
              {error}
            </Text>
          )}
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={f.link}>
              {notice}
            </Text>
          )}
          {!!overview.data && !plans.length && canCreatePersonal && (
            <FitCard accent>
              <View style={f.row}>
                <View style={{ flex: 1, gap: 7 }}>
                  <Text style={f.eyebrow}>BİR SONRAKİ ADIMIN</Text>
                  <Text style={f.sectionTitle}>Sana ait bir plan</Text>
                  <Text style={f.muted}>
                    Hedefini ve günlerini belirle. Egzersizlerini kütüphaneden
                    seç.
                  </Text>
                </View>
                <MovementArt size={90} muscle="cardio" />
              </View>
              <FitButton
                title="Yeni plan oluştur"
                icon="sparkles-outline"
                onPress={() => router.push("/plan-setup" as never)}
              />
            </FitCard>
          )}
          <FitSection
            title={
              canOpenCoachArea(identity.data)
                ? "Programlar ve şablonlar"
                : "Planların"
            }
            action={plans.length ? String(plans.length) + " plan" : undefined}
          />
          {overview.isPending && (
            <Text style={f.muted}>Programlar yükleniyor…</Text>
          )}
          {!!overview.error && (
            <Text style={coachStyle.error}>{overview.error.message}</Text>
          )}
          {!plans.length && !overview.isPending && (
            <FitButton
              title="Antrenörüne yaz"
              icon="chatbubble-outline"
              secondary
              onPress={() => router.push("/messages" as never)}
            />
          )}
          {plans.map((p) => {
            const isExpanded = expanded === p.id;
            const own = p.athlete_id === account;
            const sessions = p.content.days
              .flatMap((d) => d.dates.map((date) => ({ d, date })))
              .filter((x) => x.date >= today)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 7);
            const planWorkouts = (overview.data?.workouts ?? []).filter(
              (w) => w.plan_id === p.id && w.sync_state !== "rejected",
            );
            const planProgress = planSessionProgress(p, planWorkouts);
            const completed = planProgress.achieved;
            const totalSessions = planProgress.total;
            return (
              <FitCard key={p.id} accent={isExpanded}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => setExpanded(isExpanded ? "collapsed" : p.id)}
                  style={f.row}
                >
                  <MovementArt
                    size={74}
                    muscle={
                      library.data?.find(
                        (e) =>
                          e.id === p.content.days[0]?.exercises[0]?.exercise_id,
                      )?.muscle ?? "cardio"
                    }
                  />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={f.badge}>
                      {p.athlete_id ? "Kişisel / atanmış" : "Tesis şablonu"}
                    </Text>
                    <Text style={f.sectionTitle}>{p.content.name}</Text>
                    <Text style={f.muted}>
                      {p.content.weeks} hafta ·{" "}
                      {difficultyLabels[p.content.difficulty]} · {totalSessions}{" "}
                      planlı seans
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={19}
                    color={fit.lime}
                  />
                </Pressable>
                {own && (
                  <>
                    <View style={[f.row, { justifyContent: "space-between" }]}>
                      <Text style={f.muted}>
                        {completed}/{totalSessions} seansın hedefleri tamamlandı
                      </Text>
                      <Text style={f.link}>Sürüm {p.version}</Text>
                    </View>
                    <ProgressBar
                      value={totalSessions ? completed / totalSessions : 0}
                      label={p.content.name + " tamamlanan seanslar"}
                    />
                  </>
                )}
                {isExpanded && (
                  <>
                    {own && <PlanCoachContext plan={p} />}
                    {!!p.content.goal && (
                      <Text style={f.muted}>{p.content.goal}</Text>
                    )}
                    {own && (
                      <>
                        <Text style={f.eyebrow}>SIRADAKİ SEANSLAR</Text>
                        {!sessions.length && (
                          <Text style={f.muted}>
                            Bu planda gelecek seans kalmadı. Geçmişini aşağıdan
                            açabilirsin.
                          </Text>
                        )}
                        {sessions
                          .slice(0, moreSessions === p.id ? 7 : 3)
                          .map(({ d, date }) => {
                            const w = overview.data?.workouts.find(
                              (w) =>
                                w.plan_id === p.id &&
                                w.session_key === d.id &&
                                w.scheduled_date === date,
                            );
                            const progress = w ? workoutProgress(w) : null;
                            return (
                              <Pressable
                                key={d.id + date}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  date + " " + d.name + " antrenmanını aç"
                                }
                                disabled={busy}
                                onPress={() =>
                                  w
                                    ? router.push(`/workout/${w.id}` as never)
                                    : void open(p, d.id, date)
                                }
                                style={[
                                  f.row,
                                  {
                                    paddingVertical: 10,
                                    borderBottomWidth: 1,
                                    borderBottomColor: fit.line,
                                  },
                                ]}
                              >
                                <View
                                  style={{
                                    width: 45,
                                    height: 49,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor:
                                      date === today ? fit.lime : fit.raised,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontWeight: "900",
                                      fontSize: 18,
                                      color: date === today ? fit.bg : fit.text,
                                    }}
                                  >
                                    {date.slice(8)}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      color:
                                        date === today ? fit.bg : fit.muted,
                                    }}
                                  >
                                    {date.slice(5, 7)}
                                  </Text>
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={[f.body, { fontWeight: "800" }]}>
                                    {sessionDisplayName(
                                      w?.snapshot ?? d,
                                      date,
                                      library.data,
                                    )}
                                    {date === today ? " · Bugün" : ""}
                                  </Text>
                                  <Text style={f.muted}>
                                    {d.exercises.length} egzersiz
                                    {w ? " · " + workoutLabels[w.state] : ""}
                                    {progress
                                      ? " · " +
                                        progress.completed +
                                        "/" +
                                        progress.total +
                                        " set"
                                      : ""}
                                  </Text>
                                </View>
                                <Ionicons
                                  name={
                                    w?.state === "completed"
                                      ? "checkmark-circle"
                                      : "play-circle-outline"
                                  }
                                  color={fit.lime}
                                  size={26}
                                />
                              </Pressable>
                            );
                          })}
                        {sessions.length > 3 && (
                          <FitButton
                            title={
                              moreSessions === p.id
                                ? "Seansları kısalt"
                                : "Sonraki " +
                                  sessions.length +
                                  " seansı göster"
                            }
                            secondary
                            icon="calendar-outline"
                            onPress={() =>
                              setMoreSessions(
                                moreSessions === p.id ? null : p.id,
                              )
                            }
                          />
                        )}
                      </>
                    )}
                    <View style={[f.row, { justifyContent: "space-between" }]}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setActions(actions === p.id ? null : p.id)
                        }
                        style={{ minHeight: 44, justifyContent: "center" }}
                      >
                        <Text style={f.link}>
                          {actions === p.id
                            ? "İşlemleri gizle"
                            : "Plan işlemleri"}{" "}
                          ···
                        </Text>
                      </Pressable>
                      {!p.athlete_id && canOpenCoachArea(identity.data) && (
                        <FitButton
                          title="Sporcuya ata"
                          icon="people-outline"
                          onPress={() => {
                            setAssign(p.id);
                            setSelected([]);
                            setAssignmentStart(
                              zonedDate(new Date(), p.content.timezone),
                            );
                            assignment.current = localUuid();
                          }}
                        />
                      )}
                    </View>
                    {actions === p.id && (
                      <View style={coachStyle.row}>
                        <CoachButton
                          title="Düzenle"
                          secondary
                          onPress={() =>
                            router.push(`/plan-builder?id=${p.id}` as never)
                          }
                        />
                        <CoachButton
                          title="Kopyala"
                          secondary
                          onPress={() =>
                            router.push(
                              `/plan-builder?id=${p.id}&copy=1` as never,
                            )
                          }
                        />
                        <CoachButton
                          title="Sürüm geçmişi"
                          secondary
                          onPress={() =>
                            router.push(`/plan-versions?id=${p.id}` as never)
                          }
                        />
                      </View>
                    )}
                    {assign === p.id && (
                      <View style={{ gap: 10 }}>
                        <Text style={f.body}>Atanmış sporcularını seç</Text>
                        <CoachField
                          label="Başlangıç (YYYY-AA-GG)"
                          value={assignmentStart}
                          onChange={(value) => {
                            setAssignmentStart(value);
                            assignment.current = localUuid();
                          }}
                        />
                        {links
                          .filter((l) => l.tenant_id === p.tenant_id)
                          .map((l) => (
                            <CoachButton
                              key={l.id}
                              title={
                                (selected.includes(l.athlete_id) ? "✓ " : "") +
                                l.name
                              }
                              secondary={!selected.includes(l.athlete_id)}
                              onPress={() => {
                                assignment.current = localUuid();
                                setSelected((s) =>
                                  s.includes(l.athlete_id)
                                    ? s.filter((x) => x !== l.athlete_id)
                                    : [...s, l.athlete_id],
                                );
                              }}
                            />
                          ))}
                        <CoachButton
                          title="Seçilenlere ata"
                          disabled={
                            !selected.length || !assignmentStart || busy
                          }
                          onPress={() => void assignPlan()}
                        />
                        <CoachButton
                          title="Vazgeç"
                          secondary
                          onPress={() => setAssign(null)}
                        />
                      </View>
                    )}
                  </>
                )}
              </FitCard>
            );
          })}
          {!!overview.data?.workouts.length && (
            <>
              <FitSection
                title="Antrenman geçmişi"
                action={allHistory ? "Kısalt" : "Son 20 kayıt"}
                onPress={() => setAllHistory((v) => !v)}
              />
              <FitCard>
                {!overview.data?.workouts.length && (
                  <Text style={f.muted}>İlk antrenmanın burada görünecek.</Text>
                )}
                {[...(overview.data?.workouts ?? [])]
                  .sort((a, b) =>
                    b.scheduled_date.localeCompare(a.scheduled_date),
                  )
                  .slice(0, allHistory ? 20 : 4)
                  .map((w) => (
                    <Pressable
                      key={w.id}
                      accessibilityRole="button"
                      onPress={() => router.push(`/workout/${w.id}` as never)}
                      style={[f.row, { minHeight: 60 }]}
                    >
                      <Ionicons
                        name={
                          w.state === "completed"
                            ? "checkmark-circle-outline"
                            : "barbell-outline"
                        }
                        color={fit.lime}
                        size={25}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[f.body, { fontWeight: "800" }]}>
                          {sessionDisplayName(
                            w.snapshot,
                            w.scheduled_date,
                            library.data,
                          )}
                        </Text>
                        <Text style={f.muted}>
                          {calendarLabel(w.scheduled_date)} ·{" "}
                          {workoutLabels[w.state]} ·{" "}
                          {workoutProgress(w).completed}/
                          {workoutProgress(w).total} hedef set
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={fit.muted}
                      />
                    </Pressable>
                  ))}
              </FitCard>
            </>
          )}
          {canOpenCoachArea(identity.data) && (
            <FitButton
              title="Antrenör alanı"
              icon="people-outline"
              secondary
              onPress={() => router.push("/coach" as never)}
            />
          )}
        </ScrollView>
        <AppBottomNav />
      </View>
    </SafeAreaView>
  );
}
