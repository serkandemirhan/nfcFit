import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/providers/color-scheme-provider';

export default function SettingsScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { colorScheme, mode, setMode } = useThemePreference();
  const { logout, user } = useAuth();
  const isDark = colorScheme === 'dark';

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Ayarlar</ThemedText>
          <ThemedText style={[styles.subtitle, { color: surface.mutedText }]} numberOfLines={1}>
            {getUserLabel(user)}
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Profil</ThemedText>
          <ProfileRow label="İsim" value={user?.name ?? 'Serkan'} />
          <ProfileRow label="Email" value={('email' in (user ?? {}) && user?.email) ? user.email : 'serkan@example.com'} />
          <ProfileRow label="Boy" value={formatMetric((user as any)?.height_cm, 'cm')} />
          <ProfileRow label="Kilo" value={formatMetric((user as any)?.weight_kg, 'kg')} />
          <ProfileRow label="Yaş" value={(user as any)?.age ? String((user as any).age) : '—'} />
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="moon-outline" size={20} color="#2563eb" />
              <View>
                <ThemedText style={styles.settingTitle}>Tema</ThemedText>
                <ThemedText style={[styles.settingHint, { color: surface.mutedText }]}>
                  {mode === 'system' ? 'Sistem ayarı' : isDark ? 'Koyu' : 'Açık'}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              thumbColor="#f8fafc"
              trackColor={{ false: 'rgba(148,163,184,0.45)', true: '#2563eb' }}
            />
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => setMode('system')}>
            <ThemedText style={styles.secondaryButtonText}>Sistem temasını kullan</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.settingLabel}>
            <Ionicons name="language-outline" size={20} color="#2563eb" />
            <ThemedText style={styles.settingTitle}>Dil</ThemedText>
          </View>
          <LanguageSwitcher />
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <ThemedText style={styles.logoutText}>Çıkış yap</ThemedText>
        </Pressable>
      </View>
      <AppBottomNav />
    </ThemedView>
  );
}

function getUserLabel(user: ReturnType<typeof useAuth>['user']) {
  if (!user) return 'Oturum';
  if ('username' in user && user.username) return user.username;
  if ('email' in user && user.email) return user.email;
  return user.name || 'Oturum';
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <ThemedText style={styles.profileLabel}>{label}</ThemedText>
      <ThemedText style={styles.profileValue}>{value}</ThemedText>
    </View>
  );
}

function formatMetric(value: unknown, unit: string) {
  if (value === null || value === undefined || value === '') return '—';
  return `${value} ${unit}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: bottomNavHeight + 18,
    gap: 12,
  },
  header: {
    gap: 3,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.22)',
  },
  profileLabel: {
    fontSize: 13,
    opacity: 0.65,
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingHint: {
    fontSize: 12,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.08)',
    padding: 13,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '800',
  },
});
