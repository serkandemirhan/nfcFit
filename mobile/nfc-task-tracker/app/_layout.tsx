import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { LanguageInitializer } from '@/components/LanguageInitializer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ColorSchemeProvider } from '@/providers/color-scheme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { useAuth } from '@/hooks/use-auth';
import { LoginScreen } from '@/components/LoginScreen';
import '@/lib/i18n';

export const unstable_settings = {
  anchor: '(drawer)',
};

export default function RootLayout() {
  return (
    <ColorSchemeProvider>
      <RootLayoutContent />
    </ColorSchemeProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LanguageInitializer />
            <AuthGate>
              <Stack>
                <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
            </AuthGate>
            <StatusBar style="auto" />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
