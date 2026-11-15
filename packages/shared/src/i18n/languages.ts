export type SupportedLocaleCode = 'en' | 'id' | 'es' | 'fr' | 'de';

export interface LocaleConfig {
  code: SupportedLocaleCode;
  bcp47: string;
  name: string;
  nativeName: string;
  label: string;
  defaultCurrency: string;
  defaultCountry: string;
  defaultTimezone: string;
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD.MM.YYYY' | 'DD/MM/YYYY';
  thousandSeparator: ',' | '.';
  decimalSeparator: '.' | ',';
}

export const LOCALE_CONFIGS: Record<SupportedLocaleCode, LocaleConfig> = {
  en: {
    code: 'en',
    bcp47: 'en-US',
    name: 'English',
    nativeName: 'English',
    label: 'English (en)',
    defaultCurrency: 'USD',
    defaultCountry: 'US',
    defaultTimezone: '(-06:00) Central Time',
    dateFormat: 'YYYY-MM-DD',
    thousandSeparator: ',',
    decimalSeparator: '.',
  },
  id: {
    code: 'id',
    bcp47: 'id-ID',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    label: 'Bahasa Indonesia (id)',
    defaultCurrency: 'IDR',
    defaultCountry: 'ID',
    defaultTimezone: '(+07:00) Jakarta (WIB)',
    dateFormat: 'DD/MM/YYYY',
    thousandSeparator: '.',
    decimalSeparator: ',',
  },
  es: {
    code: 'es',
    bcp47: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    label: 'Español (es)',
    defaultCurrency: 'EUR',
    defaultCountry: 'ES',
    defaultTimezone: '(+01:00) Berlin',
    dateFormat: 'DD/MM/YYYY',
    thousandSeparator: '.',
    decimalSeparator: ',',
  },
  fr: {
    code: 'fr',
    bcp47: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    label: 'Français (fr)',
    defaultCurrency: 'EUR',
    defaultCountry: 'FR',
    defaultTimezone: '(+01:00) Berlin',
    dateFormat: 'DD/MM/YYYY',
    thousandSeparator: '.',
    decimalSeparator: ',',
  },
  de: {
    code: 'de',
    bcp47: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    label: 'Deutsch (de)',
    defaultCurrency: 'EUR',
    defaultCountry: 'DE',
    defaultTimezone: '(+01:00) Berlin',
    dateFormat: 'DD.MM.YYYY',
    thousandSeparator: '.',
    decimalSeparator: ',',
  },
};

export const SUPPORTED_LANGUAGES: LocaleConfig[] = Object.values(LOCALE_CONFIGS);

export function normalizeLocaleCode(raw?: string | null): SupportedLocaleCode {
  if (!raw) return 'en';
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (base === 'id' || base === 'es' || base === 'fr' || base === 'de' || base === 'en') {
    return base;
  }
  return 'en';
}

export function getLocaleConfig(raw?: string | null): LocaleConfig {
  return LOCALE_CONFIGS[normalizeLocaleCode(raw)];
}

/**
 * Formats an ISO YYYY-MM-DD date string using the configured display format.
 */
export function formatLocalizedDate(
  isoDate: string,
  dateFormat: string = 'YYYY-MM-DD'
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const [, yyyy, mm, dd] = match;
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'DD.MM.YYYY':
      return `${dd}.${mm}.${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}
