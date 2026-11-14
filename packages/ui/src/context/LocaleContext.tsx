import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getLocaleConfig,
  LocaleConfig,
  SupportedLocaleCode,
  translate,
  TranslationKey,
} from '@sure/shared';

interface LocaleContextValue {
  locale: SupportedLocaleCode;
  bcp47: string;
  config: LocaleConfig;
  setLocale: (next: string) => void;
  t: (key: TranslationKey) => string;
}

const LOCALE_STORAGE_KEY = 'sure:locale';

const defaultConfig = getLocaleConfig('en');

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  bcp47: defaultConfig.bcp47,
  config: defaultConfig,
  setLocale: () => undefined,
  t: (key) => translate('en', key),
});

export const LocaleProvider: React.FC<{
  children: React.ReactNode;
  defaultLocale?: string;
}> = ({ children, defaultLocale = 'en' }) => {
  const [config, setConfig] = useState<LocaleConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (saved) return getLocaleConfig(saved);
      } catch {
        // Ignore storage read errors
      }
    }
    return getLocaleConfig(defaultLocale);
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = config.bcp47;
    }
  }, [config.bcp47]);

  const setLocale = useCallback((next: string) => {
    const resolved = getLocaleConfig(next);
    setConfig(resolved);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, resolved.code);
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(config.code, key),
    [config.code]
  );

  return (
    <LocaleContext.Provider
      value={{
        locale: config.code,
        bcp47: config.bcp47,
        config,
        setLocale,
        t,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
};

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
