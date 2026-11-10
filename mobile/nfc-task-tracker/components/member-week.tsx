import { useSessionClock } from "@/hooks/use-session-clock";
import {
  calendarLabel,
  sessionDisplayName,
  sessionTimezone,
} from "@/lib/session-presentation";
import { useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useCoaching, useCoachingLibrary } from "@/hooks/use-coaching";
import { memberSchedule } from "@/lib/workout-experience";
import { zonedDate } from "@/lib/coaching-performance";
import { coachingStore, syncCoaching } from "@/lib/coaching";
import { localUuid, offlineStore } from "@/lib/offline-store";
import { offlineChanged } from "@/lib/offline-sync";
import { coachingRequest } from "@/lib/tenant-console";
import type { CoachingOverview, Plan } from "@/lib/coaching-types";
import { CoachText as Text, workoutLabels } from "./coaching-ui";
import { FitButton, FitCard, ProgressBar, f, fit } from "./fitness-ui";

export function MemberWeek({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { data } = useCoaching();
  const library = useCoachingLibrary();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const now = useSessionClock(data?.timezone);
  if (!data) return null;
  const today = zonedDate(now, sessionTimezone(data.timezone));
  const schedule = memberSchedule(data, today);
  const visibleDate = schedule.days.some((day) => day.date === selectedDate)
    ? selectedDate
    : today;
  if (!data.plans.some((p) => p.athlete_id === data.account_id)) return null;
  const open = async (plan: Plan, day: string, date: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const w = await coachingStore.createWorkout(
        user!.id,
        localUuid(),
        plan,
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
      lock.current = false;
      setBusy(false);
    }
  };
  const recover = async (date: string) => {
    const missed = schedule.missed;
    if (!missed || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      // Persist the complete create request before sending; retry after a timeout uses the same UUID/content.
      const key = `makeup:${missed.plan.id}:${missed.day.id}:${missed.date}:${date}`;
      let request = await offlineStore.getDoc<{
        id: string;
        tenant_id: null;
        content: Plan["content"];
      }>(user!.id, key);
      if (!request) {
        request = {
          id: localUuid(),
          tenant_id: null,
          content: {
            ...missed.plan.content,
            name: missed.day.name.slice(0, 105) + " · Telafi",
            goal:
              missed.date +
              " tarihli " +
              missed.day.name +
              " seansının telafisi",
            start_date: date,
            weeks: 1,
            days: [{ ...missed.day, id: localUuid(), dates: [date] }],
          },
        };
        await offlineStore.putDoc(user!.id, key, request);
      }
      const plan = await coachingRequest<Plan>(user!.id, "/plans", request);
      const fresh = await coachingRequest<CoachingOverview>(
        user!.id,
        "/overview",
      );
      await coachingStore.saveOverview(user!.id, fresh);
      const original = await coachingStore.createWorkout(
        user!.id,
        localUuid(),
        missed.plan,
        missed.day.id,
        missed.date,
        library.data ?? [],
      );
      if (original.state === "not_started")
        await coachingStore.command(user!.id, original.id, {
          request_id: localUuid(),
          expected_version: original.version,
          occurred_at: new Date().toISOString(),
          action: "skip",
        });
      const next = await coachingStore.createWorkout(
        user!.id,
        localUuid(),
        plan,
        plan.content.days[0].id,
        date,
        library.data ?? [],
      );
      offlineChanged(user!.id);
      void syncCoaching(user!.id).catch(() => undefined);
      router.push(`/workout/${next.id}` as never);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const skip = async () => {
    const missed = schedule.missed;
    if (!missed || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const original = await coachingStore.createWorkout(
        user!.id,
        localUuid(),
        missed.plan,
        missed.day.id,
        missed.date,
        library.data ?? [],
      );
      await coachingStore.command(user!.id, original.id, {
        request_id: localUuid(),
        expected_version: original.version,
        occurred_at: new Date().toISOString(),
        action: "skip",
      });
      offlineChanged(user!.id);
      void syncCoaching(user!.id).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const confirmRecovery = (date: string) =>
    Alert.alert(
      "Telafi seansı oluştur?",
      "Geçmiş seans atlandı olarak korunur. Seçtiğin tarih için ayrı bir kişisel telafi planı oluşturulur; mevcut programın değiştirilmez. İnternet bağlantısı gerekir.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Telafi oluştur", onPress: () => void recover(date) },
      ],
    );
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
  return (
    <View style={{ gap: 14 }}>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: fit.orange }}>
          {error}
        </Text>
      )}
      {!compact && (
        <FitCard accent={schedule.allDone}>
          <View style={f.row}>
            <Ionicons
              name={schedule.allDone ? "trophy-outline" : "calendar-outline"}
              size={27}
              color={fit.lime}
            />
            <Text style={[f.sectionTitle, { flex: 1 }]}>
              {schedule.allDone
                ? "Haftanın hedef seansları tamamlandı!"
                : "Haftalık planım"}
            </Text>
          </View>
          <Text style={f.body}>
            {schedule.completed}/{schedule.total} seans tamamlandı
          </Text>
          <ProgressBar
            value={schedule.total ? schedule.completed / schedule.total : 0}
            label="Haftalık seans ilerlemesi"
          />
          <View style={[f.row, { gap: 4 }]}>
            {schedule.days.map((day, index) => (
              <Pressable
                key={day.date}
                accessibilityRole="tab"
                accessibilityLabel={
                  day.date +
                  (day.sessions.length
                    ? ` · ${day.sessions.length} seans`
                    : " · Dinlenme")
                }
                accessibilityState={{ selected: visibleDate === day.date }}
                onPress={() => setSelectedDate(day.date)}
                hitSlop={2}
                style={{
                  flex: 1,
                  minHeight: 64,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  borderRadius: 12,
                  backgroundColor:
                    visibleDate === day.date ? fit.lime : fit.raised,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: visibleDate === day.date ? fit.bg : fit.muted,
                  }}
                >
                  {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][index]}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: visibleDate === day.date ? fit.bg : fit.text,
                  }}
                >
                  {Number(day.date.slice(8))}
                </Text>
                <View
                  style={{
                    height: 4,
                    width: 12,
                    borderRadius: 2,
                    backgroundColor: day.sessions.length
                      ? visibleDate === day.date
                        ? fit.bg
                        : fit.lime
                      : "transparent",
                  }}
                />
              </Pressable>
            ))}
          </View>
          {schedule.days
            .filter((day) => day.date === visibleDate)
            .map((day) => (
              <View
                key={day.date}
                style={{
                  gap: 7,
                  borderTopWidth: 1,
                  borderColor: fit.line,
                  paddingTop: 10,
                }}
              >
                <View style={f.row}>
                  <Text
                    style={[
                      f.body,
                      {
                        width: 40,
                        color: day.date === today ? fit.lime : fit.text,
                      },
                    ]}
                  >
                    {
                      ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][
                        schedule.days.findIndex(
                          (item) => item.date === day.date,
                        )
                      ]
                    }
                  </Text>
                  <Text style={f.muted}>
                    {day.date.slice(5)}
                    {day.date === today ? " · Bugün" : ""}
                    {!day.sessions.length ? " · Dinlenme" : ""}
                  </Text>
                </View>
                {day.sessions.map((session) => (
                  <Pressable
                    disabled={busy}
                    key={session.plan.id + session.day.id}
                    accessibilityRole="button"
                    onPress={() =>
                      void open(session.plan, session.day.id, day.date)
                    }
                    style={[f.row, { paddingVertical: 8 }]}
                  >
                    <Ionicons
                      name={
                        session.workout?.state === "completed"
                          ? "checkmark-circle"
                          : day.date < today && !session.workout
                            ? "alert-circle-outline"
                            : "chevron-forward"
                      }
                      color={
                        session.workout?.state === "completed"
                          ? fit.lime
                          : fit.muted
                      }
                      size={22}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={f.body}>
                        {sessionDisplayName(
                          session.workout?.snapshot ?? session.day,
                          day.date,
                          library.data,
                        )}
                      </Text>
                      <Text numberOfLines={2} style={f.muted}>
                        {session.plan.content.name}
                      </Text>
                      <Text style={f.muted}>
                        {session.workout
                          ? workoutLabels[session.workout.state]
                          : day.date < today
                            ? "Kaçırılan seans"
                            : "Planlandı"}
                      </Text>
                      {session.day.exercises.slice(0, 4).map((target) => (
                        <Text key={target.id} style={f.muted}>
                          {library.data?.find(
                            (e) => e.id === target.exercise_id,
                          )?.name ??
                            target.name ??
                            "Egzersiz"}{" "}
                          · {target.sets} set
                        </Text>
                      ))}
                      {session.day.exercises.length > 4 && (
                        <Text style={f.muted}>
                          +{session.day.exercises.length - 4} egzersiz
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
        </FitCard>
      )}
      {schedule.missed && (
        <FitCard>
          <View style={f.row}>
            <Ionicons name="calendar-outline" color={fit.orange} size={28} />
            <Text style={[f.sectionTitle, { flex: 1 }]}>
              Kaçırılan antrenmanın var
            </Text>
          </View>
          <Text style={f.body}>
            {sessionDisplayName(
              schedule.missed.day,
              schedule.missed.date,
              library.data,
            )}{" "}
            · {calendarLabel(schedule.missed.date)}
          </Text>
          <Text style={f.muted}>
            Geçmişi değiştirmeden bir telafi seansı planlayabilirsin.
          </Text>
          <FitButton
            title={busy ? "Hazırlanıyor…" : "Bugün telafi et"}
            disabled={busy}
            onPress={() => confirmRecovery(today)}
          />
          {end.toISOString().slice(0, 10) !== today && (
            <FitButton
              title="Hafta sonuna telafi planla"
              secondary
              disabled={busy}
              onPress={() => confirmRecovery(end.toISOString().slice(0, 10))}
            />
          )}
          <FitButton
            title="Atlandı olarak işaretle"
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Bu seansı atla?",
                "Geçmiş seans ve hedefler korunur; tamamlanmış sayılmaz.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  { text: "Atla", onPress: () => void skip() },
                ],
              )
            }
          />
        </FitCard>
      )}
    </View>
  );
}
