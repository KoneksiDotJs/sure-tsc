import { ProviderCategory, ProviderStatus } from '@prisma/client';
import { ProviderConnectionConfigInput } from '@sure/shared';
import { decryptSecret, encryptSecret } from '../../config/crypto.js';

export interface ProviderAdapterInfo {
  key: string;
  name: string;
  category: 'BANKING' | 'CRYPTO' | 'BROKERAGE' | 'MARKET_DATA';
  regions: string[];
  supportsWebhooks: boolean;
  supportsLiveSync: boolean;
  description: string;
}

export const LIVE_SYNC_ADAPTER_KEYS = new Set(['binance', 'yahoo_finance', 'frankfurter_fx']);

export const PROVIDER_ADAPTER_CATALOG: ProviderAdapterInfo[] = [
  {
    key: 'binance',
    name: 'Binance',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: true,
    description:
      'Sync read-only Spot wallet balances, crypto holdings, and valuation into a Crypto account.',
  },
  {
    key: 'yahoo_finance',
    name: 'Yahoo Finance Quotes',
    category: 'MARKET_DATA',
    regions: ['GLOBAL', 'ID'],
    supportsWebhooks: false,
    supportsLiveSync: true,
    description:
      'Monitor global & Indonesian stock quotes (e.g. BBCA.JK, BBRI.JK, VOO, AAPL) and update holding prices.',
  },
  {
    key: 'frankfurter_fx',
    name: 'Frankfurter ECB Exchange Rates',
    category: 'MARKET_DATA',
    regions: ['GLOBAL', 'ID'],
    supportsWebhooks: false,
    supportsLiveSync: true,
    description:
      'Fetch live daily FX exchange rates (IDR, USD, SGD, EUR, GBP, JPY, AUD) for multi-currency accounts.',
  },
  {
    key: 'plaid',
    name: 'Plaid',
    category: 'BANKING',
    regions: ['US', 'CA', 'UK', 'EU'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for US, CA, UK, and EU banking aggregation.',
  },
  {
    key: 'truelayer',
    name: 'TrueLayer',
    category: 'BANKING',
    regions: ['UK', 'EU'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for UK and European Open Banking.',
  },
  {
    key: 'enable_banking',
    name: 'Enable Banking',
    category: 'BANKING',
    regions: ['EU'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for European PSD2 Open Banking.',
  },
  {
    key: 'simplefin',
    name: 'SimpleFIN Bridge',
    category: 'BANKING',
    regions: ['US', 'CA'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for SimpleFIN Bridge institutions.',
  },
  {
    key: 'akahu',
    name: 'Akahu',
    category: 'BANKING',
    regions: ['NZ'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for New Zealand banking.',
  },
  {
    key: 'wise',
    name: 'Wise Multi-Currency',
    category: 'BANKING',
    regions: ['GLOBAL'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for Wise multi-currency accounts.',
  },
  {
    key: 'mercury',
    name: 'Mercury',
    category: 'BANKING',
    regions: ['US'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for US Mercury business banking.',
  },
  {
    key: 'brex',
    name: 'Brex',
    category: 'BANKING',
    regions: ['US'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for Brex corporate accounts.',
  },
  {
    key: 'monobank',
    name: 'Monobank',
    category: 'BANKING',
    regions: ['UA'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for Monobank Ukraine.',
  },
  {
    key: 'up_bank',
    name: 'Up Bank',
    category: 'BANKING',
    regions: ['AU'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for Up Bank Australia.',
  },
  {
    key: 'coinbase',
    name: 'Coinbase',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: true,
    supportsLiveSync: false,
    description: 'Catalog adapter for Coinbase exchange wallets.',
  },
  {
    key: 'kraken',
    name: 'Kraken',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Kraken spot wallets.',
  },
  {
    key: 'evm_wallet',
    name: 'EVM On-Chain Wallet (Ethereum/L2)',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Ethereum and L2 public addresses.',
  },
  {
    key: 'solana_wallet',
    name: 'Solana On-Chain Wallet',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Solana public addresses.',
  },
  {
    key: 'bitcoin_xpub',
    name: 'Bitcoin Wallet',
    category: 'CRYPTO',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Bitcoin xpub watches.',
  },
  {
    key: 'ibkr',
    name: 'Interactive Brokers (IBKR)',
    category: 'BROKERAGE',
    regions: ['GLOBAL'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Interactive Brokers Flex Queries.',
  },
  {
    key: 'questrade',
    name: 'Questrade',
    category: 'BROKERAGE',
    regions: ['CA'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Questrade Canada.',
  },
  {
    key: 'trading212',
    name: 'Trading 212',
    category: 'BROKERAGE',
    regions: ['UK', 'EU'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Trading 212.',
  },
  {
    key: 'trade_republic',
    name: 'Trade Republic',
    category: 'BROKERAGE',
    regions: ['EU'],
    supportsWebhooks: false,
    supportsLiveSync: false,
    description: 'Catalog adapter for Trade Republic.',
  },
];

export type StoredConnectionConfig = ProviderConnectionConfigInput;

export interface RawProviderConnectionRow {
  id: string;
  familyId: string;
  providerKey: string;
  providerCategory: ProviderCategory;
  institutionName: string;
  status: ProviderStatus;
  lastSyncedAt: Date | null;
  encryptedCredentials: string | null;
  createdAt: Date;
}

export interface SanitizedProviderConnectionDto {
  id: string;
  familyId: string;
  providerKey: string;
  providerName: string;
  providerCategory: ProviderCategory;
  institutionName: string;
  status: ProviderStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  supportsLiveSync: boolean;
  hasCredentials: boolean;
  maskedApiKey: string | null;
  configSummary: {
    useTestnet: boolean;
    quoteCurrency: string | null;
    targetAccountId: string | null;
    tickers: string[];
    baseCurrency: string | null;
    targetCurrencies: string[];
  };
}

export function findAdapterInfo(providerKey: string): ProviderAdapterInfo | undefined {
  return PROVIDER_ADAPTER_CATALOG.find((a) => a.key === providerKey);
}

function normalizeUniqueUpperList(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of values) {
    const cleaned = item.trim().toUpperCase();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

export function decodeConnectionConfig(encrypted?: string | null): StoredConnectionConfig {
  if (!encrypted) return {};
  const decrypted = decryptSecret(encrypted);
  if (!decrypted) return {};
  try {
    const parsed = JSON.parse(decrypted) as StoredConnectionConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function encodeConnectionConfig(config: StoredConnectionConfig): string | null {
  const cleanedEntries = Object.entries(config).filter(([, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    return true;
  });
  if (cleanedEntries.length === 0) return null;
  return encryptSecret(JSON.stringify(Object.fromEntries(cleanedEntries)));
}

export function mergeConnectionConfig(
  existing: StoredConnectionConfig,
  patch?: ProviderConnectionConfigInput
): StoredConnectionConfig {
  if (!patch) return { ...existing };

  const next: StoredConnectionConfig = {
    ...existing,
    ...(patch.apiKey ? { apiKey: patch.apiKey.trim() } : {}),
    ...(patch.apiSecret ? { apiSecret: patch.apiSecret.trim() } : {}),
    ...(patch.useTestnet !== undefined ? { useTestnet: patch.useTestnet } : {}),
    ...(patch.quoteCurrency ? { quoteCurrency: patch.quoteCurrency.trim().toUpperCase() } : {}),
    ...(patch.targetAccountId ? { targetAccountId: patch.targetAccountId } : {}),
  };

  if (patch.tickers !== undefined) {
    next.tickers = normalizeUniqueUpperList(patch.tickers) ?? [];
  }
  if (patch.baseCurrency !== undefined) {
    next.baseCurrency = patch.baseCurrency.trim().toUpperCase();
  }
  if (patch.targetCurrencies !== undefined) {
    next.targetCurrencies = normalizeUniqueUpperList(patch.targetCurrencies) ?? [];
  }

  return next;
}

export function maskSecret(secret?: string): string | null {
  if (!secret || !secret.trim()) return null;
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

/**
 * Projects a DB ProviderConnection into a safe DTO. Never returns `encryptedCredentials` or raw secrets.
 */
export function sanitizeConnectionForClient(
  conn: RawProviderConnectionRow,
  linkedAccountId?: string | null
): SanitizedProviderConnectionDto {
  const adapter = findAdapterInfo(conn.providerKey);
  const config = decodeConnectionConfig(conn.encryptedCredentials);

  return {
    id: conn.id,
    familyId: conn.familyId,
    providerKey: conn.providerKey,
    providerName: adapter?.name ?? conn.providerKey,
    providerCategory: conn.providerCategory,
    institutionName: conn.institutionName,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
    createdAt: conn.createdAt.toISOString(),
    supportsLiveSync: Boolean(adapter?.supportsLiveSync ?? LIVE_SYNC_ADAPTER_KEYS.has(conn.providerKey)),
    hasCredentials: Boolean(config.apiKey && config.apiSecret),
    maskedApiKey: maskSecret(config.apiKey),
    configSummary: {
      useTestnet: Boolean(config.useTestnet),
      quoteCurrency: config.quoteCurrency ?? null,
      targetAccountId: config.targetAccountId ?? linkedAccountId ?? null,
      tickers: config.tickers ?? [],
      baseCurrency: config.baseCurrency ?? null,
      targetCurrencies: config.targetCurrencies ?? [],
    },
  };
}
