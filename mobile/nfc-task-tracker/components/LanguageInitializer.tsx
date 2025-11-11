import { useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

/**
 * Component to initialize language on app start
 * Placed at root level to ensure language is loaded before any screen
 */
export function LanguageInitializer() {
  // This will trigger the useEffect in useLanguage hook
  // which loads the saved language from AsyncStorage
  useLanguage();

  return null;
}
