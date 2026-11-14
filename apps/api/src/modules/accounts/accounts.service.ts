import {
  CreateAccountInput,
  UpdateAccountInput,
  UpsertHoldingSchema,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  convertCurrency,
  calculateLoanAmortization,
  compareMoney,
  isZeroMoney,
  toFixedDecimalString,
} from '@sure/shared';
import { z } from 'zod';
import { AppError } from '../../middleware/pipeline.js';
import { decimalToFixed, getExchangeRate, parseIsoDate, prisma } from '../../config/prisma.js';
import { BalanceService } from '../balances/balance.service.js';
import { AccountDto, accountsRepository } from './accounts.repository.js';

export class AccountsService {
  public async listAccounts(familyId: string) {
    const [accounts, family] = await Promise.all([
      accountsRepository.findAll(familyId),
      prisma.family.findUnique({ where: { id: familyId } }),
    ]);

    const baseCurrency = family?.baseCurrency ?? 'USD';

    let totalAssets = '0.0000';
    let totalLiabilities = '0.0000';

    const enriched = await Promise.all(
      accounts.map(async (acc) => {
        const fxRate = await getExchangeRate(acc.currency, baseCurrency);
        const balanceInBase = convertCurrency(acc.balance, fxRate);
        if (acc.classification === 'ASSET') {
          totalAssets = addMoney(totalAssets, balanceInBase);
        } else {
          totalLiabilities = addMoney(totalLiabilities, balanceInBase);
        }

        const snapshots = await BalanceService.getAccountSnapshots(familyId, acc.id);
        return {
          ...acc,
          balanceInFamilyCurrency: balanceInBase,
          sparkline: snapshots.slice(-30).map((s) => ({
            date: s.date,
            balance: s.balance,
          })),
        };
      })
    );

    const netWorth = subMoney(totalAssets, totalLiabilities);

    return {
      accounts: enriched,
      summary: {
        baseCurrency,
        totalAssets,
        totalLiabilities,
        netWorth,
      },
    };
  }

  public async getAccountById(familyId: string, accountId: string) {
    const acc = await accountsRepository.findById(familyId, accountId);
    if (!acc) {
      // Cross-tenant or missing lookup MUST return 404 Not Found per NFR-2
      throw new AppError('NOT_FOUND', 'Account not found');
    }
    const snapshots = await BalanceService.getAccountSnapshots(familyId, accountId);
    return {
      ...acc,
      balances: snapshots,
    };
  }

  public async createAccount(familyId: string, input: CreateAccountInput): Promise<AccountDto> {
    const account = await accountsRepository.create(familyId, input);

    // Create an OPENING Valuation entry if initialBalance is non-zero
    if (!isZeroMoney(input.initialBalance ?? '0.0000')) {
      const todayIso = new Date().toISOString().slice(0, 10);
      await prisma.entry.create({
        data: {
          accountId: account.id,
          familyId,
          entryType: 'VALUATION',
          date: parseIsoDate(todayIso),
          amount: toFixedDecimalString(input.initialBalance),
          currency: account.currency,
          name: 'Opening Balance',
          notes: 'Initial account valuation',
          excluded: false,
          valuation: {
            create: {
              kind: 'OPENING',
            },
          },
        },
      });
    }

    await BalanceService.materializeAccount(familyId, account.id);
    return (await accountsRepository.findById(familyId, account.id))!;
  }

  public async updateAccount(
    familyId: string,
    accountId: string,
    input: UpdateAccountInput
  ): Promise<AccountDto> {
    const updated = await accountsRepository.update(familyId, accountId, input);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }
    return updated;
  }

  public async deleteAccount(familyId: string, accountId: string): Promise<void> {
    const deleted = await accountsRepository.delete(familyId, accountId);
    if (!deleted) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }
  }

  public async simulateLoanPayoff(
    familyId: string,
    accountId: string,
    extraMonthlyPayment: string
  ) {
    const account = await accountsRepository.findById(familyId, accountId);
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }
    if (account.accountType !== 'LOAN') {
      throw new AppError('VALIDATION_ERROR', 'Account is not a LOAN account');
    }

    const details = account.subtypeDetails as {
      principal?: string;
      interestRatePercent?: string;
      termMonths?: number;
    };

    return calculateLoanAmortization({
      principal: details.principal ?? account.balance,
      annualInterestRatePercent: details.interestRatePercent ?? '5.5000',
      termMonths: Number(details.termMonths ?? 360),
      extraMonthlyPayment,
    });
  }

  public async getAccountHoldings(familyId: string, accountId: string) {
    const account = await accountsRepository.findById(familyId, accountId);
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }

    const holdings = await prisma.holding.findMany({
      where: { accountId: account.id },
      include: { security: true },
      orderBy: { marketValue: 'desc' },
    });

    let totalMarketValue = '0.0000';
    let totalCostBasis = '0.0000';

    const rows = holdings.map((h) => {
      const qty = decimalToFixed(h.qty, 8);
      const avgCostBasis = decimalToFixed(h.avgCostBasis);
      const currentPrice = decimalToFixed(h.security.currentPrice);
      const marketValue = isZeroMoney(currentPrice)
        ? decimalToFixed(h.marketValue)
        : mulMoney(qty, currentPrice);
      const costBasisTotal = mulMoney(qty, avgCostBasis);
      const unrealizedGain = subMoney(marketValue, costBasisTotal);
      const returnPercent =
        compareMoney(costBasisTotal, '0.0000') > 0
          ? divMoney(mulMoney(unrealizedGain, '100.0000'), costBasisTotal)
          : '0.0000';

      totalMarketValue = addMoney(totalMarketValue, marketValue);
      totalCostBasis = addMoney(totalCostBasis, costBasisTotal);

      return {
        id: h.id,
        accountId: h.accountId,
        ticker: h.security.ticker,
        securityName: h.security.name,
        assetClass: h.security.assetClass,
        currency: h.security.currency,
        qty,
        avgCostBasis,
        currentPrice,
        marketValue,
        costBasisTotal,
        unrealizedGain,
        returnPercent,
      };
    });

    const totalGain = subMoney(totalMarketValue, totalCostBasis);
    const totalReturnPercent =
      compareMoney(totalCostBasis, '0.0000') > 0
        ? divMoney(mulMoney(totalGain, '100.0000'), totalCostBasis)
        : '0.0000';

    return {
      accountId: account.id,
      totalMarketValue,
      totalCostBasis,
      totalGain,
      totalReturnPercent,
      holdings: rows.map((r) => ({
        ...r,
        portfolioWeightPercent:
          compareMoney(totalMarketValue, '0.0000') > 0
            ? divMoney(mulMoney(r.marketValue, '100.0000'), totalMarketValue)
            : '0.0000',
      })),
    };
  }

  public async upsertAccountHolding(
    familyId: string,
    accountId: string,
    input: z.infer<typeof UpsertHoldingSchema>
  ) {
    const account = await accountsRepository.findById(familyId, accountId);
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }

    const ticker = input.ticker.trim().toUpperCase();
    const qty = toFixedDecimalString(input.qty, 8);
    const avgCostBasis = toFixedDecimalString(input.avgCostBasis);
    const currentPrice = toFixedDecimalString(input.currentPrice);
    const marketValue = mulMoney(qty, currentPrice);

    const security = await prisma.security.upsert({
      where: { ticker },
      update: { name: input.securityName, assetClass: input.assetClass, currentPrice },
      create: {
        ticker,
        name: input.securityName,
        currency: account.currency,
        assetClass: input.assetClass,
        currentPrice,
      },
    });

    await prisma.holding.upsert({
      where: {
        accountId_securityId: { accountId: account.id, securityId: security.id },
      },
      update: { qty, avgCostBasis, marketValue },
      create: {
        accountId: account.id,
        securityId: security.id,
        qty,
        avgCostBasis,
        marketValue,
      },
    });

    return this.getAccountHoldings(familyId, account.id);
  }
}

export const accountsService = new AccountsService();
