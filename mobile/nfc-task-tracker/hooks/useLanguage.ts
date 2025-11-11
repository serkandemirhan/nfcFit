import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

export type Language = 'tr' | 'en';

const LANGUAGE_KEY = '@nfc_task_tracker:language';

export function useLanguage() {
  const { i18n } = useTranslation();

  // Load saved language on mount
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

      if (savedLanguage && ['tr', 'en'].includes(savedLanguage)) {
        await i18n.changeLanguage(savedLanguage);
      } else {
        // Get device language
        const locales = getLocales();
        const deviceLanguage = locales[0]?.languageCode || 'tr';
        const supportedLanguage = (['tr', 'en'].includes(deviceLanguage) ? deviceLanguage : 'tr') as Language;

        await i18n.changeLanguage(supportedLanguage);
        await AsyncStorage.setItem(LANGUAGE_KEY, supportedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
      // Default to Turkish if error
      await i18n.changeLanguage('tr');
    }
  };

  const changeLanguage = async (language: Language) => {
    try {
      await i18n.changeLanguage(language);
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  return {
    currentLanguage: (i18n.language || 'tr') as Language,
    changeLanguage,
    isRTL: i18n.dir() === 'rtl',
  };
}
