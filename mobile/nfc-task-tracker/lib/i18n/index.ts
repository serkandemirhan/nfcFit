import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import coachingTr from './locales/coaching-tr.json';
import coachingEn from './locales/coaching-en.json';
import en from './locales/en.json';
import tr from './locales/tr.json';

// Initialize i18n without async language detector
// Language will be set manually via useLanguage hook
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      en: { translation: en,coaching:coachingEn },
      tr: { translation: tr,coaching:coachingTr },
    },
    lng: 'tr', // Default language
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
