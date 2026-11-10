import { AthleteDashboard } from "@/components/athlete-dashboard";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  ManagementButton,
  ManagementCard,
  ManagementMessage,
  errorMessage,
} from "@/components/management-ui";
import { getSurfaceColors } from "@/constants/tasks";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  canOpenManagement,
  isCoach,
  useTenantIdentity,
} from "@/hooks/use-tenant-identity";
import { tenantConsoleConfigured } from "@/lib/tenant-console";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function HomeScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const identity = useTenantIdentity();

  if (tenantConsoleConfigured && identity.isPending)
    return (
      <ThemedView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <ActivityIndicator color={surface.green} />
        <ThemedText>Hesap yetkileri kontrol ediliyor…</ThemedText>
      </ThemedView>
    );
  if (isCoach(identity.data)) return <Redirect href={"/coach" as never} />;
  if (canOpenManagement(identity.data))
    return <Redirect href={"/(drawer)/management" as never} />;
  if (identity.error)
    return (
      <ThemedView style={{ flex: 1, backgroundColor: surface.background }}>
        <View style={{ padding: 16, gap: 14 }}>
          <ManagementCard
            title="Hesap yetkileri doğrulanamadı"
            hint="Yönetici veya üye görünümünüz henüz belirlenemedi."
          >
            <ManagementMessage error message={errorMessage(identity.error)} />
            <ManagementButton
              title={identity.isFetching ? "Kontrol ediliyor…" : "Yeniden dene"}
              disabled={identity.isFetching}
              onPress={() => void identity.refetch()}
            />
            <ManagementButton
              title="Profil ve oturum bilgileri"
              secondary
              onPress={() => router.push("/(drawer)/settings" as never)}
            />
          </ManagementCard>
        </View>
        <AppBottomNav />
      </ThemedView>
    );
  return <AthleteDashboard />;
}
