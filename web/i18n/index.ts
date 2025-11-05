import en from './en';
import tr from './tr';

export type Locale = 'en' | 'tr';

export const availableLocales: Locale[] = ['en', 'tr'];

export const defaultLocale: Locale = 'en';

export const translations: Record<Locale, Record<string, string>> = {
  en,
  tr,
};

export const fallbackTranslations = translations[defaultLocale];

export const translate = (locale: Locale, key: string): string =>
  translations[locale]?.[key] ?? fallbackTranslations[key] ?? key;
