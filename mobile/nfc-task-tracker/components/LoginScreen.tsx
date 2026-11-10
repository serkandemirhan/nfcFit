import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
  const { login, signUp, error, notice, isSubmitting } = useAuth();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const primaryContentColor = colorScheme === 'dark' ? palette.background : '#fff';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const passwordInput = useRef<TextInput>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleSubmit = async () => {
    setLocalError(null);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
      } else {
        await login(email, password);
      }
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          keyboardVisible && styles.keyboardScrollContainer,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {!keyboardVisible && <View style={styles.rings}>
          <View style={styles.ringOne} />
          <View style={styles.ringTwo} />
          <View style={styles.ringThree} />
        </View>}
        <View style={[
          styles.card,
          keyboardVisible && styles.keyboardCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}>
          <View style={[styles.brandWrap, keyboardVisible && styles.keyboardBrandWrap]}>
            {!keyboardVisible && <View style={styles.logoIcon}>
              <Ionicons name="walk" size={38} color="#fff" />
              <Ionicons name="radio-outline" size={24} color={palette.tint} style={styles.logoSignal} />
            </View>}
            <Text style={[styles.title, keyboardVisible && styles.keyboardTitle, { color: palette.text }]} maxFontSizeMultiplier={1.2}>NFC<Text style={{ color: palette.tint }}>Fit</Text></Text>
            {!keyboardVisible && <>
              <Text style={[styles.tagline, { color: palette.text }]}>Tap. Track. Improve.</Text>
              <Text style={[styles.subtitle, { color: palette.mutedText }]}>Track your workouts, habits and wellness with a tap.</Text>
            </>}
            {keyboardVisible && <Text style={[styles.keyboardHint, { color: palette.mutedText }]}>{mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.mutedText }]} maxFontSizeMultiplier={1.2}>E-posta</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={palette.mutedText}
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
              autoComplete="email"
              textContentType="emailAddress"
              maxFontSizeMultiplier={1.2}
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
            />
            <Text style={[styles.characterCount, { color: palette.mutedText }]} maxFontSizeMultiplier={1.2}>{email.length} karakter</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.mutedText }]} maxFontSizeMultiplier={1.2}>{t('login.password')}</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                ref={passwordInput}
                secureTextEntry={!passwordVisible}
                placeholder="Password"
                placeholderTextColor={palette.mutedText}
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
                maxFontSizeMultiplier={1.2}
                style={[styles.input, styles.passwordInput, { borderColor: palette.border, color: palette.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                hitSlop={10}
                onPress={() => setPasswordVisible(visible => !visible)}
                style={styles.passwordVisibilityButton}
              >
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={palette.mutedText} />
              </Pressable>
            </View>
            <Text style={[styles.characterCount, { color: palette.mutedText }]} maxFontSizeMultiplier={1.2}>{password.length} karakter</Text>
          </View>

          {(error || localError) && (
            <Text style={styles.errorText}>{error ?? localError}</Text>
          )}
          {notice && <Text style={styles.noticeText}>{notice}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.tint, opacity: pressed || isSubmitting ? 0.8 : 1 },
            ]}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color={primaryContentColor} />
            ) : (
              <Text style={[styles.primaryText, { color: primaryContentColor }]} maxFontSizeMultiplier={1.2}>{mode === 'signup' ? 'Hesap oluştur' : t('login.submit')}</Text>
            )}
          </Pressable>

            <Pressable
              style={styles.modeButton}
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setLocalError(null);
            }}>
              <Text style={[styles.modeText, { color: palette.tint }]} maxFontSizeMultiplier={1.2}>
                {mode === 'login' ? 'Yeni misin? Hesap oluştur' : 'Zaten hesabın var mı? Giriş yap'}
              </Text>
            </Pressable>

            {!keyboardVisible && <Pressable>
            <Text style={[styles.termsText, { color: palette.mutedText }]}>By continuing, you agree to Terms & Privacy Policy</Text>
            </Pressable>}
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
  keyboardScrollContainer: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    padding: 20,
    gap: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  keyboardCard: {
    padding: 16,
    gap: 10,
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
  keyboardBrandWrap: {
    paddingVertical: 0,
    gap: 2,
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
  keyboardTitle: {
    fontSize: 20,
  },
  keyboardHint: {
    fontSize: 12,
    fontWeight: '600',
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
  passwordInputWrap: {
    justifyContent: 'center',
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
  passwordInput: {
    paddingRight: 48,
  },
  passwordVisibilityButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  characterCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    fontSize: 13,
  },
  noticeText: {
    color: '#86efac',
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
    borderRadius: 12,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
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
