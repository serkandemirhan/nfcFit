import { activeStaff } from "@/lib/console-access";
import { useState } from "react";
import { Alert, ScrollView, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { AccountTimezone } from "@/components/account-timezone";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CoachText as Text } from "@/components/coaching-ui";
import {
  BrandHeader,
  FitCard,
  FitButton,
  FitChip,
  f,
  fit,
  type FitnessIcon,
} from "@/components/fitness-ui";
import { useAuth } from "@/hooks/use-auth";
import {
  canOpenManagement,
  canOpenCoachArea,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";
import { useThemePreference } from "@/providers/color-scheme-provider";
import { roleLabels, statusLabels } from "@/components/management-ui";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const identity = useTenantIdentity();
  const profile = user as typeof user & {
    height_cm?: number;
    weight_kg?: number;
    age?: number;
  };
  const { mode, setMode } = useThemePreference();
  const [preferences, setPreferences] = useState(false);
  const [technical, setTechnical] = useState(false);
  const role = identity.data?.account.is_platform_admin
    ? "Platform yöneticisi"
    : [
        ...new Set(
          activeStaff(identity.data)
            .map((s) => roleLabels[s.role]) ?? [],
        ),
      ].join(", ") || "Üye";
  return (
    <SafeAreaView edges={["top"]} style={f.page}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={f.content}>
          <BrandHeader showProfile={false} />
          <Text style={f.heading}>Profil</Text>
          <FitCard>
            <Text style={f.sectionTitle}>{user?.name || "NFCFit hesabım"}</Text>
            <Text style={f.muted}>{user?.email ?? ""}</Text>
            <Text style={f.badge}>{role}</Text>
            <View style={[f.row, { flexWrap: "wrap" }]}>
              <Text style={f.muted}>
                Boy: {metric(profile?.height_cm, "cm")}
              </Text>
              <Text style={f.muted}>
                Kilo: {metric(profile?.weight_kg, "kg")}
              </Text>
              <Text style={f.muted}>Yaş: {profile?.age ?? "—"}</Text>
            </View>
          </FitCard>
          <FitCard><Text style={f.sectionTitle}>Kulüp üyeliklerim</Text>{identity.isPending?<Text style={f.muted}>Üyelikler kontrol ediliyor…</Text>:identity.error?<Text style={f.muted}>Üyelik bilgileri alınamadı. Aşağıdan hesap bilgilerini yenileyebilirsin.</Text>:!identity.data?.memberships.length?<Text style={f.muted}>Henüz bir kulüp üyeliğin yok. Kulübündeki kayıtlı kartı okutarak katılım isteği gönderebilirsin.</Text>:identity.data.memberships.map(m=><View key={m.tenant_id} style={{gap:4}}><Text style={f.body}>{m.tenant_name}</Text><Text style={f.muted}>{statusLabels[m.status]??m.status}</Text></View>)}</FitCard>
          {(canOpenManagement(identity.data) ||
            canOpenCoachArea(identity.data)) && (
            <FitCard>
              <Text style={f.sectionTitle}>Çalışma alanım</Text>
              {canOpenManagement(identity.data) && (
                <ProfileLink
                  title="Tesis yönetimi"
                  detail="Kartlar, egzersizler ve üyelikler"
                  icon="business-outline"
                  href="/(drawer)/management"
                />
              )}
              {canOpenCoachArea(identity.data) && (
                <ProfileLink
                  title="Antrenör alanı"
                  detail="Sporcular, şablonlar ve plan atamaları"
                  icon="people-outline"
                  href="/coach"
                />
              )}
            </FitCard>
          )}
          <FitCard>
            <Text style={f.sectionTitle}>Antrenman ve iyi yaşam</Text>
            <ProfileLink
              title="İyi yaşam"
              detail="Su, uyku, kahve ve ruh hali"
              icon="heart-outline"
              href="/(drawer)/wellness"
            />
            <ProfileLink
              title="Egzersiz kütüphanesi"
              detail="Hareketleri incele ve favorilerine ekle"
              icon="library-outline"
              href="/(drawer)/exercise-library"
            />
            <ProfileLink
              title="Hedeflerim"
              detail="Program hedefleri ve günlük egzersiz hedefleri"
              icon="flag-outline"
              href="/goals"
            />
            <ProfileLink
              title="Aktivite geçmişi"
              detail="Kartla ve elle kaydettiğin egzersizler"
              icon="time-outline"
              href="/(drawer)/history"
            />
            <ProfileLink
              title="Antrenör mesajları"
              detail="Program yorumları ve geri bildirimler"
              icon="chatbubbles-outline"
              href="/messages"
            />
          </FitCard>
          <FitCard>
            <FitButton
              title="Dil, görünüm ve saat dilimi"
              icon="options-outline"
              secondary
              onPress={() => setPreferences((v) => !v)}
            />
            {preferences && (
              <>
                <Text style={f.sectionTitle}>Dil</Text>
                <LanguageSwitcher />
                <Text style={f.sectionTitle}>Görünüm tercihi</Text>
                <View style={[f.row, { flexWrap: "wrap" }]}>
                  {(["system", "dark", "light"] as const).map((value, i) => (
                    <FitChip
                      key={value}
                      label={["Sistem", "Koyu", "Açık"][i]}
                      active={mode === value}
                      onPress={() => setMode(value)}
                    />
                  ))}
                </View>
                <AccountTimezone />
              </>
            )}
          </FitCard>
          <FitCard>
            <FitButton
              title="Eşitleme ve cihaz testleri"
              icon="construct-outline"
              secondary
              onPress={() => setTechnical((v) => !v)}
            />
            {technical && (
              <>
                <ProfileLink
                  title="Salon kayıtlarını eşitle"
                  detail="Çevrimdışı kart kayıtları ve bekleyen gönderimler"
                  icon="cloud-upload-outline"
                  href="/sync-status"
                />
                <ProfileLink
                  title="Antrenman kayıtlarını eşitle"
                  detail="Setler, programlar ve eşitleme sorunları"
                  icon="sync-outline"
                  href="/coaching-sync"
                />
                <ProfileLink
                  title="NFC test kiti"
                  detail="Kart bilgisi ve ayrı test kartıyla yazma denemesi"
                  icon="hardware-chip-outline"
                  href="/(drawer)/nfc-test"
                />
                {!!identity.error && (
                  <Text accessibilityRole="alert" style={{ color: fit.orange }}>
                    Hesap bilgileri yenilenemedi. Bağlantını kontrol edip
                    yeniden deneyebilirsin.
                  </Text>
                )}
                <FitButton
                  title={
                    identity.isFetching
                      ? "Kontrol ediliyor…"
                      : "Hesap bilgilerini yenile"
                  }
                  secondary
                  disabled={identity.isFetching}
                  onPress={() => void identity.refetch()}
                />
                <Text style={f.muted}>
                  NFCFit {Constants.expoConfig?.version ?? "—"}
                </Text>
              </>
            )}
          </FitCard>
          <FitButton
            title="Çıkış yap"
            secondary
            icon="log-out-outline"
            onPress={() => Alert.alert('Çıkış yap', 'Telefonundaki kayıtlar silinmez. Eşitlemeyi sürdürmek için aynı hesapla yeniden giriş yapman gerekir.', [{text:'Vazgeç',style:'cancel'},{text:'Çıkış yap',style:'destructive',onPress:()=>void logout()}])}
          />
        </ScrollView>
        <AppBottomNav />
      </View>
    </SafeAreaView>
  );
}
function metric(value: unknown, unit: string) {
  return value === undefined || value === null || value === ""
    ? "—"
    : `${value} ${unit}`;
}
function ProfileLink({
  title,
  detail,
  icon,
  href,
}: {
  title: string;
  detail: string;
  icon: FitnessIcon;
  href: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(href as never)}
      style={[f.row, { minHeight: 64, paddingVertical: 8 }]}
    >
      <Ionicons name={icon} size={23} color={fit.lime} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[f.body, { fontWeight: "700" }]}>{title}</Text>
        <Text style={f.muted}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={fit.muted} />
    </Pressable>
  );
}
