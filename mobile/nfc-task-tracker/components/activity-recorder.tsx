import { offlineStore } from "@/lib/offline-store";
import { offlineChanged, syncOffline } from "@/lib/offline-sync";
import { useMemberFitness } from "@/hooks/use-member-fitness";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  ManagementButton as Button,
  ManagementCard as Card,
  ManagementMessage as Message,
  ui,
  unitLabels,
} from "./management-ui";
import { ThemedText } from "./themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getSurfaceColors } from "@/constants/tasks";
import { claimGoalCelebration } from "@/lib/activity-submission";
import {
  ActivityIntent,
  goalProgress,
  localDay,
} from "@/lib/activity-workflow";
import { RecordedTenantActivity } from "@/lib/tenant-console";

export function ActivityRecorder({
  intent,
  onNext,
}: {
  intent: ActivityIntent;
  onNext?: () => void;
}) {
  const { user } = useAuth();
  const fitness = useMemberFitness();
  const palette = getSurfaceColors(useColorScheme());
  const [quantity, setQuantity] = useState(String(intent.quantity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<RecordedTenantActivity | null>(null);
  const live = useQuery({
    queryKey: ["local-receipt", user?.id, saved?.request_id],
    queryFn: () =>
      offlineStore.receipt(user?.id ?? "", saved?.request_id ?? ""),
    enabled: Boolean(saved?.request_id && user),
    networkMode: "always",
    staleTime: Infinity,
  });
  const current = live.data ?? saved;
  const progress =
    fitness.data?.exercises.find(
      (row) =>
        row.exercise_id === current?.exercise_id && row.unit === current?.unit,
    ) ?? null;
  const progressBusy = fitness.isLoading;
  const progressError = fitness.isError;
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const number = Number(quantity.trim().replace(",", "."));
  const submit = async () => {
    if (
      lock.current ||
      !user?.id ||
      !Number.isFinite(number) ||
      number <= 0 ||
      number > 100000
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const receipt = await offlineStore.enqueue(
        user.id,
        intent.tagId,
        number,
        intent.exerciseId,
        undefined,
        false,
        intent.unit,
      );
      offlineChanged(user.id);
      if (alive.current) setSaved(receipt);
      void syncOffline(user.id).catch(() => undefined);
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error
            ? err.message
            : "Telefonuna kaydedilemedi. Depolama alanını kontrol edip tekrar dene.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  if (current) {
    const saved = current;
    const result = goalProgress(
      progress?.day.quantity ?? 0,
      progress?.target_quantity,
    );
    const crossed = Boolean(
      progress?.target_quantity &&
        result.complete &&
        progress.day.quantity - saved.quantity < progress.target_quantity &&
        localDay(new Date(saved.created_at)) === localDay(new Date()),
    );
    return (
      <Card
        title={
          saved.sync_state === "synced"
            ? "Egzersizin eşitlendi"
            : saved.sync_state === "rejected"
              ? "Kayıt kontrol edilmeli"
              : "Telefona kaydedildi"
        }
        hint={saved.tenant_name}
      >
        <ThemedText style={[ui.title, { color: palette.green }]}>
          {saved.quantity.toLocaleString("tr-TR")} {unitLabels[saved.unit]}{" "}
          {saved.exercise} eklendi
        </ThemedText>
        <Message
          error={saved.sync_state === "rejected"}
          message={
            saved.sync_state === "synced"
              ? "Sunucuya eşitlendi ✓"
              : saved.sync_state === "rejected"
                ? (saved.sync_error ??
                  "Sunucu bu kaydı kabul etmedi. Yerel kaydın korunuyor.")
                : "Eşitleme bekliyor. İnternet olmasa da kayıtların ve hedeflerin telefonunda çalışır."
          }
        />
        {saved.sync_state === "rejected" && (
          <Button
            title="Eşitleme ayrıntılarını gör"
            secondary
            onPress={() => router.push("/sync-status" as never)}
          />
        )}
        {crossed && saved.sync_state !== "rejected" && (
          <CompletionFeedback
            userId={user?.id ?? ""}
            exerciseId={saved.exercise_id}
            unit={saved.unit}
          />
        )}
        {progressBusy ? (
          <View style={ui.row}>
            <ActivityIndicator />
            <ThemedText>Hedef ilerlemen güncelleniyor…</ThemedText>
          </View>
        ) : progressError ? (
          <>
            <Message message="Egzersizin kaydedildi. Hedef ilerlemesi şu anda alınamadı." />
            <Button
              title="İlerlemeyi yenile"
              secondary
              onPress={() => void fitness.refetch()}
            />
          </>
        ) : progress?.target_quantity ? (
          <>
            <ThemedText>
              {result.complete
                ? "Günlük hedef tamamlandı ✓"
                : `Günlük hedefin %${result.percent} tamamlandı`}
            </ThemedText>
            <ThemedText>
              {progress.day.quantity.toLocaleString("tr-TR")} /{" "}
              {progress.target_quantity.toLocaleString("tr-TR")}{" "}
              {unitLabels[saved.unit]}
              {!result.complete
                ? ` · ${result.remaining.toLocaleString("tr-TR")} ${unitLabels[saved.unit]} kaldı`
                : ""}
            </ThemedText>
          </>
        ) : (
          <ThemedText>
            Bu egzersiz için günlük hedef belirleyerek ilerlemeni takip
            edebilirsin.
          </ThemedText>
        )}
        <Button
          title="Yeni kart okut"
          onPress={() =>
            onNext
              ? onNext()
              : router.replace({
                  pathname: "/(drawer)/nfc",
                  params: { start: String(Date.now()) },
                })
          }
        />
        <Button
          title="İlerlememi gör"
          secondary
          onPress={() => router.replace("/(drawer)/fitness")}
        />
      </Card>
    );
  }
  return (
    <Card
      title={intent.exercise}
      hint={`${intent.tenant} · Miktarı kontrol et ve kaydet.`}
    >
      <ThemedText style={ui.hint}>
        Günlük egzersiz kaydı · Günlük egzersiz hedefine eklenir. Programındaki
        bir seti tamamlamak için yukarıdaki plan eşleşmesini kullan.
      </ThemedText>
      <ThemedText style={ui.label}>
        Miktar ({unitLabels[intent.unit] ?? intent.unit})
      </ThemedText>
      <TextInput
        accessibilityLabel="Kaydedilecek miktar"
        value={quantity}
        onChangeText={setQuantity}
        editable={!busy}
        keyboardType="decimal-pad"
        style={[
          ui.input,
          {
            color: palette.text,
            borderColor: palette.border,
            backgroundColor: palette.cardRaised,
          },
        ]}
      />
      {error !== "" && <Message error message={error} />}
      {busy && (
        <View style={ui.row}>
          <ActivityIndicator color={palette.green} />
          <ThemedText>Telefonuna kaydediliyor…</ThemedText>
        </View>
      )}
      <Button
        title={busy ? "Telefona kaydediliyor…" : "Onayla ve kaydet"}
        disabled={
          busy || !Number.isFinite(number) || number <= 0 || number > 100000
        }
        onPress={() => void submit()}
      />
      <ThemedText style={ui.hint}>
        Önce telefonuna kaydedilir, bağlantı olduğunda hesabına eşitlenir.
      </ThemedText>
    </Card>
  );
}

function CompletionFeedback({
  userId,
  exerciseId,
  unit,
}: {
  userId: string;
  exerciseId: string;
  unit: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    const run = async () => {
      const claimed = await claimGoalCelebration(
        userId,
        localDay(new Date()),
        exerciseId,
        unit,
      );
      if (!claimed || !active) return;
      setVisible(true);
      AccessibilityInfo.announceForAccessibility("Günlük hedefini tamamladın!");
      const reduced = await AccessibilityInfo.isReduceMotionEnabled().catch(
        () => true,
      );
      if (!active) return;
      if (!reduced)
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
    };
    void run().catch(() => undefined);
    return () => {
      active = false;
      scale.stopAnimation();
    };
  }, [userId, exerciseId, unit, scale]);
  return visible ? (
    <Animated.View
      style={{ alignItems: "center", gap: 8, transform: [{ scale }] }}
    >
      <Ionicons name="checkmark-circle" size={60} color="#16803C" />
      <ThemedText>Günlük hedefini tamamladın!</ThemedText>
    </Animated.View>
  ) : null;
}
