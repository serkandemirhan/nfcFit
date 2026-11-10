import { KeyboardFrame } from "@/components/keyboard-frame";
import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  type TextProps,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav, bottomNavHeight } from "./app-bottom-nav";
export function CoachText({ children, style, ...props }: TextProps) {
  const { t } = useTranslation("coaching");
  return (
    <NativeText {...props} style={[{ color: "#F5F8FA" }, style]}>
      {Children.map(children, (child) =>
        typeof child === "string"
          ? t(child, { keySeparator: false, defaultValue: child })
          : child,
      )}
    </NativeText>
  );
}
const Text = CoachText;
export const brand = {
  background: "#10191F",
  card: "#19272F",
  raised: "#22343F",
  line: "#344752",
  text: "#F5F8FA",
  muted: "#A8BAC4",
  lime: "#C6FF23",
  danger: "#FFB1AD",
};
export const coachStyle = StyleSheet.create({
  page: { flex: 1, backgroundColor: brand.background },
  content: { padding: 18, gap: 16, paddingBottom: bottomNavHeight + 28 },
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.line,
    backgroundColor: brand.card,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: { fontSize: 26, fontWeight: "800", color: brand.text },
  sub: { fontSize: 18, fontWeight: "700", color: brand.text },
  text: { fontSize: 15, lineHeight: 22, color: brand.text },
  muted: { fontSize: 13, lineHeight: 20, color: brand.muted },
  field: {
    borderWidth: 1,
    borderColor: brand.line,
    borderRadius: 12,
    padding: 13,
    color: brand.text,
    backgroundColor: brand.raised,
    minHeight: 48,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  error: { color: brand.danger, fontSize: 14, lineHeight: 21 },
});
export function CoachButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  selected,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        coachStyle.button,
        {
          backgroundColor: secondary ? brand.raised : brand.lime,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? brand.text : brand.background,
          fontWeight: "700",
          fontSize: 14,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function CoachField({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
  compact = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  compact?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={coachStyle.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={brand.muted}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        style={[
          coachStyle.field,
          compact && { padding: 10, minHeight: 44 },
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
export function CoachCard({
  title,
  children,
  compact = false,
}: {
  compact?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={[coachStyle.card, compact && { padding: 14, gap: 8 }]}>
      {title && <Text style={coachStyle.sub}>{title}</Text>}
      {children}
    </View>
  );
}
export function CoachShell({
  title,
  children,
  drawer = false,
  bottom = false,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  drawer?: boolean;
  bottom?: boolean;
  compact?: boolean;
}) {
  const headerHeight = useHeaderHeight();
  return (
    <SafeAreaView
      edges={drawer ? [] : ["bottom", "left", "right"]}
      style={coachStyle.page}
    >
      <KeyboardFrame
        style={{ flex: 1 }}
        keyboardVerticalOffset={drawer ? 0 : headerHeight}
      >
        <Stack.Screen
          options={{
            title,
            headerShown: !drawer,
            headerStyle: { backgroundColor: brand.background },
            headerTintColor: brand.text,
          }}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            coachStyle.content,
            compact && { gap: 10, paddingTop: 12 },
          ]}
        >
          {drawer && (
            <Text accessibilityRole="header" style={coachStyle.title}>
              {title}
            </Text>
          )}
          {children}
        </ScrollView>
        {(drawer || bottom) && <AppBottomNav />}
      </KeyboardFrame>
    </SafeAreaView>
  );
}
export function CoachQueryState({pending,error,onRetry}:{pending:boolean;error:unknown;onRetry:()=>void}) {
  return pending ? <Text accessibilityLiveRegion="polite" style={coachStyle.muted}>Bilgiler yükleniyor…</Text> : error ? <CoachCard compact title="Bilgiler alınamadı"><Text accessibilityRole="alert" style={coachStyle.error}>{error instanceof Error ? error.message : 'Bağlantını kontrol et. Telefonundaki kayıtlar korunuyor.'}</Text><CoachButton title="Yeniden dene" secondary onPress={onRetry}/></CoachCard> : null;
}
export const workoutLabels: Record<string, string> = {
  not_started: "Başlamadı",
  in_progress: "Devam ediyor",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
  partial: "Kısmen tamamlandı",
  skipped: "Atlandı",
  cancelled: "İptal edildi",
};
export function percent(value: number | null | undefined) {
  return value == null ? "Yeterli veri yok" : `%${Math.round(value * 100)}`;
}
export function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
