import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../app.js';
import { hashPassword, signSessionToken } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { accountsService } from '../accounts/accounts.service.js';
import { syncFrankfurterConnection } from './adapters/frankfurter.adapter.js';
import { syncService } from './sync.service.js';

const app = createApp();
const syncTestFamilyIds: string[] = [];
const syncTestUserIds: string[] = [];
const TRACKED_TEST_TICKERS = ['BBCA.JK', 'TLKM.JK', 'ETH', 'USDT', 'NVDA'];
const SYNTHETIC_TEST_CURRENCIES = ['XTS', 'XTI', 'XSG'];
type SecuritySnapshot = {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: string;
  assetClass: string;
};
let preTestSecurities = new Map<string, SecuritySnapshot>();

async function createIsolatedSyncFamily(baseCurrency = 'IDR') {
  const familyId = randomUUID();
  const userId = randomUUID();

  await prisma.family.create({
    data: {
      id: familyId,
      name: 'Sync Test Family',
      baseCurrency,
      aiEnabled: false,
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      email: `sync-${userId.slice(0, 8)}@sure-sync.test`,
      passwordHash: hashPassword('TestPass123!'),
      name: 'Sync Tester',
      mfaEnabled: false,
      isSuperAdmin: false,
    },
  });

  await prisma.familyMembership.create({
    data: { familyId, userId, role: 'OWNER' },
  });

  syncTestFamilyIds.push(familyId);
  syncTestUserIds.push(userId);

  return {
    familyId,
    userId,
    authToken: signSessionToken({ userId, familyId, role: 'OWNER' }),
  };
}

describe('PostgreSQL API Integration Tests — Sync Connections, Tenant Isolation & Live Adapters', () => {
  beforeEach(async () => {
    const existing = await prisma.security.findMany({
      where: { ticker: { in: TRACKED_TEST_TICKERS } },
    });
    preTestSecurities = new Map(
      existing.map((s) => [
        s.ticker,
        {
          ticker: s.ticker,
          name: s.name,
          currency: s.currency,
          currentPrice: s.currentPrice.toFixed(4),
          assetClass: s.assetClass,
        },
      ])
    );
  });

  afterEach(async () => {
    const fIds = [...syncTestFamilyIds];
    const uIds = [...syncTestUserIds];
    syncTestFamilyIds.length = 0;
    syncTestUserIds.length = 0;
    if (fIds.length > 0) {
      await prisma.family.deleteMany({ where: { id: { in: fIds } } });
    }
    if (uIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: uIds } } });
    }

    await prisma.exchangeRate.deleteMany({
      where: {
        OR: [
          { baseCurrency: { in: SYNTHETIC_TEST_CURRENCIES } },
          { targetCurrency: { in: SYNTHETIC_TEST_CURRENCIES } },
        ],
      },
    });

    for (const ticker of TRACKED_TEST_TICKERS) {
      const prev = preTestSecurities.get(ticker);
      if (prev) {
        await prisma.security.updateMany({
          where: { ticker },
          data: {
            name: prev.name,
            currency: prev.currency,
            currentPrice: prev.currentPrice,
            assetClass: prev.assetClass,
          },
        });
      } else {
        await prisma.security.deleteMany({
          where: { ticker, holdings: { none: {} } },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Enforces cross-family 404 isolation on update, sync, and delete of connections', async () => {
    const famA = await createIsolatedSyncFamily('IDR');
    const famB = await createIsolatedSyncFamily('USD');

    const createRes = await request(app)
      .post('/api/v1/sync/connections')
      .set('Authorization', `Bearer ${famA.authToken}`)
      .send({
        providerKey: 'binance',
        institutionName: 'My Binance',
        config: {
          apiKey: 'test_api_key_abcdef',
          apiSecret: 'test_api_secret_123456',
          quoteCurrency: 'USD',
        },
      });

    expect(createRes.status).toBe(201);
    const connId = createRes.body.data.id as string;
    expect(createRes.body.data.providerName).toBe('Binance');
    expect(createRes.body.data.hasCredentials).toBe(true);
    expect(JSON.stringify(createRes.body.data)).not.toContain('test_api_secret_123456');

    // Family B cannot update, sync, or delete Family A's connection
    const patchForeign = await request(app)
      .patch(`/api/v1/sync/connections/${connId}`)
      .set('Authorization', `Bearer ${famB.authToken}`)
      .send({ institutionName: 'Hijacked' });
    expect(patchForeign.status).toBe(404);

    const syncForeign = await request(app)
      .post(`/api/v1/sync/connections/${connId}/sync`)
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(syncForeign.status).toBe(404);

    const delForeign = await request(app)
      .delete(`/api/v1/sync/connections/${connId}`)
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(delForeign.status).toBe(404);
  });

  it('2. Updates connection config, deletes connection cleanly, and unlinks linked accounts', async () => {
    const fam = await createIsolatedSyncFamily('IDR');
    const cryptoAcc = await accountsService.createAccount(fam.familyId, {
      name: 'Binance Crypto',
      accountType: 'CRYPTO',
      currency: 'USD',
      initialBalance: '0.0000',
      color: '#f59e0b',
      icon: 'Bitcoin',
      subtypeDetails: { walletType: 'EXCHANGE', exchangeName: 'Binance' },
    });

    const createRes = await request(app)
      .post('/api/v1/sync/connections')
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({
        providerKey: 'yahoo_finance',
        institutionName: 'IDX & US Watchlist',
        accountId: cryptoAcc.id,
        config: {
          tickers: ['BBCA.JK', 'VOO'],
        },
      });
    expect(createRes.status).toBe(201);
    const connId = createRes.body.data.id as string;

    const linkedAcc = await prisma.account.findUnique({ where: { id: cryptoAcc.id } });
    expect(linkedAcc?.providerConnectionId).toBe(connId);

    // Update tickers
    const patchRes = await request(app)
      .patch(`/api/v1/sync/connections/${connId}`)
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({
        institutionName: 'IDX Blue Chips',
        config: { tickers: ['BBCA.JK', 'BBRI.JK', 'TLKM.JK'] },
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.institutionName).toBe('IDX Blue Chips');
    expect(patchRes.body.data.configSummary.tickers).toEqual(['BBCA.JK', 'BBRI.JK', 'TLKM.JK']);

    // Delete connection and verify account unlink
    const delRes = await request(app)
      .delete(`/api/v1/sync/connections/${connId}`)
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);

    const unlinkedAcc = await prisma.account.findUnique({ where: { id: cryptoAcc.id } });
    expect(unlinkedAcc?.providerConnectionId).toBeNull();

    const overviewRes = await request(app)
      .get('/api/v1/sync')
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.connections).toHaveLength(0);
  });

  it('3. Runs live Binance, Yahoo Finance, and Frankfurter FX sync pipelines end-to-end', async () => {
    const fam = await createIsolatedSyncFamily('IDR');
    const cryptoAcc = await accountsService.createAccount(fam.familyId, {
      name: 'Binance Spot Wallet',
      accountType: 'CRYPTO',
      currency: 'USD',
      initialBalance: '0.0000',
      color: '#f59e0b',
      icon: 'Bitcoin',
      subtypeDetails: { walletType: 'EXCHANGE', exchangeName: 'Binance' },
    });

    const fxConn = await syncService.createConnection(fam.familyId, {
      providerKey: 'frankfurter_fx',
      institutionName: 'ECB FX Monitor',
      config: { baseCurrency: 'XTS', targetCurrencies: ['XTI', 'XSG'] },
    });
    const yahooConn = await syncService.createConnection(fam.familyId, {
      providerKey: 'yahoo_finance',
      institutionName: 'IDX Market Quotes',
      config: { tickers: ['BBCA.JK'] },
    });
    const binanceConn = await syncService.createConnection(fam.familyId, {
      providerKey: 'binance',
      institutionName: 'Binance Spot',
      accountId: cryptoAcc.id,
      config: {
        apiKey: 'binance_key_1234567890',
        apiSecret: 'binance_secret_1234567890',
        quoteCurrency: 'USD',
        targetAccountId: cryptoAcc.id,
      },
    });

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('https://api.frankfurter.app/latest')) {
        return new Response(
          JSON.stringify({
            base: 'XTS',
            date: '2026-11-15',
            rates: { XTI: 16000, XSG: 1.35 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('query1.finance.yahoo.com/v8/finance/chart/BBCA.JK')) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'BBCA.JK',
                    shortName: 'Bank Central Asia',
                    currency: 'IDR',
                    instrumentType: 'EQUITY',
                    regularMarketPrice: 9975,
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://api.binance.com/api/v3/account')) {
        return new Response(
          JSON.stringify({
            balances: [
              { asset: 'ETH', free: '2.00000000', locked: '0.00000000' },
              { asset: 'USDT', free: '500.00000000', locked: '0.00000000' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://api.binance.com/api/v3/ticker/price')) {
        return new Response(
          JSON.stringify([{ symbol: 'ETHUSDT', price: '3000.00' }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const syncResult = await syncService.runSyncAll(fam.familyId, mockFetch);
    expect(syncResult.errors).toEqual([]);
    expect(syncResult.syncedConnections).toBe(3);

    // Verify Binance portfolio valuation materialized into Crypto Account (2 * 3000 + 500 = 6500 USD)
    const updatedCrypto = await prisma.account.findUnique({ where: { id: cryptoAcc.id } });
    expect(updatedCrypto?.balance.toFixed(4)).toBe('6500.0000');

    // Verify Holdings on Crypto Account
    const holdings = await prisma.holding.findMany({
      where: { accountId: cryptoAcc.id },
      include: { security: true },
    });
    expect(holdings).toHaveLength(2);
    expect(holdings.find((h) => h.security.ticker === 'ETH')?.marketValue.toFixed(4)).toBe(
      '6000.0000'
    );

    // Verify GET /api/v1/sync returns market quotes & FX rates
    const overviewRes = await request(app)
      .get('/api/v1/sync')
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(overviewRes.status).toBe(200);
    expect(
      overviewRes.body.data.marketQuotes.some(
        (q: { ticker: string; currentPrice: string }) =>
          q.ticker === 'BBCA.JK' && q.currentPrice === '9975.0000'
      )
    ).toBe(true);
    expect(
      overviewRes.body.data.exchangeRates.some(
        (r: { baseCurrency: string; targetCurrency: string; rate: string }) =>
          r.baseCurrency === 'XTS' && r.targetCurrency === 'XTI' && r.rate === '16000.00000000'
      )
    ).toBe(true);
    expect(
      overviewRes.body.data.connections.some((c: { id: string }) => c.id === fxConn.id)
    ).toBe(true);
    expect(
      overviewRes.body.data.connections.some((c: { id: string }) => c.id === yahooConn.id)
    ).toBe(true);
    expect(
      overviewRes.body.data.connections.some((c: { id: string }) => c.id === binanceConn.id)
    ).toBe(true);
    expect(
      overviewRes.body.data.familyHoldings.some(
        (h: { ticker: string; accountId: string; marketValue: string }) =>
          h.ticker === 'ETH' && h.accountId === cryptoAcc.id && h.marketValue === '6000.0000'
      )
    ).toBe(true);
  });

  it('4. Fetches market & FX history, adds watchlist tickers, and enforces familyHoldings tenant isolation', async () => {
    const famA = await createIsolatedSyncFamily('IDR');
    const famB = await createIsolatedSyncFamily('USD');

    const accB = await accountsService.createAccount(famB.familyId, {
      name: 'Family B Brokerage',
      accountType: 'INVESTMENT',
      currency: 'USD',
      initialBalance: '0.0000',
      color: '#3b82f6',
      icon: 'TrendingUp',
      subtypeDetails: { accountSubtype: 'BROKERAGE', taxAdvantaged: false },
    });
    await accountsService.upsertAccountHolding(famB.familyId, accB.id, {
      ticker: 'NVDA',
      securityName: 'NVIDIA Corp',
      assetClass: 'EQUITY',
      qty: '10.0000',
      avgCostBasis: '100.0000',
      currentPrice: '140.0000',
    });

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('query1.finance.yahoo.com/v8/finance/chart/TLKM.JK')) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'TLKM.JK',
                    shortName: 'Telkom Indonesia',
                    currency: 'IDR',
                    instrumentType: 'EQUITY',
                    regularMarketPrice: 2850,
                  },
                  timestamp: [
                    Math.floor(new Date('2026-11-10T00:00:00Z').getTime() / 1000),
                    Math.floor(new Date('2026-11-15T00:00:00Z').getTime() / 1000),
                  ],
                  indicators: {
                    quote: [{ close: [2750, 2850] }],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://api.binance.com/api/v3/klines')) {
        return new Response(
          JSON.stringify([
            [new Date('2026-11-14T00:00:00Z').getTime(), '2900', '3000', '2850', '2950'],
            [new Date('2026-11-15T00:00:00Z').getTime(), '2950', '3150', '2940', '3100'],
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://api.frankfurter.app/')) {
        return new Response(
          JSON.stringify({
            base: 'SGD',
            rates: {
              '2026-11-14': { IDR: 11850 },
              '2026-11-15': { IDR: 11950 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const added = await syncService.addWatchlistTicker(famA.familyId, 'tlkm.jk', mockFetch);
    expect(added.quote.ticker).toBe('TLKM.JK');
    expect(added.quote.currentPrice).toBe('2850.0000');

    const stockHistory = await syncService.getMarketHistory(
      { kind: 'security', ticker: 'TLKM.JK', range: '1mo' },
      mockFetch
    );
    expect(stockHistory.symbol).toBe('TLKM.JK');
    expect(stockHistory.points).toHaveLength(2);
    expect(stockHistory.latestClose).toBe('2850.0000');

    // Crypto ticker fallback to Binance Klines
    const klineHistory = await syncService.getMarketHistory(
      { kind: 'security', ticker: 'ETH', range: '5d' },
      mockFetch
    );
    expect(klineHistory.name).toContain('Binance');
    expect(klineHistory.latestClose).toBe('3100.0000');

    const fxHistory = await syncService.getMarketHistory(
      { kind: 'fx', from: 'SGD', to: 'IDR', range: '1mo' },
      mockFetch
    );
    expect(fxHistory.symbol).toBe('SGD/IDR');
    expect(fxHistory.latestClose).toBe('11950.000000');

    // Family A's overview MUST NOT leak Family B's NVDA holding
    const famAOverview = await request(app)
      .get('/api/v1/sync')
      .set('Authorization', `Bearer ${famA.authToken}`);
    expect(famAOverview.status).toBe(200);
    expect(famAOverview.body.data.familyHoldings).toHaveLength(0);

    // Family B sees only its NVDA holding with unrealized gain (140 - 100) * 10 = 400.0000
    const famBOverview = await request(app)
      .get('/api/v1/sync')
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(famBOverview.status).toBe(200);
    expect(famBOverview.body.data.familyHoldings).toHaveLength(1);
    expect(famBOverview.body.data.familyHoldings[0].ticker).toBe('NVDA');
    expect(famBOverview.body.data.familyHoldings[0].unrealizedGain).toBe('400.0000');

    // Auth & query parameter guard on /markets/history & /watchlist
    const unauthRes = await request(app).get('/api/v1/sync/markets/history?kind=security&ticker=TLKM.JK');
    expect(unauthRes.status).toBe(401);

    const missingTickerRes = await request(app)
      .get('/api/v1/sync/markets/history?kind=security')
      .set('Authorization', `Bearer ${famA.authToken}`);
    expect(missingTickerRes.status).toBe(400);
  });

  it('5. Refines weak-base FX rates (e.g. IDR->USD < 0.01) and clears stale newer weekend/test rows', async () => {
    const fam = await createIsolatedSyncFamily('XTI');
    // Seed a stale newer weekend/test row that would otherwise shadow 2026-11-13
    await prisma.exchangeRate.create({
      data: {
        baseCurrency: 'XTS',
        targetCurrency: 'XTI',
        date: new Date('2026-11-15T00:00:00.000Z'),
        rate: '16000.00000000',
      },
    });

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('from=XTI')) {
        return new Response(
          JSON.stringify({
            base: 'XTI',
            date: '2026-11-13',
            rates: { XTS: 0.00005481 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('from=XTS&to=XTI')) {
        return new Response(
          JSON.stringify({
            base: 'XTS',
            date: '2026-11-13',
            rates: { XTI: 18245 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await syncFrankfurterConnection({
      familyId: fam.familyId,
      config: { baseCurrency: 'XTI', targetCurrencies: ['XTS'] },
      fetchImpl: mockFetch,
    });

    const strongToWeak = result.pairs.find(
      (p) => p.baseCurrency === 'XTS' && p.targetCurrency === 'XTI'
    );
    expect(strongToWeak?.rate).toBe('18245.00000000');

    // Sync overview MUST now surface 18245 (2026-11-13), not the stale 16000 (2026-11-15) row
    const overview = await syncService.getSyncOverview(fam.familyId);
    const syncedPair = overview.exchangeRates.find(
      (r) => r.baseCurrency === 'XTS' && r.targetCurrency === 'XTI'
    );
    expect(syncedPair?.rate).toBe('18245.00000000');
    expect(syncedPair?.date).toBe('2026-11-13');
  });
});
