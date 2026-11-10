import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { CoachText as Text } from "./coaching-ui";
import { fit } from "@/constants/fitness";
export { fit } from "@/constants/fitness";

export type FitnessIcon = keyof typeof Ionicons.glyphMap;
export function BrandHeader({ showProfile = true }: { showProfile?: boolean }) {
  return (
    <View style={f.header}>
      <Text accessibilityLabel="NFCFit" style={[f.logo, { color: fit.text }]}>
        NFC<Text style={{ color: fit.lime }}>Fit</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 9 }}>
        {showProfile && (
          <IconAction
            icon="person-outline"
            label="Profil ve ayarlar"
            onPress={() => router.push("/(drawer)/settings" as never)}
          />
        )}
        <IconAction
          icon="notifications-outline"
          label="Mesajlar ve bildirimler"
          onPress={() => router.push("/messages" as never)}
        />
      </View>
    </View>
  );
}
export function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: FitnessIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [f.iconAction, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Ionicons name={icon} size={21} color={fit.text} />
    </Pressable>
  );
}
export function FitSection({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={f.sectionHeading}>
      <Text style={f.sectionTitle}>{title}</Text>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={f.link}>{action} →</Text>
        </Pressable>
      ) : action ? (
        <Text style={f.muted}>{action}</Text>
      ) : null}
    </View>
  );
}
export function FitButton({
  title,
  onPress,
  icon = "arrow-forward",
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  icon?: FitnessIcon;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        f.button,
        secondary && f.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={secondary ? fit.lime : fit.bg} />
      <Text style={[f.buttonText, { color: secondary ? fit.text : fit.bg }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function FitChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[f.chip, active && f.chipActive]}
    >
      <Text
        style={{
          color: active ? fit.bg : fit.text,
          fontSize: 13,
          fontWeight: active ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function FitCard({
  children,
  accent = false,
  compact = false,
}: {
  children: ReactNode;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      style={[f.card, accent && f.accent, compact && { padding: 14, gap: 8 }]}
    >
      {children}
    </View>
  );
}
export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  const bounded = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: bounded,
      duration: reduced ? 0 : 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [bounded, progress, reduced]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(bounded * 100) }}
      style={f.track}
    >
      <Animated.View
        style={[
          f.fill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}
export const f = StyleSheet.create({
  page: { flex: 1, backgroundColor: fit.bg },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 105,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  logo: {
    fontWeight: "900",
    fontSize: 29,
    fontStyle: "italic",
    letterSpacing: -1,
  },
  iconAction: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: fit.line,
    backgroundColor: fit.card,
  },
  heading: {
    fontSize: 26,
    color: fit.text,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  muted: { fontSize: 13, lineHeight: 20, color: fit.muted },
  body: { fontSize: 15, lineHeight: 22, color: fit.text },
  eyebrow: {
    fontSize: 11,
    color: fit.lime,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  card: {
    backgroundColor: fit.card,
    borderColor: fit.line,
    borderWidth: 1,
    borderRadius: 22,
    padding: 17,
    gap: 13,
  },
  accent: {
    borderColor: fit.lime,
    shadowColor: fit.lime,
    shadowOpacity: 0.13,
    shadowRadius: 15,
    elevation: 3,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: fit.text,
    flexShrink: 1,
  },
  link: { fontSize: 12, color: fit.lime, fontWeight: "800" },
  button: {
    minHeight: 52,
    backgroundColor: fit.lime,
    borderRadius: 15,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondary: {
    backgroundColor: fit.raised,
    borderWidth: 1,
    borderColor: fit.line,
  },
  buttonText: { fontWeight: "900", fontSize: 15, flexShrink: 1 },
  chip: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: fit.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: fit.card,
  },
  chipActive: { backgroundColor: fit.lime, borderColor: fit.lime },
  track: {
    height: 9,
    borderRadius: 8,
    backgroundColor: "#3A505E",
    overflow: "hidden",
  },
  fill: { height: 9, borderRadius: 8, backgroundColor: fit.lime },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { height: 1, backgroundColor: fit.line },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: fit.lime,
    backgroundColor: "#2A3B23",
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
