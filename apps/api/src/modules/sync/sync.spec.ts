import { describe, expect, it } from 'vitest';
import {
  decodeConnectionConfig,
  encodeConnectionConfig,
  mergeConnectionConfig,
  sanitizeConnectionForClient,
} from './sync.adapters.js';
import {
  buildBinanceSignature,
  parseBinanceSpotAssets,
} from './adapters/binance.adapter.js';
import { parseYahooChartResponse } from './adapters/yahoo.adapter.js';
import { parseFrankfurterRates } from './adapters/frankfurter.adapter.js';
import {
  parseFrankfurterHistoryPayload,
  parseYahooHistoryPayload,
} from './adapters/market-history.adapter.js';

describe('Sync Adapters & Credential Security Unit Tests', () => {
  it('encrypts connection config at rest and redacts secrets on client projection', () => {
    const encrypted = encodeConnectionConfig({
      apiKey: 'binance_read_key_1234567890',
      apiSecret: 'super_secret_hmac_key_0987654321',
      useTestnet: true,
      quoteCurrency: 'USD',
    });
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain('binance_read_key');
    expect(encrypted).not.toContain('super_secret_hmac_key');

    const decoded = decodeConnectionConfig(encrypted);
    expect(decoded.apiKey).toBe('binance_read_key_1234567890');
    expect(decoded.apiSecret).toBe('super_secret_hmac_key_0987654321');

    // Updating label/testnet without re-entering keys preserves existing secret pair
    const merged = mergeConnectionConfig(decoded, { useTestnet: false });
    expect(merged.apiKey).toBe('binance_read_key_1234567890');
    expect(merged.apiSecret).toBe('super_secret_hmac_key_0987654321');
    expect(merged.useTestnet).toBe(false);

    const dto = sanitizeConnectionForClient({
      id: '11111111-1111-1111-1111-111111111111',
      familyId: '22222222-2222-2222-2222-222222222222',
      providerKey: 'binance',
      providerCategory: 'CRYPTO',
      institutionName: 'Binance Spot',
      status: 'CONNECTED',
      lastSyncedAt: null,
      encryptedCredentials: encrypted,
      createdAt: new Date('2026-11-15T00:00:00Z'),
    });

    expect(dto.providerName).toBe('Binance');
    expect(dto.supportsLiveSync).toBe(true);
    expect(dto.hasCredentials).toBe(true);
    expect(dto.maskedApiKey).toBe('bina••••7890');
    expect(JSON.stringify(dto)).not.toContain('super_secret_hmac_key');
    expect(JSON.stringify(dto)).not.toContain('binance_read_key_1234567890');
  });

  it('signs Binance query strings with HMAC-SHA256 and computes Decimal spot valuations', () => {
    const sig = buildBinanceSignature('timestamp=1700000000000&recvWindow=5000', 'my_secret');
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);

    const parsed = parseBinanceSpotAssets({
      balances: [
        { asset: 'BTC', free: '0.50000000', locked: '0.10000000' },
        { asset: 'USDT', free: '1000.00000000', locked: '0.00000000' },
        { asset: 'DOGE', free: '0.00000000', locked: '0.00000000' },
      ],
      tickers: [{ symbol: 'BTCUSDT', price: '90000.00' }],
      accountCurrency: 'USD',
      usdToAccountRate: '1.0000',
    });

    expect(parsed.assets).toHaveLength(2);
    expect(parsed.assets[0]!.asset).toBe('BTC');
    expect(parsed.assets[0]!.qty).toBe('0.60000000');
    expect(parsed.assets[0]!.marketValueAccountCurrency).toBe('54000.0000');
    expect(parsed.assets[1]!.asset).toBe('USDT');
    expect(parsed.assets[1]!.marketValueAccountCurrency).toBe('1000.0000');
    expect(parsed.totalAccountValue).toBe('55000.0000');
  });

  it('parses Yahoo Finance chart metadata including Indonesian IDX (.JK) equities', () => {
    const idxQuote = parseYahooChartResponse(
      {
        chart: {
          result: [
            {
              meta: {
                symbol: 'BBCA.JK',
                shortName: 'Bank Central Asia Tbk',
                currency: 'IDR',
                instrumentType: 'EQUITY',
                regularMarketPrice: 10250,
              },
            },
          ],
        },
      },
      'BBCA.JK'
    );

    expect(idxQuote).toEqual({
      ticker: 'BBCA.JK',
      name: 'Bank Central Asia Tbk',
      currency: 'IDR',
      currentPrice: '10250.0000',
      assetClass: 'EQUITY',
    });
  });

  it('computes direct and inverse Decimal(19, 8) exchange rates from Frankfurter response', () => {
    const parsed = parseFrankfurterRates({
      base: 'USD',
      date: '2026-11-15',
      rates: {
        IDR: 16000,
        SGD: 1.34,
        ZERO: 0,
      },
    });

    expect(parsed.baseCurrency).toBe('USD');
    expect(parsed.rateDate).toBe('2026-11-15');
    expect(parsed.pairs).toHaveLength(4);
    expect(parsed.pairs).toContainEqual({
      baseCurrency: 'USD',
      targetCurrency: 'IDR',
      rate: '16000.00000000',
    });
    expect(parsed.pairs).toContainEqual({
      baseCurrency: 'IDR',
      targetCurrency: 'USD',
      rate: '0.00006250',
    });
  });

  it('parses Yahoo historical OHLC closes and computes Decimal change, high, and low KPIs', () => {
    const t1 = Math.floor(new Date('2026-11-01T00:00:00Z').getTime() / 1000);
    const t2 = Math.floor(new Date('2026-11-02T00:00:00Z').getTime() / 1000);
    const t3 = Math.floor(new Date('2026-11-03T00:00:00Z').getTime() / 1000);

    const parsed = parseYahooHistoryPayload(
      {
        chart: {
          result: [
            {
              meta: {
                symbol: 'BBCA.JK',
                shortName: 'Bank Central Asia Tbk',
                currency: 'IDR',
              },
              timestamp: [t1, t2, t3],
              indicators: {
                quote: [{ close: [10000, 10500, 10200] }],
              },
            },
          ],
        },
      },
      'BBCA.JK',
      '1mo'
    );

    expect(parsed.kind).toBe('security');
    expect(parsed.symbol).toBe('BBCA.JK');
    expect(parsed.currency).toBe('IDR');
    expect(parsed.periodOpen).toBe('10000.0000');
    expect(parsed.latestClose).toBe('10200.0000');
    expect(parsed.periodHigh).toBe('10500.0000');
    expect(parsed.periodLow).toBe('10000.0000');
    expect(parsed.changeAmount).toBe('200.0000');
    expect(parsed.changePercent).toBe('2.0000');
    expect(parsed.points).toHaveLength(3);
  });

  it('parses Frankfurter time-series rates in chronological order with 6-decimal FX precision', () => {
    const fxHistory = parseFrankfurterHistoryPayload(
      {
        base: 'USD',
        rates: {
          '2026-11-03': { IDR: 16200 },
          '2026-11-01': { IDR: 16000 },
          '2026-11-02': { IDR: 15900 },
        },
      },
      'USD',
      'IDR',
      '1mo'
    );

    expect(fxHistory.kind).toBe('fx');
    expect(fxHistory.symbol).toBe('USD/IDR');
    expect(fxHistory.currency).toBe('IDR');
    expect(fxHistory.points.map((p) => p.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    expect(fxHistory.periodOpen).toBe('16000.000000');
    expect(fxHistory.latestClose).toBe('16200.000000');
    expect(fxHistory.periodHigh).toBe('16200.000000');
    expect(fxHistory.periodLow).toBe('15900.000000');
    expect(fxHistory.changeAmount).toBe('200.0000');
    expect(fxHistory.changePercent).toBe('1.2500');
  });
});
