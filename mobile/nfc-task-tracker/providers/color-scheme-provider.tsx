import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { ColorSchemeName, useColorScheme as useDeviceColorScheme } from 'react-native';

type ThemePreference = 'system' | 'light' | 'dark';

type ColorSchemeContextValue = {
  colorScheme: NonNullable<ColorSchemeName>;
  mode: ThemePreference;
  setMode: (mode: ThemePreference) => void;
  toggleTheme: () => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useDeviceColorScheme() ?? 'light';
  const [mode, setMode] = useState<ThemePreference>('system');

  const resolvedScheme: NonNullable<ColorSchemeName> = useMemo(() => {
    if (mode === 'system') return deviceScheme;
    return mode;
  }, [deviceScheme, mode]);

  const value = useMemo<ColorSchemeContextValue>(
    () => ({
      colorScheme: resolvedScheme,
      mode,
      setMode,
      toggleTheme: () =>
        setMode((prev) => {
          if (prev === 'light') return 'dark';
          if (prev === 'dark') return 'light';
          return deviceScheme === 'dark' ? 'light' : 'dark';
        }),
    }),
    [resolvedScheme, mode, deviceScheme],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error('useThemePreference must be used within a ColorSchemeProvider');
  }
  return context;
}
