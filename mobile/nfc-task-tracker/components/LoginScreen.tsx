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
  const { login, quickLogin, error, isSubmitting } = useAuth();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<'welcome' | 'login'>('welcome');

  const handleSubmit = async () => {
    setLocalError(null);
    try {
      await login(email, password);
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
        <View style={styles.rings}>
          <View style={styles.ringOne} />
          <View style={styles.ringTwo} />
          <View style={styles.ringThree} />
        </View>
        <View style={[styles.card, { backgroundColor: 'rgba(7,24,39,0.86)', borderColor: palette.border }]}>
          <View style={styles.brandWrap}>
            <View style={styles.logoIcon}>
              <Ionicons name="walk" size={38} color="#fff" />
              <Ionicons name="radio-outline" size={24} color={palette.tint} style={styles.logoSignal} />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>NFC<Text style={{ color: palette.tint }}>Fit</Text></Text>
            <Text style={[styles.tagline, { color: palette.text }]}>Tap. Track. Improve.</Text>
            <Text style={[styles.subtitle, { color: palette.mutedText }]}>Track your workouts, habits and wellness with a tap.</Text>
          </View>

          {mode === 'login' && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: palette.mutedText }]}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="serkan@example.com"
                  placeholderTextColor={palette.mutedText}
                  value={email}
                  onChangeText={setEmail}
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
            </>
          )}

          {(error || localError) && (
            <Text style={styles.errorText}>{error ?? localError}</Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: pressed || isSubmitting ? 0.8 : 1 },
            ]}
            disabled={isSubmitting}
            onPress={mode === 'welcome' ? () => quickLogin() : handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{mode === 'welcome' ? 'Get Started' : t('login.submit')}</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.outlineButton, { borderColor: palette.border }]}
            onPress={() => setMode(mode === 'welcome' ? 'login' : 'welcome')}>
            <Text style={[styles.outlineText, { color: palette.text }]}>{mode === 'welcome' ? 'Log In' : 'Back'}</Text>
          </Pressable>

          {mode === 'login' && (
            <Pressable>
              <Text style={[styles.forgotText, { color: palette.tint }]}>Şifremi unuttum</Text>
            </Pressable>
          )}

          <Pressable>
            <Text style={[styles.termsText, { color: palette.mutedText }]}>By continuing, you agree to Terms & Privacy Policy</Text>
          </Pressable>
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
  rings: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOne: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.08)',
  },
  ringTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.12)',
  },
  ringThree: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(53,211,83,0.16)',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    padding: 24,
    gap: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  brandWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  logoIcon: {
    width: 66,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSignal: {
    position: 'absolute',
    right: 5,
    top: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
  },
  tagline: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 220,
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
  forgotText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  termsText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineText: {
    fontSize: 15,
    fontWeight: '700',
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
