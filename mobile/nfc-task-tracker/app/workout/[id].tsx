import { KeyboardFrame } from "@/components/keyboard-frame";
import {
  actualSessionDate,
  calendarLabel,
  sessionDisplayName,
  sessionTimezone,
} from "@/lib/session-presentation";
import { coachingRequest } from "@/lib/tenant-console";
import {
  CoachText as Text,
  brand,
  CoachButton,
  CoachField,
  coachStyle,
  workoutLabels,
} from "@/components/coaching-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Keyboard, Pressable, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import {
  FitButton,
  FitCard,
  FitChip,
  IconAction,
  ProgressBar,
  f,
  fit,
} from "@/components/fitness-ui";
import { MovementArt } from "@/components/fitness-art";
import {
  QuantityControl,
  WorkoutNfcSheet,
  PlanlessExerciseSheet,
  WorkoutClock,
  WorkoutCelebration,
} from "@/components/workout-controls";
import {
  durationLabel,
  measurementsLabel,
  setDraft,
  targetCompleted,
  workoutHighlights,
} from "@/lib/workout-experience";
import {
  workoutElapsedSeconds,
  workoutProgress,
} from "@/lib/athlete-presentation";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import {
  useCoaching,
  useCoachingWorkout,
  useCoachingLibrary,
} from "@/hooks/use-coaching";
import {
  coachingStore,
  resolveWorkoutConflict,
  syncCoaching,
} from "@/lib/coaching";
import { offlineChanged } from "@/lib/offline-sync";
import { localUuid, offlineStore } from "@/lib/offline-store";
import { nfcManager } from "@/lib/nfc-manager";
import {
  terminalStates,
  type CoachingOverview,
  type ActualSet,
  type Exercise,
  type Target,
  type WorkoutCommand,
} from "@/lib/coaching-types";
import { ExerciseSelector } from "@/components/exercise-selector";
export default function WorkoutScreen() {
  const {
    id,
    exercise: linkedExercise,
    method: linkedMethod,
  } = useLocalSearchParams<{
    id: string;
    exercise?: string;
    method?: string;
  }>();
  const { user } = useAuth();
  const query = useCoachingWorkout(id);
  const overview = useCoaching();
  const library = useCoachingLibrary();
  const [setForm, setSetForm] = useState(false);
  const [infoTab, setInfoTab] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [nfcMatches, setNfcMatches] = useState<Target[]>([]);
  const [equipmentName, setEquipmentName] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const w = query.data;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const refreshRequest = useRef<{
    request_id: string;
    expected_version: number;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selector, setSelector] = useState(false);
  const [extraExercise, setExtraExercise] = useState<Exercise | null>(null);
  const [extraSets, setExtraSets] = useState("3");
  const [editing, setEditing] = useState<ActualSet | null>(null);
  const [number, setNumber] = useState("1");
  const [reps, setReps] = useState("");
  const [kg, setKg] = useState("");
  const [seconds, setSeconds] = useState("");
  const [meters, setMeters] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [method, setMethod] = useState<"manual" | "nfc">("manual");
  const [scanning, setScanning] = useState(false);
  const scan = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      scan.current?.abort();
    };
  }, []);
  const all = w ? [...w.snapshot.exercises, ...w.actual.added] : [];
  const exercises = w
    ? w.actual.order
        .map((key) => all.find((e) => e.id === key)!)
        .filter(Boolean)
    : [];
  const current = all.find((e) => e.id === selected);
  const terminal = w ? terminalStates.has(w.state) : false;
  const command = async (
    action: WorkoutCommand["action"],
    data: Partial<WorkoutCommand> = {},
  ) => {
    if (!w || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await coachingStore.command(user!.id, w.id, {
        request_id: localUuid(),
        occurred_at: new Date().toISOString(),
        expected_version: w.version,
        action,
        ...data,
      });
      offlineChanged(user!.id);
      setNotice("");
      void syncCoaching(user!.id).catch(() => undefined);
      await query.refetch();
      if (action === "finish") setCelebrate(true);
      if (
        action === "finish" ||
        (action === "set" && data.actual_set?.status === "completed")
      )
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const refreshPlan = async () => {
    if (!w || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await syncCoaching(user!.id);
      const jobs = await coachingStore.jobs(user!.id);
      if (jobs.some((j) => j.workout_id === w.id && j.state !== "resolved"))
        throw new Error("Önce bekleyen antrenman kayıtlarını eşitle.");
      if (
        !refreshRequest.current ||
        refreshRequest.current.expected_version !== w.version
      )
        refreshRequest.current = {
          request_id: localUuid(),
          expected_version: w.version,
        };
      await coachingRequest(
        user!.id,
        `/workouts/${w.id}/refresh-plan`,
        refreshRequest.current,
      );
      const current = await coachingRequest<CoachingOverview>(
        user!.id,
        "/overview",
      );
      await coachingStore.saveOverview(user!.id, current);
      offlineChanged(user!.id);
      refreshRequest.current = null;
      setNotice("Gelecek seansın hedefleri güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const select = useCallback(
    (e: Target, old?: ActualSet) => {
      setSelected(e.id);
      setEditing(old ?? null);
      const draft = setDraft(w!, e, old);
      setNumber(String(draft.number));
      setReps(draft.values.reps);
      setKg(draft.values.kg);
      setSeconds(draft.values.seconds);
      setMeters(draft.values.meters);
      setSetForm(!!old);
      setInfoTab(false);
      setNotes(old?.notes ?? "");
      setMethod(old?.method ?? "manual");
    },
    [w],
  );
  const noteInitialized = useRef("");
  useEffect(() => {
    if (!w || noteInitialized.current === w.id) return;
    noteInitialized.current = w.id;
    setSessionNote(w.actual.notes);
    setNotice("");
    setError("");
    setSelected(null);
    setSetForm(false);
    setEditing(null);
    setCelebrate(false);
  }, [w]);
  const handledLink = useRef("");
  useEffect(() => {
    const key = id + ":" + linkedExercise;
    if (w && linkedExercise && handledLink.current !== key) {
      const e = [...w.snapshot.exercises, ...w.actual.added].find(
        (e) => e.id === linkedExercise,
      );
      if (e) {
        select(e);
        setMethod(linkedMethod === "nfc" ? "nfc" : "manual");
        setSetForm(true);
        handledLink.current = key;
      }
    }
  }, [w, id, linkedExercise, linkedMethod, select]);
  const record = (skipped = false) => {
    const value = (s: string) =>
      s.trim() === "" ? null : Number(s.replace(",", "."));
    if (!w || !current) return;
    void command("set", {
      actual_set: {
        id: editing?.id ?? localUuid(),
        exercise_key: current.id,
        set_number: Number(number),
        reps: value(reps),
        kg: value(kg),
        seconds: value(seconds),
        meters: value(meters),
        occurred_at: editing?.occurred_at ?? new Date().toISOString(),
        method,
        status: skipped ? "skipped" : "completed",
        notes,
      },
    }).then((ok) => {
      if (ok) {
        Keyboard.dismiss();
        const progress = workoutProgress(ok);
        const isPlanned = ok.snapshot.exercises.some(
          (e) => e.id === current.id,
        );
        setNotice(
          skipped
            ? "Set atlandı · Diğer setlerle devam edebilirsin."
            : `${current.name ?? "Egzersiz"} · ${number}. set kaydedildi · ${isPlanned ? `${progress.completed}/${progress.total} hedef set · ${Math.max(0, progress.total - progress.completed)} set kaldı` : "Plan dışı aktivite; program hedefini değiştirmez"}.`,
        );
        setSetForm(false);
        setEditing(null);
      }
    });
  };
  const add = (e: Exercise, count: number) => {
    void command("add_exercise", {
      exercise: {
        id: localUuid(),
        exercise_id: e.id,
        name: e.name,
        measurements: e.measurements,
        sets: count,
        reps: e.measurements.includes("reps") ? 10 : null,
        seconds: e.measurements.includes("seconds") ? 30 : null,
        meters: e.measurements.includes("meters") ? 100 : null,
        kg: e.measurements.includes("kg") ? 0 : null,
        rest_seconds: 60,
        notes: "",
      },
    }).then((next) => {
      if (!next) return;
      const added = next.actual.added[next.actual.added.length - 1];
      setExtraExercise(null);
      select(added);
    });
  };
  const read = async () => {
    if (scanning || !w) return;
    setScanning(true);
    setError("");
    setNotice("Kart okunuyor…");
    const control = new AbortController();
    scan.current = control;
    try {
      if (!(await nfcManager.init()) || !(await nfcManager.checkEnabled()))
        throw new Error("NFC açık değil. Egzersizi elle seçebilirsin.");
      const tag = await nfcManager.readTag(control.signal);
      if (control.signal.aborted || !alive.current) return;
      const local = tag ? await offlineStore.scan(user!.id, tag.id) : null;
      if (control.signal.aborted || !alive.current) return;
      if (local?.result === "join_request_pending")
        throw new Error("Kartla işlem için tesis üyeliğin onaylanmış olmalı.");
      const equipment = overview.data?.equipment?.find(
        (e) => e.tag_id === local?.tag?.id && e.active,
      );
      if (!equipment)
        throw new Error(
          "Bu kart için ekipman/egzersiz eşleşmesi indirilmemiş. Elle seçim yapabilir veya tesis yöneticisine sorabilirsin.",
        );
      const matches = all.filter((e) =>
        equipment.exercise_ids.includes(e.exercise_id),
      );
      if (!matches.length)
        throw new Error(
          "Ekipman bu antrenmanda yok. İstersen plansız egzersiz ekle.",
        );
      setNotice("");
      setEquipmentName(equipment.name);
      setNfcMatches(matches);
    } catch (e) {
      if (alive.current && !control.signal.aborted)
        setError((e as Error).message);
    } finally {
      if (alive.current) setScanning(false);
    }
  };
  if (!w)
    return (
      <SafeAreaView style={[coachStyle.page, { padding: 18, gap: 16 }]}>
        <Text style={coachStyle.text}>
          {query.isPending
            ? "Antrenman yükleniyor…"
            : "Antrenman bu telefonda bulunamadı."}
        </Text>
        <CoachButton
          title="Programıma dön"
          onPress={() => router.replace("/(drawer)/plans" as never)}
        />
      </SafeAreaView>
    );
  const progress = workoutProgress(w);
  const elapsed = workoutElapsedSeconds(w);
  const detail = library.data?.find((e) => e.id === current?.exercise_id);
  const highlights = terminal
    ? workoutHighlights(w, overview.data?.workouts ?? [])
    : [];
  const closeDetail = () => {
    setSelected(null);
    setSetForm(false);
    setEditing(null);
  };
  const finish = (partial = false) =>
    Alert.alert(
      partial ? "Kısmi tamamla?" : "Antrenmanı tamamla?",
      "Kaydettiğin setler korunur. Tamamlanan antrenmana yeni set eklenmez.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Tamamla", onPress: () => void command("finish", { partial }) },
      ],
    );
  const startForm = () => {
    if (!current) return;
    select(current);
    setSetForm(true);
  };
  const stopScan = () => {
    scan.current?.abort();
    void nfcManager.cancelScan();
    setScanning(false);
    setNfcMatches([]);
  };
  const header = (
    <View style={{ gap: 16 }}>
      <View style={f.row}>
        <IconAction
          icon="arrow-back"
          label="Geri"
          onPress={() =>
            current
              ? setForm
                ? setSetForm(false)
                : closeDetail()
              : router.replace("/(drawer)/plans" as never)
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={f.eyebrow}>NFCFit</Text>
          <Text style={f.muted}>
            Planlanan: {calendarLabel(w.scheduled_date)} ·{" "}
            {workoutLabels[w.state]}
            {actualSessionDate(w, sessionTimezone(overview.data?.timezone))
              ? ` · Yapılan: ${calendarLabel(actualSessionDate(w, sessionTimezone(overview.data?.timezone))!)}`
              : ""}
          </Text>
        </View>
        <WorkoutClock workout={w} />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={coachStyle.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={f.body}>
          {notice}
        </Text>
      )}
      <Text
        style={{
          color: w.sync_state === "rejected" ? brand.danger : fit.muted,
          fontSize: 12,
        }}
      >
        {w.sync_state === "synced"
          ? "Sunucuya eşitlendi"
          : w.sync_state === "rejected"
            ? "Uzlaştırma gerekli: " + w.sync_error
            : "Telefona kaydedildi · Eşitleme bekliyor"}
      </Text>
      {w.sync_state === "rejected" && (
        <FitCard>
          <Text style={f.sectionTitle}>Yerel kayıtların korunuyor</Text>
          <Text style={f.muted}>
            Sunucudaki sürüme geçmek yerel kaydı arşivler. Çakışan setler
            otomatik birleştirilmez.
          </Text>
          <FitButton
            title="Sunucu sürümünü aç"
            secondary
            onPress={() =>
              Alert.alert(
                "Sunucu sürümünü kullan",
                "Yerel veriler arşivde korunur; çalışma görünümü sunucudaki kayıtla değiştirilir.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Devam et",
                    onPress: () =>
                      void resolveWorkoutConflict(user!.id, w.id)
                        .then((result) =>
                          router.replace(`/workout/${result.id}` as never),
                        )
                        .catch((e) => setError(e.message)),
                  },
                ],
              )
            }
          />
        </FitCard>
      )}
      {terminal ? (
        <>
          <WorkoutCelebration visible={celebrate} />
          <View style={{ alignItems: "center", gap: 14, paddingVertical: 18 }}>
            <Ionicons
              name={
                w.state === "completed"
                  ? "trophy-outline"
                  : w.state === "partial"
                    ? "checkmark-circle-outline"
                    : "archive-outline"
              }
              color={fit.lime}
              size={78}
            />
            <Text style={[f.heading, { textAlign: "center" }]}>
              {w.state === "completed"
                ? "Antrenman tamamlandı!"
                : w.state === "partial"
                  ? "Kısmi antrenman kaydedildi"
                  : workoutLabels[w.state]}
            </Text>
            <Text style={f.sectionTitle}>
              {sessionDisplayName(w.snapshot, w.scheduled_date, library.data)}
            </Text>
            <Text style={f.muted}>
              {progress.exercises}/{progress.exerciseCount} egzersizin hedef
              setleri tamamlandı
            </Text>
          </View>
          <View style={[f.row, { flexWrap: "wrap" }]}>
            <FitCard>
              <Text style={f.heading}>
                {w.actual.sets.filter((s) => s.status === "completed").length}
              </Text>
              <Text style={f.muted}>Kaydedilen set</Text>
            </FitCard>
            <FitCard>
              <Text style={f.heading}>{durationLabel(elapsed)}</Text>
              <Text style={f.muted}>Aktif süre</Text>
            </FitCard>
          </View>
          {!!highlights.length && (
            <FitCard>
              <Text style={f.sectionTitle}>Öne çıkan gelişim</Text>
              {highlights.map((h) => (
                <Text key={h.id} style={f.body}>
                  {h.name} · +{h.delta} kg · {h.kg} kg
                </Text>
              ))}
              <Text style={f.muted}>
                Önceki kayıtlara göre en yüksek ağırlık karşılaştırmasıdır.
              </Text>
            </FitCard>
          )}
          <FitButton
            title="İlerlememi gör"
            icon="stats-chart"
            onPress={() => router.push("/progress" as never)}
          />
          <FitButton
            title="Programıma dön"
            secondary
            onPress={() => router.replace("/(drawer)/plans" as never)}
          />
          <FitButton
            title={advanced ? "Set geçmişini kapat" : "Set geçmişini gör"}
            secondary
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced &&
            exercises.map((target) => (
              <FitCard key={target.id}>
                <Text style={f.sectionTitle}>
                  {target.name ?? target.exercise_id}
                </Text>
                {w.actual.sets
                  .filter((set) => set.exercise_key === target.id)
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((set) => (
                    <Text key={set.id} style={f.body}>
                      {set.set_number}. set ·{" "}
                      {set.status === "skipped"
                        ? "Atlandı"
                        : measurementsLabel(set)}
                      {set.notes ? " · " + set.notes : ""}
                    </Text>
                  ))}
              </FitCard>
            ))}
          <Text style={f.muted}>
            Gerçekleşen kayıtlar ilerleme raporlarına yansır. Eksik setler
            tamamlanmış sayılmaz.
          </Text>
        </>
      ) : w.state === "paused" ? (
        <>
          <View style={{ alignItems: "center", gap: 18, paddingVertical: 30 }}>
            <Ionicons name="pause-circle-outline" color={fit.lime} size={84} />
            <Text style={f.heading}>Antrenman duraklatıldı</Text>
            <Text style={f.heading}>{durationLabel(elapsed)}</Text>
            <Text style={f.muted}>
              Mola süresi aktif süreye eklenmez. Kaydettiğin setler bu telefonda
              korunuyor.
            </Text>
          </View>
          <FitCard>
            <Text style={f.sectionTitle}>
              {sessionDisplayName(w.snapshot, w.scheduled_date, library.data)}
            </Text>
            <Text style={f.body}>
              {progress.completed}/{progress.total} hedef set ·{" "}
              {progress.exercises}/{progress.exerciseCount} egzersiz
            </Text>
            <ProgressBar value={progress.ratio} label="Antrenman ilerlemesi" />
          </FitCard>
          <FitButton
            title="Devam et"
            icon="play"
            disabled={busy}
            onPress={() => void command("resume")}
          />
          <FitButton
            title="Eksik setlerle bitir"
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Antrenmanı bitir?",
                "Önce devam ettirilir, ardından tamamlanma durumu hesaplanır.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Devam et ve bitir",
                    onPress: () =>
                      void (async () => {
                        const resumed = await command("resume");
                        if (!resumed || guard.current) return;
                        guard.current = true;
                        setBusy(true);
                        try {
                          await coachingStore.command(user!.id, w.id, {
                            request_id: localUuid(),
                            occurred_at: new Date().toISOString(),
                            expected_version: resumed.version,
                            action: "finish",
                            partial: true,
                          });
                          offlineChanged(user!.id);
                          await query.refetch();
                          setCelebrate(true);
                          void Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success,
                          ).catch(() => undefined);
                          void syncCoaching(user!.id).catch(() => undefined);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          guard.current = false;
                          setBusy(false);
                        }
                      })(),
                  },
                ],
              )
            }
          />
        </>
      ) : current ? (
        <>
          <Text style={f.eyebrow}>
            {setForm ? "SET KAYDI" : "EGZERSİZ DETAYI"}
          </Text>
          <Text style={f.heading}>{current.name ?? current.exercise_id}</Text>
          {!setForm && (
            <View style={[f.card, { alignItems: "center", padding: 4 }]}>
              <MovementArt size={150} muscle={detail?.muscle ?? "other"} />
            </View>
          )}
          <Text style={f.muted}>
            {current.sets} set · {measurementsLabel(current)}
          </Text>
          {w.state === "not_started" && (
            <FitButton
              title="Antrenmanı başlat"
              icon="play"
              disabled={busy}
              onPress={() => void command("start")}
            />
          )}
          {setForm ? (
            <FitCard accent>
              <Text style={f.sectionTitle}>
                {editing ? "Seti düzenle" : "Seti tamamla"} · {number}. set
              </Text>
              <Text style={f.muted}>
                {method === "nfc" ? "NFC ile eşleşti. " : ""}Son set veya hedef
                değerleri hazırlandı. Gerçekleşen miktarı kontrol et.
              </Text>
              {(
                current.measurements ?? ["reps", "kg", "seconds", "meters"]
              ).map((key) =>
                ({
                  kg: "Ağırlık (kg)",
                  reps: "Tekrar",
                  seconds: "Süre (sn)",
                  meters: "Mesafe (m)",
                })[key] ? (
                  <QuantityControl
                    key={key}
                    label={
                      {
                        kg: "Ağırlık (kg)",
                        reps: "Tekrar",
                        seconds: "Süre (sn)",
                        meters: "Mesafe (m)",
                      }[key as "kg"]
                    }
                    value={{ kg, reps, seconds, meters }[key as "kg"]}
                    onChange={
                      {
                        kg: setKg,
                        reps: setReps,
                        seconds: setSeconds,
                        meters: setMeters,
                      }[key as "kg"]
                    }
                    step={
                      key === "kg"
                        ? 2.5
                        : key === "seconds"
                          ? 5
                          : key === "meters"
                            ? 10
                            : 1
                    }
                    disabled={busy}
                  />
                ) : null,
              )}
              <CoachField label="Set notu" value={notes} onChange={setNotes} />
              <FitButton
                title="Bu seti atla"
                secondary
                disabled={busy}
                onPress={() => record(true)}
              />
            </FitCard>
          ) : (
            <>
              <View style={f.row}>
                <FitChip
                  label="Setler"
                  active={!infoTab}
                  onPress={() => setInfoTab(false)}
                />
                <FitChip
                  label="Bilgi"
                  active={infoTab}
                  onPress={() => setInfoTab(true)}
                />
              </View>
              {infoTab ? (
                <FitCard>
                  <Text style={f.body}>
                    {detail?.description ??
                      current.notes ??
                      "Egzersiz bilgisi henüz indirilmedi."}
                  </Text>
                  {detail?.instructions.map((instruction, i) => (
                    <Text key={i} style={f.muted}>
                      {i + 1}. {instruction}
                    </Text>
                  ))}
                  {detail?.safety.map((text, i) => (
                    <Text
                      key={"s" + i}
                      style={[f.muted, { color: fit.orange }]}
                    >
                      {text}
                    </Text>
                  ))}
                </FitCard>
              ) : (
                <FitCard>
                  {Array.from(
                    {
                      length: Math.max(
                        current.sets,
                        ...w.actual.sets
                          .filter((s) => s.exercise_key === current.id)
                          .map((s) => s.set_number),
                      ),
                    },
                    (_, i) => i + 1,
                  ).map((slot) => {
                    const saved = w.actual.sets.find(
                      (s) =>
                        s.exercise_key === current.id && s.set_number === slot,
                    );
                    return (
                      <Pressable
                        key={slot}
                        disabled={busy || w.state !== "in_progress"}
                        accessibilityRole="button"
                        accessibilityLabel={`${slot}. set · ${saved ? (saved.status === "skipped" ? "Atlandı" : measurementsLabel(saved)) : "Henüz kaydedilmedi"}`}
                        onPress={() => {
                          select(current, saved);
                          setNumber(String(slot));
                          setSetForm(true);
                        }}
                        style={[
                          f.row,
                          {
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderColor: fit.line,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            saved?.status === "completed"
                              ? "checkmark-circle"
                              : saved?.status === "skipped"
                                ? "remove-circle-outline"
                                : "ellipse-outline"
                          }
                          size={25}
                          color={
                            saved?.status === "completed" ? fit.lime : fit.muted
                          }
                        />
                        <Text style={f.body}>{slot}. Set</Text>
                        <Text
                          style={[f.muted, { flex: 1, textAlign: "right" }]}
                        >
                          {saved
                            ? saved.status === "skipped"
                              ? "Atlandı"
                              : measurementsLabel(saved)
                            : measurementsLabel(current)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </FitCard>
              )}
              <Text style={f.muted}>
                Dinlenme önerisi: {current.rest_seconds} sn
              </Text>
              <FitButton
                title="NFC tara ve set kaydet"
                icon="radio-outline"
                disabled={busy || scanning || w.state !== "in_progress"}
                onPress={() => void read()}
              />
              <FitButton
                title="Elle set gir"
                secondary
                disabled={busy || w.state !== "in_progress"}
                onPress={startForm}
              />
              <FitButton
                title="Egzersiz listesine dön"
                secondary
                onPress={closeDetail}
              />
              <FitButton
                title="Egzersizi atla"
                secondary
                disabled={busy || w.state !== "in_progress"}
                onPress={() =>
                  Alert.alert(
                    "Egzersizi atla?",
                    "Hedef tamamlanmış sayılmaz; kaydedilen setler korunur.",
                    [
                      { text: "Vazgeç", style: "cancel" },
                      {
                        text: "Atla",
                        onPress: () =>
                          void command("skip_exercise", {
                            exercise_key: current.id,
                          }).then((ok) => {
                            if (ok) closeDetail();
                          }),
                      },
                    ],
                  )
                }
              />
            </>
          )}
        </>
      ) : (
        <>
          <Text style={f.heading}>
            {sessionDisplayName(w.snapshot, w.scheduled_date, library.data)}
          </Text>
          <Text style={f.muted}>
            {progress.exercises}/{progress.exerciseCount} egzersiz ·{" "}
            {progress.completed}/{progress.total} hedef set tamamlandı
          </Text>
          <ProgressBar value={progress.ratio} label="Hedef set ilerlemesi" />
          {w.state === "not_started" ? (
            <FitButton
              title="Antrenmanı başlat"
              icon="play"
              disabled={busy}
              onPress={() => void command("start")}
            />
          ) : (
            <View style={f.row}>
              <View style={{ flex: 1 }}>
                <FitButton
                  title="NFC tara"
                  icon="radio-outline"
                  disabled={busy || scanning}
                  onPress={() => void read()}
                />
              </View>
              <IconAction
                icon="pause"
                label="Duraklat"
                onPress={() => {
                  if (!busy) void command("pause");
                }}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
  return (
    <SafeAreaView style={f.page}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardFrame style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={terminal || current || w.state === "paused" ? [] : exercises}
          keyExtractor={(e) => e.id}
          extraData={w}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[f.content, { gap: 10, paddingBottom: 35 }]}
          ListHeaderComponent={header}
          renderItem={({ item: e, index }) => {
            const completed = targetCompleted(w, e);
            const skipped = w.actual.skipped.includes(e.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${e.name ?? e.exercise_id} · ${completed}/${e.sets} hedef set${skipped ? " · Atlandı" : ""}`}
                onPress={() => select(e)}
                style={[
                  f.card,
                  { padding: 14 },
                  completed >= e.sets && { borderColor: fit.lime },
                ]}
              >
                <View style={f.row}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        completed >= e.sets ? fit.lime : fit.raised,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "800",
                        color: completed >= e.sets ? fit.bg : fit.text,
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={f.body}>{e.name ?? e.exercise_id}</Text>
                    <Text style={f.muted}>
                      {completed}/{e.sets} hedef set
                      {skipped ? " · Atlandı" : ""}
                      {w.actual.added.some((a) => a.id === e.id)
                        ? " · Plan dışı"
                        : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      completed >= e.sets
                        ? "checkmark-circle"
                        : "chevron-forward"
                    }
                    size={24}
                    color={completed >= e.sets ? fit.lime : fit.muted}
                  />
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            <View style={{ gap: 14, paddingTop: 12 }}>
              {!terminal && !current && w.state === "in_progress" && (
                <>
                  <FitButton
                    title="Plan dışı egzersiz ekle"
                    secondary
                    icon="add"
                    disabled={busy}
                    onPress={() => setSelector(true)}
                  />
                  <Text style={f.muted}>
                    Bu antrenmana eklenir; programının hedeflerini değiştirmez.
                  </Text>
                  <FitButton
                    title="Antrenmanı tamamla"
                    icon="checkmark"
                    disabled={busy}
                    onPress={() => finish()}
                  />
                  <FitButton
                    title="Eksik setlerle bitir"
                    secondary
                    disabled={busy}
                    onPress={() => finish(true)}
                  />
                </>
              )}
              {!terminal && !current && (
                <>
                  <FitButton
                    title={
                      advanced
                        ? "Diğer seçenekleri kapat"
                        : "Notlar ve diğer seçenekler"
                    }
                    secondary
                    onPress={() => setAdvanced(!advanced)}
                  />
                  {advanced && (
                    <FitCard>
                      {w.state === "in_progress" && (
                        <>
                          <CoachField
                            label="Antrenman notu"
                            value={sessionNote}
                            onChange={setSessionNote}
                            multiline
                          />
                          <FitButton
                            title="Notu kaydet"
                            secondary
                            disabled={busy}
                            onPress={() =>
                              void command("note", { notes: sessionNote })
                            }
                          />
                        </>
                      )}
                      {w.state === "not_started" &&
                        overview.data?.plans.some(
                          (p) =>
                            p.id === w.plan_id && p.version > w.plan_version,
                        ) && (
                          <FitButton
                            title="Güncel plan hedeflerini al"
                            secondary
                            disabled={busy}
                            onPress={() => void refreshPlan()}
                          />
                        )}
                      <FitButton
                        title="Antrenmanı iptal et"
                        secondary
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            "Antrenmanı iptal et?",
                            "Kaydedilmiş setler geçmişte korunur.",
                            [
                              { text: "Vazgeç", style: "cancel" },
                              {
                                text: "İptal et",
                                onPress: () => void command("cancel"),
                              },
                            ],
                          )
                        }
                      />
                    </FitCard>
                  )}
                </>
              )}
              {!!w.actual.notes && (
                <Text style={f.muted}>{w.actual.notes}</Text>
              )}
              {!current && (
                <FitButton
                  title="Antrenörüne yaz"
                  secondary
                  onPress={() =>
                    router.push(
                      `/messages?context_type=workout&context_id=${w.id}` as never,
                    )
                  }
                />
              )}
            </View>
          }
        />
        {current && setForm && w.state === "in_progress" && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderColor: fit.line,
              backgroundColor: fit.bg,
            }}
          >
            <FitButton
              title={
                busy
                  ? "Telefona kaydediliyor…"
                  : editing
                    ? "Değişikliği kaydet"
                    : "Seti tamamla"
              }
              icon="checkmark"
              disabled={busy || w.sync_state === "rejected"}
              onPress={() => record()}
            />
          </View>
        )}
      </KeyboardFrame>
      <WorkoutNfcSheet
        scanning={scanning}
        matches={nfcMatches}
        equipment={equipmentName}
        onCancel={stopScan}
        onConfirm={(target) => {
          select(target);
          setMethod("nfc");
          setSetForm(true);
          setNfcMatches([]);
        }}
      />
      <PlanlessExerciseSheet
        name={extraExercise?.name ?? null}
        sets={extraSets}
        onChange={setExtraSets}
        onClose={() => setExtraExercise(null)}
        onConfirm={() => {
          if (extraExercise) add(extraExercise, Number(extraSets));
        }}
        busy={busy}
        error={error}
      />
      {selector && (
        <ExerciseSelector
          onClose={() => setSelector(false)}
          onSelect={(e) => {
            setSelector(false);
            setExtraSets("3");
            setExtraExercise(e);
            setError("");
          }}
        />
      )}
    </SafeAreaView>
  );
}
