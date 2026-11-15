export { type CurrencyConfig, SUPPORTED_CURRENCIES, CURRENCY_SYMBOL_MAP } from './currencies.js';
export {
  type SupportedLocaleCode,
  type LocaleConfig,
  LOCALE_CONFIGS,
  SUPPORTED_LANGUAGES,
  normalizeLocaleCode,
  getLocaleConfig,
  formatLocalizedDate,
} from './languages.js';
export { EN_MESSAGES, type TranslationKey } from './messages.en.js';
export { ID_MESSAGES } from './messages.id.js';

import { normalizeLocaleCode } from './languages.js';
import { EN_MESSAGES, type TranslationKey } from './messages.en.js';
import { ID_MESSAGES } from './messages.id.js';

export function translate(locale: string | null | undefined, key: TranslationKey): string {
  const code = normalizeLocaleCode(locale);
  if (code === 'id') {
    return ID_MESSAGES[key] ?? EN_MESSAGES[key];
  }
  return EN_MESSAGES[key];
}
