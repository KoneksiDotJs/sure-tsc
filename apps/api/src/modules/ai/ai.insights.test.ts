import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../app.js';
import { hashPassword, signSessionToken } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { accountsService } from '../accounts/accounts.service.js';
import { aiService } from './ai.service.js';

const app = createApp();
const testFamilyIds: string[] = [];
const testUserIds: string[] = [];

async function createInsightTestFamily(baseCurrency: string, locale = 'en-US') {
  const familyId = randomUUID();
  const userId = randomUUID();

  await prisma.family.create({
    data: {
      id: familyId,
      name: 'Insight Test Family',
      baseCurrency,
      aiEnabled: false,
      locale,
      dateFormat: 'YYYY-MM-DD',
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      email: `insight-${userId.slice(0, 8)}@sure-insights.test`,
      passwordHash: hashPassword('TestPass123!'),
      name: 'Insight Tester',
      mfaEnabled: false,
      isSuperAdmin: false,
    },
  });

  await prisma.familyMembership.create({
    data: { familyId, userId, role: 'OWNER' },
  });

  testFamilyIds.push(familyId);
  testUserIds.push(userId);

  return {
    familyId,
    authToken: signSessionToken({ userId, familyId, role: 'OWNER' }),
  };
}

describe('PostgreSQL API Integration Tests — Currency-Aware Proactive Insights', () => {
  afterEach(async () => {
    const fIds = [...testFamilyIds];
    const uIds = [...testUserIds];
    testFamilyIds.length = 0;
    testUserIds.length = 0;
    if (fIds.length > 0) {
      await prisma.family.deleteMany({ where: { id: { in: fIds } } });
    }
    if (uIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: uIds } } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Does not trigger $100,000 USD milestone for IDR net worth of Rp7,836,123 and prunes legacy duplicates', async () => {
    const fam = await createInsightTestFamily('IDR');
    await accountsService.createAccount(fam.familyId, {
      name: 'BCA Tabungan',
      accountType: 'DEPOSITORY',
      currency: 'IDR',
      initialBalance: '7836123.0000',
      color: '#078C52',
      icon: 'Landmark',
      subtypeDetails: { accountSubtype: 'CHECKING' },
    });

    // Simulate legacy duplicated USD-hardcoded insights stored in DB
    await prisma.insight.createMany({
      data: [
        {
          familyId: fam.familyId,
          type: 'NET_WORTH_MILESTONE',
          severity: 'POSITIVE',
          title: 'Net Worth Milestone Reached',
          description:
            'Your family net worth exceeds $100,000 across liquid, investment, and property accounts.',
          metricAmount: '7836123.0000',
        },
        {
          familyId: fam.familyId,
          type: 'NET_WORTH_MILESTONE',
          severity: 'POSITIVE',
          title: 'Net Worth Milestone Reached',
          description:
            'Your family net worth exceeds $100,000 across liquid, investment, and property accounts.',
          metricAmount: '7836123.0000',
        },
      ],
    });

    const generated = await aiService.generateProactiveInsights(fam.familyId);
    expect(generated).toHaveLength(0);

    const res = await request(app)
      .get('/api/v1/ai/insights')
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('2. Formats milestone threshold in family.baseCurrency (IDR) and deduplicates repeated sync calls', async () => {
    const fam = await createInsightTestFamily('IDR', 'en-US');
    await accountsService.createAccount(fam.familyId, {
      name: 'Priority Portfolio',
      accountType: 'INVESTMENT',
      currency: 'IDR',
      initialBalance: '2500000000.0000',
      color: '#3b82f6',
      icon: 'TrendingUp',
      subtypeDetails: { accountSubtype: 'BROKERAGE', taxAdvantaged: false },
    });

    await aiService.generateProactiveInsights(fam.familyId);
    await aiService.generateProactiveInsights(fam.familyId);
    await aiService.generateProactiveInsights(fam.familyId);

    const res = await request(app)
      .get('/api/v1/ai/insights')
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Net Worth Milestone Reached');
    expect(res.body.data[0].description).toContain('Rp');
    expect(res.body.data[0].description).not.toContain('$100,000');
  });
});
