import { afterAll, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import {
  cleanupTestFamilies,
  createTestFamily,
  createTestAccount,
  createTestTransaction,
} from '../../test/factories/index.js';
import { syncService } from '../sync/sync.service.js';

const app = createApp();

describe('PostgreSQL API Integration Tests — Auth, Tenant Isolation, Ledger Integrity & AI Consent', () => {
  afterEach(async () => {
    await cleanupTestFamilies();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Registers, logs in with HTTP-only session cookie, and authenticates via scoped API Key', async () => {
    const email = `test-${randomUUID().slice(0, 8)}@sure.test`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'SuperSecurePassword1!',
        name: 'Integration Tester',
        familyName: 'Tester Household',
        baseCurrency: 'USD',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.family.name).toBe('Tester Household');
    const token = regRes.body.data.token as string;
    const familyId = regRes.body.data.family.id as string;

    const cookies = regRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Create scoped API key
    const keyRes = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vitest MCP Key',
        scopes: ['accounts:read', 'mcp:tools'],
      });
    expect(keyRes.status).toBe(201);
    const rawSecret = keyRes.body.data.secret as string;
    expect(rawSecret.startsWith('sure_live_')).toBe(true);

    // Call protected endpoint using the scoped API key
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rawSecret}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.family.id).toBe(familyId);

    // Cleanup registered family
    await prisma.family.delete({ where: { id: familyId } });
    await prisma.user.delete({ where: { email } });
  });

  it('2. Enforces Cross-Tenant Isolation: Family 1 receives 404 Not Found when accessing Family 2 resources', async () => {
    const family1 = await createTestFamily({ name: 'Family One' });
    const family2 = await createTestFamily({ name: 'Family Two' });

    const family2Account = await createTestAccount(family2.familyId, {
      name: 'Secret Offshore Account',
      initialBalance: '500000.0000',
    });
    const family2Tx = await createTestTransaction(
      family2.familyId,
      family2Account.id,
      { amount: '-1200.0000', name: 'Private Transfer' }
    );

    const getAccRes = await request(app)
      .get(`/api/v1/accounts/${family2Account.id}`)
      .set('Authorization', `Bearer ${family1.authToken}`);
    expect(getAccRes.status).toBe(404);
    expect(getAccRes.body.error.code).toBe('NOT_FOUND');

    const patchTxRes = await request(app)
      .patch(`/api/v1/entries/${family2Tx.id}`)
      .set('Authorization', `Bearer ${family1.authToken}`)
      .send({ name: 'Tampered Name' });
    expect(patchTxRes.status).toBe(404);

    const delAccRes = await request(app)
      .delete(`/api/v1/accounts/${family2Account.id}`)
      .set('Authorization', `Bearer ${family1.authToken}`);
    expect(delAccRes.status).toBe(404);
  });

  it('3. Ledger Side Effects: Creating, splitting, and deleting an Entry recalculates Account.balance in PostgreSQL', async () => {
    const family = await createTestFamily();
    const account = await createTestAccount(family.familyId, {
      initialBalance: '2000.0000',
    });
    expect(account.balance).toBe('2000.0000');

    const createRes = await request(app)
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        entryType: 'TRANSACTION',
        accountId: account.id,
        date: new Date().toISOString().slice(0, 10),
        amount: '-250.5000',
        currency: 'USD',
        name: 'Target Superstore',
      });
    expect(createRes.status).toBe(201);
    const entryId = createRes.body.data.id;

    const accAfterCreate = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(accAfterCreate.body.data.balance).toBe('1749.5000');

    const splitRes = await request(app)
      .post(`/api/v1/entries/${entryId}/split`)
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        splits: [
          { name: 'Groceries portion', amount: '-150.5000' },
          { name: 'Household goods', amount: '-100.0000' },
        ],
      });
    expect(splitRes.status).toBe(200);
    expect(splitRes.body.data.splits).toHaveLength(2);

    const accAfterSplit = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(accAfterSplit.body.data.balance).toBe('1749.5000');

    const delRes = await request(app)
      .delete(`/api/v1/entries/${entryId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(delRes.status).toBe(204);

    const accAfterDelete = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(accAfterDelete.body.data.balance).toBe('2000.0000');
  });

  it('4. Idempotency: Re-running a provider sync job with identical externalId does not duplicate entries', async () => {
    const family = await createTestFamily();
    const account = await createTestAccount(family.familyId, {
      initialBalance: '1000.0000',
    });

    const payload = [
      {
        externalId: 'plaid_tx_998877',
        date: new Date().toISOString().slice(0, 10),
        name: 'Stripe Payout',
        amount: '500.0000',
        currency: 'USD',
      },
    ];

    const firstRun = await syncService.ingestExternalTransactions(
      family.familyId,
      account.id,
      payload
    );
    expect(firstRun.insertedCount).toBe(1);
    expect(firstRun.skippedIdempotentCount).toBe(0);

    const secondRun = await syncService.ingestExternalTransactions(
      family.familyId,
      account.id,
      payload
    );
    expect(secondRun.insertedCount).toBe(0);
    expect(secondRun.skippedIdempotentCount).toBe(1);

    const accRes = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(accRes.body.data.balance).toBe('1500.0000');
  });

  it('5. Enforces Explicit AI Consent Gate (Invariant #5): Blocks AI chat when family.aiEnabled === false', async () => {
    const familyNoAi = await createTestFamily({ aiEnabled: false });

    const blockedRes = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${familyNoAi.authToken}`)
      .send({ prompt: 'What is my net worth?' });
    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error.code).toBe('FORBIDDEN');

    await request(app)
      .patch('/api/v1/family')
      .set('Authorization', `Bearer ${familyNoAi.authToken}`)
      .send({ aiEnabled: true });

    const allowedRes = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${familyNoAi.authToken}`)
      .send({ prompt: 'What is my net worth?' });
    expect(allowedRes.status).toBe(201);
    expect(allowedRes.body.data.messages).toHaveLength(2);
  });

  it('6. Auto-materializes Holding positions on TRADE entries and exposes portfolio weights', async () => {
    const family = await createTestFamily();
    const brokerage = await createTestAccount(family.familyId, {
      name: 'Fidelity Brokerage',
      initialBalance: '10000.0000',
    });

    const today = new Date().toISOString().slice(0, 10);
    const buyRes = await request(app)
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        entryType: 'TRADE',
        accountId: brokerage.id,
        date: today,
        amount: '-2500.0000',
        currency: 'USD',
        name: 'Buy 10 VOO',
        securityTicker: 'VOO',
        securityName: 'Vanguard S&P 500 ETF',
        tradeAction: 'BUY',
        qty: '10.0000',
        price: '250.0000',
        fees: '0.0000',
      });
    expect(buyRes.status).toBe(201);

    const holdingsRes = await request(app)
      .get(`/api/v1/accounts/${brokerage.id}/holdings`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(holdingsRes.status).toBe(200);
    expect(holdingsRes.body.data.holdings).toHaveLength(1);
    expect(holdingsRes.body.data.holdings[0].ticker).toBe('VOO');
    expect(Number(holdingsRes.body.data.holdings[0].qty)).toBe(10);
    expect(holdingsRes.body.data.holdings[0].marketValue).toBe('2500.0000');
  });

  it('7. Enforces mcp:tools API key scope and executes JSON-RPC 2.0 MCP tools scoped to familyId', async () => {
    const family = await createTestFamily();
    await createTestAccount(family.familyId, {
      name: 'MCP Checking',
      initialBalance: '4200.0000',
    });

    const restrictedKeyRes = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({ name: 'ReadOnly Key', scopes: ['accounts:read'] });
    expect(restrictedKeyRes.status).toBe(201);

    const deniedRes = await request(app)
      .post('/api/v1/mcp')
      .set('Authorization', `Bearer ${restrictedKeyRes.body.data.secret}`)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(deniedRes.status).toBe(403);

    const mcpKeyRes = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({ name: 'Claude MCP Key', scopes: ['accounts:read', 'mcp:tools'] });
    expect(mcpKeyRes.status).toBe(201);

    const listRes = await request(app)
      .post('/api/v1/mcp')
      .set('Authorization', `Bearer ${mcpKeyRes.body.data.secret}`)
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(listRes.status).toBe(200);
    expect(listRes.body.result.tools.length).toBeGreaterThanOrEqual(10);

    const callRes = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${mcpKeyRes.body.data.secret}`)
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_accounts', arguments: {} },
      });
    expect(callRes.status).toBe(200);
    const parsed = JSON.parse(callRes.body.result.content[0].text) as {
      accounts: Array<{ name: string }>;
    };
    expect(parsed.accounts.some((a) => a.name === 'MCP Checking')).toBe(true);
  });

  it('8. Marks a recurring bill paid, records ledger transaction, and recalculates account balance', async () => {
    const family = await createTestFamily();
    const checking = await createTestAccount(family.familyId, {
      name: 'Bill Checking',
      initialBalance: '3000.0000',
    });

    const createBill = await request(app)
      .post('/api/v1/recurring')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        name: 'Electric Utility',
        amount: '-150.0000',
        currency: 'USD',
        cadence: 'MONTHLY',
        nextOccurrenceDate: '2026-11-15',
        accountId: checking.id,
        autoPay: false,
      });
    expect(createBill.status).toBe(201);
    const billId = createBill.body.data.id as string;

    const paidRes = await request(app)
      .post(`/api/v1/recurring/${billId}/mark-paid`)
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({ paidDate: '2026-11-14' });
    expect(paidRes.status).toBe(201);
    expect(paidRes.body.data.recurring.nextOccurrenceDate.slice(0, 10)).toBe('2026-12-15');

    const accAfter = await request(app)
      .get(`/api/v1/accounts/${checking.id}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(accAfter.body.data.balance).toBe('2850.0000');
  });

  it('9. Exports tenant-scoped Full Family JSON Backup via GET /api/v1/family/backup', async () => {
    const familyA = await createTestFamily({ name: 'Backup Alpha' });
    const familyB = await createTestFamily({ name: 'Backup Beta' });
    await createTestAccount(familyA.familyId, { name: 'Alpha Vault', initialBalance: '900.0000' });
    await createTestAccount(familyB.familyId, { name: 'Beta Vault', initialBalance: '999.0000' });

    const backupRes = await request(app)
      .get('/api/v1/family/backup')
      .set('Authorization', `Bearer ${familyA.authToken}`);
    expect(backupRes.status).toBe(200);
    expect(backupRes.body.data.family.name).toBe('Backup Alpha');
    expect(backupRes.body.data.accounts.some((a: { name: string }) => a.name === 'Alpha Vault')).toBe(
      true
    );
    expect(backupRes.body.data.accounts.some((a: { name: string }) => a.name === 'Beta Vault')).toBe(
      false
    );
  });

  it('10. Creates ASSET->LIABILITY transfer reducing debt & preserving net worth, and releases surviving leg on delete', async () => {
    const family = await createTestFamily({ name: 'Transfer Parity Household' });
    const checking = await createTestAccount(family.familyId, {
      name: 'Primary Checking',
      initialBalance: '1000.0000',
    });

    const ccRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        accountType: 'CREDIT_CARD',
        name: 'Visa Rewards',
        currency: 'USD',
        initialBalance: '500.0000',
        subtypeDetails: {
          creditLimit: '5000.0000',
          aprPercent: '19.9900',
          dueDay: 15,
        },
      });
    expect(ccRes.status).toBe(201);
    const creditCardId = ccRes.body.data.id as string;

    const transferRes = await request(app)
      .post('/api/v1/entries/transfers')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        fromAccountId: checking.id,
        toAccountId: creditCardId,
        date: new Date().toISOString().slice(0, 10),
        amount: '200.0000',
        name: 'Credit Card Payment',
      });
    expect(transferRes.status).toBe(201);
    const outflowId = transferRes.body.data.outflowId as string;
    const inflowId = transferRes.body.data.inflowId as string;

    const outflowCheck = await request(app)
      .get(`/api/v1/entries/${outflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    const inflowCheck = await request(app)
      .get(`/api/v1/entries/${inflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(outflowCheck.status).toBe(200);
    expect(inflowCheck.status).toBe(200);
    expect(outflowCheck.body.data.excluded).toBe(true);
    expect(inflowCheck.body.data.excluded).toBe(true);

    // Asset down 200 (1000 -> 800), Liability debt down 200 (500 -> 300), Net worth preserved (500)
    const reportRes = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.balanceSheet.totalAssets).toBe('800.0000');
    expect(reportRes.body.data.balanceSheet.totalLiabilities).toBe('300.0000');
    expect(reportRes.body.data.balanceSheet.netWorth).toBe('500.0000');

    // Deleting one paired leg must un-exclude the surviving leg (Transfer#release_transactions parity)
    const delRes = await request(app)
      .delete(`/api/v1/entries/${outflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(delRes.status).toBe(204);

    const survivorRes = await request(app)
      .get(`/api/v1/entries/${inflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(survivorRes.status).toBe(200);
    expect(survivorRes.body.data.excluded).toBe(false);
    expect(survivorRes.body.data.transferMatchId).toBeNull();
  });

  it('11. Attributes split transaction leaves accurately in Reports & multi-month Budget Rollover chains', async () => {
    const family = await createTestFamily({ name: 'Split & Budget Household' });
    const checking = await createTestAccount(family.familyId, {
      name: 'Budget Checking',
      initialBalance: '2000.0000',
    });

    const catGroceries = await request(app)
      .post('/api/v1/taxonomies/categories')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({ name: 'Groceries', classification: 'EXPENSE' });
    expect(catGroceries.status).toBe(201);
    const groceriesId = catGroceries.body.data.id as string;

    const catPharmacy = await request(app)
      .post('/api/v1/taxonomies/categories')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({ name: 'Pharmacy', classification: 'EXPENSE' });
    expect(catPharmacy.status).toBe(201);
    const pharmacyId = catPharmacy.body.data.id as string;

    // Prior month spending in Oct 2026 (-20.0000 in Groceries)
    const octTx = await request(app)
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        entryType: 'TRANSACTION',
        accountId: checking.id,
        date: '2026-10-15',
        amount: '-20.0000',
        currency: 'USD',
        name: 'Corner Market',
        categoryId: groceriesId,
      });
    expect(octTx.status).toBe(201);

    // Nov 2026 parent transaction (-100.0000) split into Groceries (-65) and Pharmacy (-35)
    const novParent = await request(app)
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        entryType: 'TRANSACTION',
        accountId: checking.id,
        date: '2026-11-10',
        amount: '-100.0000',
        currency: 'USD',
        name: 'Superstore Trip',
      });
    expect(novParent.status).toBe(201);

    const splitRes = await request(app)
      .post(`/api/v1/entries/${novParent.body.data.id}/split`)
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        splits: [
          { name: 'Food Items', amount: '-65.0000', categoryId: groceriesId },
          { name: 'Prescriptions', amount: '-35.0000', categoryId: pharmacyId },
        ],
      });
    expect(splitRes.status).toBe(200);

    // Reports must count leaf children only (totalExpenses = 120.0000: 20 + 65 + 35, never double-counting parent 100)
    const reportRes = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.incomeStatement.totalExpenses).toBe('120.0000');
    const breakdown = reportRes.body.data.incomeStatement.expenseBreakdown as Array<{
      name: string;
      amount: string;
    }>;
    expect(breakdown.find((b) => b.name === 'Groceries')?.amount).toBe('85.0000');
    expect(breakdown.find((b) => b.name === 'Pharmacy')?.amount).toBe('35.0000');

    // Multi-month Budget chain for Groceries:
    // 2026-09: 100 budgeted, 0 spent -> +100 carry
    // 2026-10: 100 budgeted, +100 carry, 20 spent -> +180 carry
    // 2026-11: 100 budgeted, +180 carry, 65 spent (from split child!) -> 280 effective, 215 remaining
    for (const month of ['2026-09', '2026-10', '2026-11']) {
      const putRes = await request(app)
        .put('/api/v1/budgets')
        .set('Authorization', `Bearer ${family.authToken}`)
        .send({
          month,
          rolloverEnabled: true,
          expectedIncome: '0.0000',
          allocations: [{ categoryId: groceriesId, budgetedAmount: '100.0000', rolloverEnabled: true }],
        });
      expect(putRes.status).toBe(200);
    }

    const novBudgetRes = await request(app)
      .get('/api/v1/budgets/2026-11')
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(novBudgetRes.status).toBe(200);
    const groceriesRow = (
      novBudgetRes.body.data.categories as Array<{
        category: { id: string };
        previousRolloverBalance: string;
        actualSpent: string;
        effectiveAvailable: string;
        remainingBalance: string;
      }>
    ).find((r) => r.category.id === groceriesId);

    expect(groceriesRow).toBeDefined();
    expect(groceriesRow?.previousRolloverBalance).toBe('180.0000');
    expect(groceriesRow?.actualSpent).toBe('65.0000');
    expect(groceriesRow?.effectiveAvailable).toBe('280.0000');
    expect(groceriesRow?.remainingBalance).toBe('215.0000');
  });

  it('12. Enforces LOAN transfer expense attribution, account-backed Goals, Spending vs Normal & /version', async () => {
    const versionRes = await request(app).get('/api/v1/version');
    expect(versionRes.status).toBe(200);
    expect(versionRes.body.data.version).toBe('1.0.0');

    const family = await createTestFamily({ name: 'Goals & Loan Household' });
    const checking = await createTestAccount(family.familyId, {
      name: 'Funding Checking',
      initialBalance: '5000.0000',
    });

    const loanRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        accountType: 'LOAN',
        name: 'Auto Note',
        currency: 'USD',
        initialBalance: '10000.0000',
        subtypeDetails: {
          loanSubtype: 'AUTO',
          principal: '10000.0000',
          interestRatePercent: '4.5000',
          termMonths: 48,
          rateType: 'FIXED',
        },
      });
    expect(loanRes.status).toBe(201);
    const loanId = loanRes.body.data.id as string;

    const todayIso = new Date().toISOString().slice(0, 10);
    const loanPaymentRes = await request(app)
      .post('/api/v1/entries/transfers')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        fromAccountId: checking.id,
        toAccountId: loanId,
        date: todayIso,
        amount: '500.0000',
        name: 'Auto Loan Payment',
      });
    expect(loanPaymentRes.status).toBe(201);

    const outflowRes = await request(app)
      .get(`/api/v1/entries/${loanPaymentRes.body.data.outflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    const inflowRes = await request(app)
      .get(`/api/v1/entries/${loanPaymentRes.body.data.inflowId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    // Loan payment outflow counts as an expense (excluded: false), while inflow remains excluded: true
    expect(outflowRes.body.data.excluded).toBe(false);
    expect(inflowRes.body.data.excluded).toBe(true);

    const reportRes = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.incomeStatement.totalExpenses).toBe('500.0000');
    expect(reportRes.body.data.spendingVsNormal.categories.length).toBeGreaterThanOrEqual(1);
    expect(reportRes.body.data.spendingVsNormal.categories[0].currentSpent).toBe('500.0000');

    // Create Goal linked to Funding Checking (live balance = 4500.0000)
    const createGoalRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${family.authToken}`)
      .send({
        name: 'House Reserve',
        targetAmount: '10000.0000',
        currentAmount: '0.0000',
        monthlyPledge: '1000.0000',
        targetDate: '2028-01-01',
        linkedAccountIds: [checking.id],
      });
    expect(createGoalRes.status).toBe(201);
    const goalId = createGoalRes.body.data.id as string;

    const goalsRes = await request(app)
      .get('/api/v1/goals')
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(goalsRes.status).toBe(200);
    const houseGoal = (
      goalsRes.body.data as Array<{
        id: string;
        currentAmount: string;
        remainingAmount: string;
        status: string;
        linkedAccounts: Array<{ id: string }>;
      }>
    ).find((g) => g.id === goalId);
    expect(houseGoal?.currentAmount).toBe('4500.0000');
    expect(houseGoal?.remainingAmount).toBe('5500.0000');
    expect(houseGoal?.linkedAccounts.some((a) => a.id === checking.id)).toBe(true);

    const delGoalRes = await request(app)
      .delete(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${family.authToken}`);
    expect(delGoalRes.status).toBe(204);
  });
});
