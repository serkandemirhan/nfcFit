import Ionicons from '@expo/vector-icons/Ionicons';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { StyleSheet, Switch, View, Pressable, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/providers/color-scheme-provider';
import { useAuth } from '@/hooks/use-auth';
import type { AuthenticatedUser } from '@/providers/auth-provider';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <Drawer
      screenOptions={{
        headerTintColor: theme.tint,
        drawerActiveTintColor: theme.tint,
        drawerType: 'front',
        drawerStyle: { backgroundColor: theme.background },
        sceneStyle: { backgroundColor: theme.background },
        drawerItemStyle: { borderRadius: 14, marginHorizontal: 12, marginVertical: 2 },
        drawerLabelStyle: { fontWeight: '600' },
        headerLeft: () => null,
        headerTitleAlign: 'center',
      }}
      drawerContent={(props) => (
        <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
          <UserSection user={user} />
          <View style={styles.navSection}>
            <DrawerItemList {...props} />
          </View>
          <ThemeToggle />
          <LanguageSection />
        </DrawerContentScrollView>
      )}>
      <Drawer.Screen
        name="index"
        options={{
          title: t('navigation.tasks'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="fitness"
        options={{
          title: 'Fitness',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="fitness-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="nfc"
        options={{
          title: t('navigation.nfc'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="wellness"
        options={{
          title: 'Wellness',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="cards"
        options={{
          title: t('navigation.cards'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="layouts"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="users"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="history"
        options={{
          title: 'Geçmiş',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="new-tag"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="card/[id]"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="layout/[id]"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="create-task"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="tags"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}

function ThemeToggle() {
  const { colorScheme, mode, setMode } = useThemePreference();
  const { t } = useTranslation();
  const palette = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const borderColor = palette.border ?? 'rgba(148,163,184,0.2)';

  return (
    <View style={[styles.themeSection, { borderColor }]}> 
      <View style={styles.themeRow}>
        <View>
        
          <ThemedText style={styles.themeHint}>
            {mode === 'system'
              ? t('settings.system')
              : `${t(`settings.${colorScheme}`)}`
            }
          </ThemedText>
        </View>
        <Switch
          value={isDark}
          onValueChange={(value) => setMode(value ? 'dark' : 'light')}
          thumbColor="#f4f3f4"
          trackColor={{ false: 'rgba(0,0,0,0.2)', true: '#2563EB' }}
        />
      </View>
      <Pressable
        onPress={() => setMode('system')}
        style={({ pressed }) => [styles.systemButton, pressed && styles.systemButtonPressed]}
        disabled={mode === 'system'}>
        <ThemedText style={[styles.systemButtonText, mode === 'system' && styles.systemButtonDisabled]}>
          {t('settings.system')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function LanguageSection() {
  const { colorScheme } = useThemePreference();
  const { t } = useTranslation();
  const borderColor = Colors[colorScheme].border ?? 'rgba(148,163,184,0.2)';

  return (
    <View style={[styles.languageSection, { borderColor }]}> 
      <ThemedText type="subtitle" style={styles.languageTitle}>
        {t('settings.language')}
      </ThemedText>
      <LanguageSwitcher />
    </View>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  navSection: {
    paddingVertical: 4,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userCaption: {
    fontSize: 13,
    opacity: 0.65,
  },
  themeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.2)',
    gap: 12,
    marginTop: 8,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeHint: {
    fontSize: 13,
    opacity: 0.6,
  },
  systemButton: {
    paddingVertical: 8,
  },
  systemButtonPressed: {
    opacity: 0.7,
  },
  systemButtonText: {
    fontWeight: '600',
  },
  systemButtonDisabled: {
    opacity: 0.5,
  },
  languageSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.2)',
    gap: 12,
  },
  languageTitle: {
    marginBottom: 4,
  },
});

function UserSection({ user }: { user: AuthenticatedUser | null }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  if (!user) return null;

  const avatar = 'avatarurl' in user && user.avatarurl ? user.avatarurl : undefined;
  return (
    <View style={styles.userSection}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThemedText style={{ color: '#fff', fontWeight: '700' }}>{user.name?.[0] ?? 'U'}</ThemedText>
        </View>
      )}
      <View>
        <ThemedText style={styles.userName}>{user.name ?? 'Kullanıcı'}</ThemedText>
        <ThemedText style={styles.userCaption}>Tek kullanıcı</ThemedText>
      </View>
    </View>
  );
}
