import { useEffect, useState } from 'react';

import { useThemePreference } from '@/providers/color-scheme-provider';

/**
 * On web the initial render can run on the server, so we gate on hydration to avoid mismatches.
 */
export function useColorScheme() {
  const { colorScheme } = useThemePreference();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  return colorScheme;
}
