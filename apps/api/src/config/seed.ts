import { Prisma } from '@prisma/client';
import { prisma, parseIsoDate } from './prisma.js';
import { hashPassword } from './crypto.js';
import { BalanceService } from '../modules/balances/balance.service.js';

export const DEMO_FAMILY_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000002';

async function ensureDemoHoldings(): Promise<void> {
  const existingCount = await prisma.holding.count({
    where: { account: { familyId: DEMO_FAMILY_ID } },
  });
  if (existingCount > 0) return;

  const [brokerage, crypto] = await Promise.all([
    prisma.account.findFirst({
      where: { familyId: DEMO_FAMILY_ID, accountType: 'INVESTMENT' },
    }),
    prisma.account.findFirst({
      where: { familyId: DEMO_FAMILY_ID, accountType: 'CRYPTO' },
    }),
  ]);

  const [voo, qqq, eth] = await Promise.all([
    prisma.security.upsert({
      where: { ticker: 'VOO' },
      update: { currentPrice: '542.0354' },
      create: {
        ticker: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        currency: 'USD',
        currentPrice: '542.0354',
        assetClass: 'ETF',
      },
    }),
    prisma.security.upsert({
      where: { ticker: 'QQQ' },
      update: { currentPrice: '504.2500' },
      create: {
        ticker: 'QQQ',
        name: 'Invesco QQQ Trust',
        currency: 'USD',
        currentPrice: '504.2500',
        assetClass: 'ETF',
      },
    }),
    prisma.security.upsert({
      where: { ticker: 'ETH' },
      update: { currentPrice: '3240.0000' },
      create: {
        ticker: 'ETH',
        name: 'Ethereum',
        currency: 'USD',
        currentPrice: '3240.0000',
        assetClass: 'CRYPTO',
      },
    }),
  ]);

  if (brokerage) {
    await prisma.holding.upsert({
      where: { accountId_securityId: { accountId: brokerage.id, securityId: voo.id } },
      update: {},
      create: {
        accountId: brokerage.id,
        securityId: voo.id,
        qty: '400.00000000',
        avgCostBasis: '445.0000',
        marketValue: '216814.1600',
      },
    });
    await prisma.holding.upsert({
      where: { accountId_securityId: { accountId: brokerage.id, securityId: qqq.id } },
      update: {},
      create: {
        accountId: brokerage.id,
        securityId: qqq.id,
        qty: '189.56000000',
        avgCostBasis: '412.5000',
        marketValue: '95585.6300',
      },
    });
  }

  if (crypto) {
    await prisma.holding.upsert({
      where: { accountId_securityId: { accountId: crypto.id, securityId: eth.id } },
      update: {},
      create: {
        accountId: crypto.id,
        securityId: eth.id,
        qty: '20.00000000',
        avgCostBasis: '2380.0000',
        marketValue: '64800.0000',
      },
    });
  }
}

export async function seedDatabase(): Promise<void> {
  const existingFamily = await prisma.family.findUnique({
    where: { id: DEMO_FAMILY_ID },
  });
  if (existingFamily) {
    await ensureDemoHoldings();
    return;
  }

  const alexPasswordHash = hashPassword('SureDemo2026!');

  await prisma.family.create({
    data: {
      id: DEMO_FAMILY_ID,
      name: 'The Sterling Family Office',
      baseCurrency: 'USD',
      aiEnabled: true,
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
    },
  });

  await prisma.user.create({
    data: {
      id: DEMO_USER_ID,
      email: 'alex@sterling.family',
      passwordHash: alexPasswordHash,
      name: 'Alex Sterling',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
      isSuperAdmin: true,
    },
  });

  await prisma.familyMembership.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      userId: DEMO_USER_ID,
      role: 'OWNER',
    },
  });

  const catSalary = await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Salary & Compensation',
      classification: 'INCOME',
      color: '#10b981',
      icon: 'Briefcase',
    },
  });
  await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Dividends & Yield',
      classification: 'INCOME',
      color: '#14b8a6',
      icon: 'TrendingUp',
    },
  });
  const catHousing = await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Housing & Mortgage',
      classification: 'EXPENSE',
      color: '#8b5cf6',
      icon: 'Home',
    },
  });
  const catGroceries = await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Groceries & Dining',
      classification: 'EXPENSE',
      color: '#f59e0b',
      icon: 'Utensils',
    },
  });
  const catSoftware = await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Software & Cloud',
      classification: 'EXPENSE',
      color: '#3b82f6',
      icon: 'Zap',
    },
  });
  await prisma.category.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Shopping & Gear',
      classification: 'EXPENSE',
      color: '#ec4899',
      icon: 'ShoppingBag',
    },
  });

  const merchStripe = await prisma.merchant.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'Stripe Payroll', color: '#6366f1', icon: 'Briefcase' },
  });
  const merchWholeFoods = await prisma.merchant.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'Whole Foods Market', color: '#10b981', icon: 'Utensils' },
  });
  const merchAws = await prisma.merchant.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'Amazon Web Services', color: '#f59e0b', icon: 'Zap' },
  });
  const merchApple = await prisma.merchant.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'Apple Store', color: '#18181b', icon: 'ShoppingBag' },
  });

  const tagFamily = await prisma.tag.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'family-shared', color: '#8b5cf6' },
  });
  const tagTax = await prisma.tag.create({
    data: { familyId: DEMO_FAMILY_ID, name: 'tax-deductible', color: '#10b981' },
  });

  const accChecking = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Mercury Operating Checking',
      accountType: 'DEPOSITORY',
      classification: 'ASSET',
      currency: 'USD',
      balance: '48250.7500',
      color: '#10b981',
      icon: 'Wallet',
      subtypeDetails: { accountSubtype: 'CHECKING', institutionName: 'Mercury', apyPercent: '4.2500' },
    },
  });

  const accBrokerage = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Interactive Brokers Flagship',
      accountType: 'INVESTMENT',
      classification: 'ASSET',
      currency: 'USD',
      balance: '312400.0000',
      color: '#3b82f6',
      icon: 'TrendingUp',
      subtypeDetails: { accountSubtype: 'BROKERAGE', institutionName: 'IBKR', taxAdvantaged: false },
    },
  });

  const accCrypto = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Ledger Ethereum Cold Vault',
      accountType: 'CRYPTO',
      classification: 'ASSET',
      currency: 'USD',
      balance: '64800.0000',
      color: '#f59e0b',
      icon: 'Coins',
      subtypeDetails: { walletType: 'ON_CHAIN', chain: 'ETHEREUM', walletAddress: '0x71C...89A' },
    },
  });

  const accProperty = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Austin Modern Residence',
      accountType: 'PROPERTY',
      classification: 'ASSET',
      currency: 'USD',
      balance: '850000.0000',
      color: '#8b5cf6',
      icon: 'Home',
      subtypeDetails: {
        address: '742 Evergreen Terrace, Austin, TX',
        purchasePrice: '720000.0000',
        valuationSource: 'APPRAISAL',
      },
    },
  });

  const accVehicle = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: '2025 Rivian R1S Dual Max',
      accountType: 'VEHICLE',
      classification: 'ASSET',
      currency: 'USD',
      balance: '76500.0000',
      color: '#06b6d4',
      icon: 'Car',
      subtypeDetails: { make: 'Rivian', model: 'R1S', year: 2025, mileage: 6420 },
    },
  });

  const accCredit = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Amex Platinum Card',
      accountType: 'CREDIT_CARD',
      classification: 'LIABILITY',
      currency: 'USD',
      balance: '3420.5000',
      color: '#ef4444',
      icon: 'CreditCard',
      subtypeDetails: { creditLimit: '50000.0000', aprPercent: '21.9900', dueDay: 15, institutionName: 'American Express' },
    },
  });

  const accLoan = await prisma.account.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Primary Residence 30Y Mortgage',
      accountType: 'LOAN',
      classification: 'LIABILITY',
      currency: 'USD',
      balance: '485000.0000',
      color: '#f43f5e',
      icon: 'Landmark',
      subtypeDetails: {
        loanSubtype: 'MORTGAGE',
        principal: '485000.0000',
        interestRatePercent: '5.8750',
        termMonths: 360,
        rateType: 'FIXED',
      },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accChecking.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '36590.7500',
      currency: 'USD',
      name: 'November Opening Balance',
      excluded: true,
      valuation: { create: { kind: 'OPENING' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accChecking.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRANSACTION',
      date: parseIsoDate('2026-11-12'),
      amount: '14500.0000',
      currency: 'USD',
      name: 'Bi-Weekly Executive Compensation',
      notes: 'Direct deposit payroll',
      transaction: { create: { categoryId: catSalary.id, merchantId: merchStripe.id } },
      tags: { create: [{ tagId: tagFamily.id }] },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accChecking.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRANSACTION',
      date: parseIsoDate('2026-11-11'),
      amount: '-2840.0000',
      currency: 'USD',
      name: 'Monthly Mortgage Principal & Interest',
      notes: 'Auto-debit for Austin Residence',
      transaction: { create: { categoryId: catHousing.id } },
      tags: { create: [{ tagId: tagFamily.id }] },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCredit.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '5516.9500',
      currency: 'USD',
      name: 'Statement Opening Balance',
      excluded: true,
      valuation: { create: { kind: 'OPENING' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCredit.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRANSACTION',
      date: parseIsoDate('2026-11-10'),
      amount: '-312.4500',
      currency: 'USD',
      name: 'WHOLEFDS MKT #10248 AUSTIN',
      notes: 'Organic groceries & household supplies',
      transaction: { create: { categoryId: catGroceries.id, merchantId: merchWholeFoods.id } },
      tags: { create: [{ tagId: tagFamily.id }] },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCredit.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRANSACTION',
      date: parseIsoDate('2026-11-09'),
      amount: '-485.0000',
      currency: 'USD',
      name: 'AWS CLOUD INFRASTRUCTURE',
      notes: 'Self-hosted servers & S3 backups',
      transaction: { create: { categoryId: catSoftware.id, merchantId: merchAws.id } },
      tags: { create: [{ tagId: tagTax.id }] },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCredit.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRANSACTION',
      date: parseIsoDate('2026-11-04'),
      amount: '-1299.0000',
      currency: 'USD',
      name: 'APPLE STORE #R092 MAC MINI M4',
      notes: 'Workstation hardware upgrade',
      transaction: { create: { merchantId: merchApple.id } },
      tags: { create: [{ tagId: tagTax.id }] },
    },
  });

  const voo = await prisma.security.upsert({
    where: { ticker: 'VOO' },
    update: { currentPrice: '542.0354' },
    create: { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', currency: 'USD', currentPrice: '542.0354' },
  });

  await prisma.entry.create({
    data: {
      accountId: accBrokerage.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '309950.0000',
      currency: 'USD',
      name: 'Brokerage Opening Balance',
      excluded: true,
      valuation: { create: { kind: 'OPENING' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accBrokerage.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'TRADE',
      date: parseIsoDate('2026-11-08'),
      amount: '2450.0000',
      currency: 'USD',
      name: 'Vanguard S&P 500 ETF Quarterly Dividend',
      notes: 'Reinvested DRIP dividend',
      trade: {
        create: {
          securityId: voo.id,
          action: 'DIVIDEND',
          qty: '4.52000000',
          price: '542.0354',
          fees: '0.0000',
        },
      },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCrypto.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '64800.0000',
      currency: 'USD',
      name: 'On-Chain Portfolio Snapshot',
      excluded: true,
      valuation: { create: { kind: 'MARKET' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accProperty.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-05'),
      amount: '850000.0000',
      currency: 'USD',
      name: 'Q4 Market Valuation Anchor',
      notes: 'Travis County comparative market appraisal',
      excluded: true,
      valuation: { create: { kind: 'RECONCILIATION' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accVehicle.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '76500.0000',
      currency: 'USD',
      name: 'KBB Fair Market Value',
      excluded: true,
      valuation: { create: { kind: 'MARKET' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accCredit.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '1324.0500',
      currency: 'USD',
      name: 'Statement Opening Balance',
      excluded: true,
      valuation: { create: { kind: 'OPENING' } },
    },
  });

  await prisma.entry.create({
    data: {
      accountId: accLoan.id,
      familyId: DEMO_FAMILY_ID,
      entryType: 'VALUATION',
      date: parseIsoDate('2026-11-01'),
      amount: '485000.0000',
      currency: 'USD',
      name: 'Principal Balance Anchor',
      excluded: true,
      valuation: { create: { kind: 'RECONCILIATION' } },
    },
  });

  for (const acc of [accChecking, accBrokerage, accCrypto, accProperty, accVehicle, accCredit, accLoan]) {
    await BalanceService.materializeAccount(DEMO_FAMILY_ID, acc.id);
  }

  await prisma.rule.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      name: 'Auto-Categorize Whole Foods as Groceries',
      priority: 10,
      matchMode: 'ALL',
      isActive: true,
      conditions: [{ field: 'name', operator: 'contains', value: 'WHOLEFDS' }] as Prisma.InputJsonValue,
      actions: {
        setCategoryId: catGroceries.id,
        setMerchantId: merchWholeFoods.id,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.budget.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      month: '2026-11',
      expectedIncome: '14500.0000',
      rolloverEnabled: true,
      categories: {
        create: [
          { categoryId: catHousing.id, budgetedAmount: '3000.0000', rolloverEnabled: true },
          { categoryId: catGroceries.id, budgetedAmount: '1200.0000', rolloverEnabled: true },
          { categoryId: catSoftware.id, budgetedAmount: '600.0000', rolloverEnabled: true },
        ],
      },
    },
  });

  await prisma.goal.createMany({
    data: [
      {
        familyId: DEMO_FAMILY_ID,
        name: '6-Month Emergency Treasury Reserve',
        targetAmount: '100000.0000',
        currentAmount: '72500.0000',
        monthlyPledge: '4500.0000',
        targetDate: parseIsoDate('2027-05-01'),
        color: '#10b981',
        icon: 'Target',
      },
      {
        familyId: DEMO_FAMILY_ID,
        name: 'Lake Tahoe Cabin Down Payment',
        targetAmount: '250000.0000',
        currentAmount: '145000.0000',
        monthlyPledge: '6000.0000',
        targetDate: parseIsoDate('2028-04-01'),
        color: '#3b82f6',
        icon: 'Home',
      },
    ],
  });

  await prisma.recurringTransaction.createMany({
    data: [
      {
        familyId: DEMO_FAMILY_ID,
        accountId: accChecking.id,
        categoryId: catHousing.id,
        name: 'Chase Primary Residence Mortgage',
        amount: '-2840.0000',
        lastAmount: '-2840.0000',
        currency: 'USD',
        cadence: 'MONTHLY',
        nextOccurrenceDate: parseIsoDate('2026-12-01'),
        autoPay: true,
      },
      {
        familyId: DEMO_FAMILY_ID,
        accountId: accCredit.id,
        categoryId: catSoftware.id,
        merchantId: merchAws.id,
        name: 'AWS Cloud Infrastructure Cluster',
        amount: '-485.0000',
        lastAmount: '-410.0000',
        currency: 'USD',
        cadence: 'MONTHLY',
        nextOccurrenceDate: parseIsoDate('2026-12-09'),
        autoPay: true,
      },
    ],
  });

  const conn = await prisma.providerConnection.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      providerKey: 'plaid',
      providerCategory: 'BANKING',
      institutionName: 'Plaid (American Express)',
      status: 'WARNING',
      lastSyncedAt: new Date(),
    },
  });

  const batch = await prisma.financekitBatch.create({
    data: {
      familyId: DEMO_FAMILY_ID,
      providerConnectionId: conn.id,
      status: 'CONFLICT',
      itemCount: 1,
    },
  });

  const fkItem = await prisma.financekitItem.create({
    data: {
      batchId: batch.id,
      externalId: 'plaid_amex_dup_10248',
      payload: {
        externalId: 'plaid_amex_dup_10248',
        date: '2026-11-10',
        name: 'WHOLE FOODS MARKET #10248',
        amount: '-312.4500',
        currency: 'USD',
        accountName: 'Amex Platinum Card',
      } as Prisma.InputJsonValue,
      status: 'CONFLICT',
    },
  });

  await prisma.financekitConflict.create({
    data: {
      batchId: batch.id,
      itemId: fkItem.id,
      familyId: DEMO_FAMILY_ID,
      conflictType: 'DUPLICATE_ENTRY',
      incomingSummary: {
        externalId: 'plaid_amex_dup_10248',
        date: '2026-11-10',
        name: 'WHOLE FOODS MARKET #10248',
        amount: '-312.4500',
        currency: 'USD',
        accountName: 'Amex Platinum Card',
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.insight.createMany({
    data: [
      {
        familyId: DEMO_FAMILY_ID,
        type: 'NET_WORTH_MILESTONE',
        severity: 'POSITIVE',
        title: 'Net Worth Exceeded $860,000',
        description:
          'Driven by +$14,500 payroll inflow and +3.2% appreciation in Interactive Brokers Flagship.',
        metricAmount: '863530.2500',
      },
      {
        familyId: DEMO_FAMILY_ID,
        type: 'SUBSCRIPTION_HIKE',
        severity: 'WARNING',
        title: 'Subscription Price Hike Detected: AWS Cloud',
        description:
          'Monthly recurring bill increased from $410.00 to $485.00 (+18.3% MoM).',
        metricAmount: '-75.0000',
      },
      {
        familyId: DEMO_FAMILY_ID,
        type: 'IDLE_CASH',
        severity: 'INFO',
        title: 'Idle Cash Optimization Opportunity',
        description:
          'Moving $25,000 from checking to 5.10% Treasury MMF yields an extra $1,275.00/yr.',
        metricAmount: '1275.0000',
      },
    ],
  });

  await ensureDemoHoldings();
}
