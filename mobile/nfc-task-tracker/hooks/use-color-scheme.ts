import type { ColorSchemeName } from 'react-native';

import { useThemePreference } from '@/providers/color-scheme-provider';

export function useColorScheme(): NonNullable<ColorSchemeName> {
  const { colorScheme } = useThemePreference();
  return colorScheme;
}
