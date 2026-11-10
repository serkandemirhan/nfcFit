import { durationLabel } from "@/lib/workout-experience";
import { workoutElapsedSeconds } from "@/lib/athlete-presentation";
import { useEffect, useState, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CoachText as Text } from "./coaching-ui";
import { FitButton, FitCard, f, fit } from "./fitness-ui";
import type { Target } from "@/lib/coaching-types";

export function QuantityControl({
  label,
  value,
  onChange,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  disabled?: boolean;
}) {
  const change = (direction: number) => {
    const current = Number(value.replace(",", "."));
    if (Number.isFinite(current))
      onChange(
        String(
          Math.max(0, Math.round((current + direction * step) * 100) / 100),
        ),
      );
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={f.body}>{label}</Text>
      <View
        style={[
          f.row,
          { backgroundColor: fit.raised, borderRadius: 16, padding: 6 },
        ]}
      >
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label + " azalt"}
          onPress={() => change(-1)}
          style={{
            minWidth: 48,
            minHeight: 52,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="remove" size={24} color={fit.text} />
        </Pressable>
        <TextInput
          editable={!disabled}
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChange}
          selectTextOnFocus
          style={{
            flex: 1,
            minHeight: 52,
            color: fit.text,
            fontSize: 26,
            textAlign: "center",
            fontWeight: "800",
          }}
        />
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label + " artır"}
          onPress={() => change(1)}
          style={{
            minWidth: 48,
            minHeight: 52,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={24} color={fit.lime} />
        </Pressable>
      </View>
    </View>
  );
}
export function WorkoutNfcSheet({
  scanning,
  matches,
  equipment,
  onCancel,
  onConfirm,
}: {
  scanning: boolean;
  matches: Target[];
  equipment: string;
  onCancel: () => void;
  onConfirm: (target: Target) => void;
}) {
  const [selected, setSelected] = useState("");
  useEffect(
    () => setSelected(matches.length === 1 ? matches[0].id : ""),
    [matches],
  );
  return (
    <Modal
      visible={scanning || matches.length > 0}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={f.page}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[
            f.content,
            { flexGrow: 1, justifyContent: "center" },
          ]}
        >
          <View style={{ alignItems: "center", gap: 20, paddingVertical: 25 }}>
            <Ionicons
              name={scanning ? "radio-outline" : "checkmark-circle-outline"}
              size={90}
              color={fit.lime}
            />
            <Text style={[f.heading, { textAlign: "center" }]}>
              {scanning ? "NFC etiketini tara" : "Egzersiz tanındı"}
            </Text>
            <Text style={[f.muted, { textAlign: "center" }]}>
              {scanning
                ? "Kartı telefonunun NFC antenine yaklaştır."
                : "Kart tanındı; henüz set kaydedilmedi."}
            </Text>
          </View>
          {scanning ? (
            <FitCard>
              <Text style={f.sectionTitle}>Etiket bulunamıyor mu?</Text>
              <Text style={f.muted}>
                NFC’nin açık olduğunu kontrol et. Kartın yerini yavaşça
                değiştir; kalın kılıfı çıkarmayı dene.
              </Text>
            </FitCard>
          ) : (
            <>
              <Text style={f.sectionTitle}>{equipment}</Text>
              <Text style={f.muted}>
                Bu kartla eşleşen egzersizi seç. Set değerlerini bir sonraki
                adımda onaylayacaksın.
              </Text>
              {matches.map((target) => (
                <Pressable
                  key={target.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected === target.id }}
                  onPress={() => setSelected(target.id)}
                  style={[f.card, selected === target.id && f.accent]}
                >
                  <View style={f.row}>
                    <Ionicons
                      name={
                        selected === target.id
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      color={fit.lime}
                      size={26}
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={f.sectionTitle}>
                        {target.name ?? target.exercise_id}
                      </Text>
                      <Text style={f.muted}>
                        {target.sets} set ·{" "}
                        {target.reps ?? target.seconds ?? target.meters ?? "—"}{" "}
                        {target.reps != null
                          ? "tekrar"
                          : target.seconds != null
                            ? "sn"
                            : "m"}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              <FitButton
                title="Set değerlerini kontrol et"
                icon="checkmark"
                disabled={!selected}
                onPress={() => {
                  const target = matches.find((t) => t.id === selected);
                  if (target) onConfirm(target);
                }}
              />
            </>
          )}
          <FitButton
            title={scanning ? "Okumayı durdur" : "Vazgeç"}
            secondary
            onPress={onCancel}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function PlanlessExerciseSheet({
  name,
  sets,
  onChange,
  onClose,
  onConfirm,
  busy,
  error,
}: {
  name: string | null;
  sets: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string;
}) {
  return (
    <Modal
      visible={!!name}
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={f.page}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[
            f.content,
            { flexGrow: 1, justifyContent: "center" },
          ]}
        >
          <Ionicons name="barbell-outline" color={fit.lime} size={64} />
          <Text style={f.heading}>Plan dışı egzersiz</Text>
          <FitCard>
            <Text style={f.sectionTitle}>{name}</Text>
            <Text style={f.muted}>
              Yalnızca bu antrenmana eklenir. Programının diğer günlerini ve
              hedeflerini değiştirmez. Gerçekleşen setlerini sonraki adımda
              kaydedebilirsin.
            </Text>
            <QuantityControl
              label="Set sayısı"
              value={sets}
              onChange={onChange}
              disabled={busy}
            />
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: fit.orange }}>
                {error}
              </Text>
            )}
            <FitButton
              title={busy ? "Telefona ekleniyor…" : "Ekleyip devam et"}
              icon="add"
              disabled={
                busy ||
                !Number.isInteger(Number(sets)) ||
                Number(sets) < 1 ||
                Number(sets) > 100
              }
              onPress={onConfirm}
            />
            <FitButton
              title="Vazgeç"
              secondary
              disabled={busy}
              onPress={onClose}
            />
          </FitCard>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function WorkoutClock({
  workout,
}: {
  workout: import("@/lib/coaching-types").Workout;
}) {
  const [, update] = useState(0);
  useEffect(() => {
    if (workout.state !== "in_progress") return;
    const timer = setInterval(() => update((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [workout.state]);
  return (
    <Text style={f.link}>{durationLabel(workoutElapsedSeconds(workout))}</Text>
  );
}
export function WorkoutCelebration({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    if (!visible) return;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive) return;
      if (reduced) opacity.setValue(1);
      else
        Animated.timing(opacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }).start();
    });
    return () => {
      alive = false;
      opacity.stopAnimation();
    };
  }, [visible, opacity]);
  if (!visible) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        opacity,
        alignItems: "center",
        padding: 12,
        transform: [
          {
            translateY: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      <Text style={f.link}>Emeğin kaydedildi. Bir adım daha ilerledin!</Text>
    </Animated.View>
  );
}
