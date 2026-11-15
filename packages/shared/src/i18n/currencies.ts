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
