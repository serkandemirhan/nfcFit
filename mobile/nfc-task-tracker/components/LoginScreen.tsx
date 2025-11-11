import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import { useAuth } from '@/hooks/use-auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function LoginScreen() {
  const { login, error, isSubmitting, quickLogin } = useAuth();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    try {
      await login(username, password);
      setPassword('');
    } catch (err) {
      if (err instanceof Error) {
        setLocalError(err.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          <View style={styles.titleRow}>
            <Ionicons name="shield-checkmark" size={32} color={palette.tint} />
            <Text style={[styles.title, { color: palette.text }]}>{t('app.title')}</Text>
          </View>
          <Text style={[styles.subtitle, { color: palette.mutedText }]}>
            {t('login.subtitle', 'Devam etmek için giriş yapın')}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.mutedText }]}>{t('login.username')}</Text>
            <TextInput
              autoCapitalize="none"
              placeholder={t('login.usernamePlaceholder', 'kullanıcı adı')}
              placeholderTextColor={palette.mutedText}
              value={username}
              onChangeText={setUsername}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.mutedText }]}>{t('login.password')}</Text>
            <TextInput
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={palette.mutedText}
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
          </View>

          {(error || localError) && (
            <Text style={styles.errorText}>{error ?? localError}</Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: pressed || isSubmitting ? 0.8 : 1 },
            ]}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{t('login.submit')}</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={[styles.dividerLabel, { color: palette.mutedText }]}>{t('login.quickLogin')}</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.quickRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
              onPress={() => quickLogin('first-user')}
            >
              <Text style={styles.secondaryText}>{t('login.asUser')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
              onPress={() => quickLogin('admin')}
            >
              <Text style={styles.secondaryText}>{t('login.asAdmin')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.5)',
  },
  dividerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.6)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  secondaryText: {
    fontWeight: '600',
  },
});
