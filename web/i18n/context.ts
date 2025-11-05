import React from 'react';

export type Locale = 'tr' | 'en';
export type I18nValue = { locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string };

export const LocaleContext = React.createContext<I18nValue>({
  locale: 'tr',
  setLocale: () => {},
  t: (k: string) => k,
});

export const useTranslation = () => React.useContext(LocaleContext);

