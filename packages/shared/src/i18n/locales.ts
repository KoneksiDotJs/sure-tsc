export type SupportedLocaleCode = 'en' | 'id' | 'es' | 'fr' | 'de';

export interface CurrencyConfig {
  code: string;
  name: string;
  nativeName: string;
  symbol: string;
  bcp47Locale: string;
  thousandSeparator: ',' | '.';
  decimalSeparator: '.' | ',';
  defaultDecimals: number;
}

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

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    code: 'USD',
    name: 'United States Dollar (USD)',
    nativeName: 'Dolar Amerika Serikat (USD)',
    symbol: '$',
    bcp47Locale: 'en-US',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'IDR',
    name: 'Indonesian Rupiah (IDR)',
    nativeName: 'Rupiah Indonesia (IDR)',
    symbol: 'Rp',
    bcp47Locale: 'id-ID',
    thousandSeparator: '.',
    decimalSeparator: ',',
    defaultDecimals: 2,
  },
  {
    code: 'EUR',
    name: 'Euro (EUR)',
    nativeName: 'Euro (EUR)',
    symbol: '€',
    bcp47Locale: 'de-DE',
    thousandSeparator: '.',
    decimalSeparator: ',',
    defaultDecimals: 2,
  },
  {
    code: 'GBP',
    name: 'British Pound (GBP)',
    nativeName: 'Poundsterling Inggris (GBP)',
    symbol: '£',
    bcp47Locale: 'en-GB',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar (CAD)',
    nativeName: 'Dolar Kanada (CAD)',
    symbol: 'CA$',
    bcp47Locale: 'en-CA',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'AUD',
    name: 'Australian Dollar (AUD)',
    nativeName: 'Dolar Australia (AUD)',
    symbol: 'A$',
    bcp47Locale: 'en-AU',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'CHF',
    name: 'Swiss Franc (CHF)',
    nativeName: 'Franc Swiss (CHF)',
    symbol: 'CHF ',
    bcp47Locale: 'de-CH',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'JPY',
    name: 'Japanese Yen (JPY)',
    nativeName: 'Yen Jepang (JPY)',
    symbol: '¥',
    bcp47Locale: 'ja-JP',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 0,
  },
  {
    code: 'CNY',
    name: 'Chinese Yuan (CNY)',
    nativeName: 'Yuan Tiongkok (CNY)',
    symbol: 'CN¥',
    bcp47Locale: 'zh-CN',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
  {
    code: 'SGD',
    name: 'Singapore Dollar (SGD)',
    nativeName: 'Dolar Singapura (SGD)',
    symbol: 'S$',
    bcp47Locale: 'en-SG',
    thousandSeparator: ',',
    decimalSeparator: '.',
    defaultDecimals: 2,
  },
];

export const CURRENCY_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol])
);

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

export const EN_MESSAGES = {
  'nav.home': 'Home',
  'nav.accounts': 'Accounts',
  'nav.transactions': 'Transactions',
  'nav.imports': 'Imports',
  'nav.budgets': 'Budgets',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.back': 'Back',
  'nav.next': 'Next',
  'nav.logout': 'Logout',

  'sidebar.all': 'All',
  'sidebar.assets': 'Assets',
  'sidebar.debts': 'Debts',
  'sidebar.netWorth': 'Net Worth',
  'sidebar.newAccount': '+ New',

  'settings.group.general': 'General',
  'settings.group.transactions': 'Transactions',
  'settings.group.advanced': 'Advanced',
  'settings.group.more': 'More',

  'settings.item.accounts': 'Accounts',
  'settings.item.sync': 'Bank sync',
  'settings.item.preferences': 'Preferences',
  'settings.item.appearance': 'Appearance',
  'settings.item.profile': 'Profile Info',
  'settings.item.security': 'Security',
  'settings.item.categories': 'Categories',
  'settings.item.tags': 'Tags',
  'settings.item.rules': 'Rules',
  'settings.item.merchants': 'Merchants',
  'settings.item.recurring': 'Recurring',
  'settings.item.auto_matches': 'Auto Matches',
  'settings.item.statement_vault': 'Statement Vault',
  'settings.item.ai_prompts': 'AI Prompts',
  'settings.item.classifier': 'Classifier',
  'settings.item.llm_usage': 'LLM Usage',
  'settings.item.api_keys': 'API Keys',
  'settings.item.mcp': 'MCP',
  'settings.item.imports': 'Imports',
  'settings.item.exports': 'Exports',
  'settings.item.guides': 'Guides',
  'settings.item.whats_new': "What's new",
  'settings.item.feedback': 'Feedback',

  'prefs.general.title': 'General',
  'prefs.general.subtitle': 'Configure your preferences',
  'prefs.language': 'Language',
  'prefs.timezone': 'Timezone',
  'prefs.dateFormat': 'Date format',
  'prefs.country': 'Country',
  'prefs.translationNote':
    'Please note, localization translations are applied progressively across modules.',
  'prefs.budget.title': 'Budget',
  'prefs.budget.subtitle': 'Configure how your budgets behave',
  'prefs.budget.startDay': 'Budget month starts on',
  'prefs.currencies.title': 'Family Currencies',
  'prefs.currencies.subtitle': 'Choose which currencies appear in money fields for your family',
  'prefs.currencies.base': 'BASE CURRENCY',
  'prefs.currencies.additional': 'ADDITIONAL CURRENCIES',
  'prefs.currencies.manage': 'Manage currencies',
  'prefs.sharing.title': 'Family Sharing',
  'prefs.sharing.subtitle': 'Control how accounts and AI consent are shared in your family',

  'common.newAccount': 'New account',
  'common.newCategory': 'New category',
  'common.newTag': 'New tag',
  'common.newMerchant': 'New merchant',
  'common.newApiKey': 'New API Key',
  'common.done': 'Done',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
} as const;

export type TranslationKey = keyof typeof EN_MESSAGES;

export const ID_MESSAGES: Record<TranslationKey, string> = {
  'nav.home': 'Beranda',
  'nav.accounts': 'Akun',
  'nav.transactions': 'Transaksi',
  'nav.imports': 'Impor',
  'nav.budgets': 'Anggaran',
  'nav.reports': 'Laporan',
  'nav.settings': 'Pengaturan',
  'nav.back': 'Kembali',
  'nav.next': 'Berikutnya',
  'nav.logout': 'Keluar',

  'sidebar.all': 'Semua',
  'sidebar.assets': 'Aset',
  'sidebar.debts': 'Utang',
  'sidebar.netWorth': 'Kekayaan Bersih',
  'sidebar.newAccount': '+ Baru',

  'settings.group.general': 'Umum',
  'settings.group.transactions': 'Transaksi',
  'settings.group.advanced': 'Lanjutan',
  'settings.group.more': 'Lainnya',

  'settings.item.accounts': 'Akun',
  'settings.item.sync': 'Sinkronisasi Bank',
  'settings.item.preferences': 'Preferensi',
  'settings.item.appearance': 'Tampilan',
  'settings.item.profile': 'Info Profil',
  'settings.item.security': 'Keamanan',
  'settings.item.categories': 'Kategori',
  'settings.item.tags': 'Tag',
  'settings.item.rules': 'Aturan',
  'settings.item.merchants': 'Merchant',
  'settings.item.recurring': 'Berulang',
  'settings.item.auto_matches': 'Pencocokan Otomatis',
  'settings.item.statement_vault': 'Brankas Mutasi',
  'settings.item.ai_prompts': 'Prompt AI',
  'settings.item.classifier': 'Klasifikasi',
  'settings.item.llm_usage': 'Penggunaan LLM',
  'settings.item.api_keys': 'Kunci API',
  'settings.item.mcp': 'MCP',
  'settings.item.imports': 'Impor',
  'settings.item.exports': 'Ekspor',
  'settings.item.guides': 'Panduan',
  'settings.item.whats_new': 'Pembaruan',
  'settings.item.feedback': 'Masukan',

  'prefs.general.title': 'Umum',
  'prefs.general.subtitle': 'Atur preferensi wilayah dan bahasa Anda',
  'prefs.language': 'Bahasa',
  'prefs.timezone': 'Zona Waktu',
  'prefs.dateFormat': 'Format Tanggal',
  'prefs.country': 'Negara',
  'prefs.translationNote':
    'Terjemahan bahasa Indonesia diterapkan pada navigasi, preferensi, serta format angka & mata uang Rupiah (IDR).',
  'prefs.budget.title': 'Anggaran',
  'prefs.budget.subtitle': 'Atur perilaku siklus anggaran keluarga',
  'prefs.budget.startDay': 'Bulan anggaran dimulai pada tanggal',
  'prefs.currencies.title': 'Mata Uang Keluarga',
  'prefs.currencies.subtitle': 'Pilih mata uang utama dan tambahan untuk kolom nominal keluarga',
  'prefs.currencies.base': 'MATA UANG UTAMA',
  'prefs.currencies.additional': 'MATA UANG TAMBAHAN',
  'prefs.currencies.manage': 'Kelola mata uang',
  'prefs.sharing.title': 'Berbagi Keluarga',
  'prefs.sharing.subtitle': 'Atur pembagian akun dan izin AI dalam keluarga Anda',

  'common.newAccount': 'Akun baru',
  'common.newCategory': 'Kategori baru',
  'common.newTag': 'Tag baru',
  'common.newMerchant': 'Merchant baru',
  'common.newApiKey': 'Kunci API Baru',
  'common.done': 'Selesai',
  'common.cancel': 'Batal',
  'common.save': 'Simpan',
};

export function translate(locale: string | null | undefined, key: TranslationKey): string {
  const code = normalizeLocaleCode(locale);
  if (code === 'id') {
    return ID_MESSAGES[key] ?? EN_MESSAGES[key];
  }
  return EN_MESSAGES[key];
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
