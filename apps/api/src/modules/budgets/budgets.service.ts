import {
  UpsertBudgetMonthInput,
  CreateGoalInput,
  CreateRecurringInput,
  addMoney,
  subMoney,
  divMoney,
  mulMoney,
  absMoney,
  compareMoney,
  convertCurrency,
  calculateBudgetRollover,
  toFixedDecimalString,
} from '@sure/shared';
import {
  decimalToFixed,
  getExchangeRate,
  parseIsoDate,
  prisma,
  toIsoDate,
} from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { BalanceService } from '../balances/balance.service.js';

/**
 * FR-4: Monthly Budgeting with Rollover, Financial Goals, and Recurring Bills
 */
export class BudgetsAndGoalsService {
  public async getBudgetForMonth(familyId: string, month: string) {
    const [allBudgets, expenseCategories, familyEntries] = await Promise.all([
      prisma.budget.findMany({
        where: { familyId, month: { lte: month } },
        include: { categories: true },
        orderBy: { month: 'asc' },
      }),
      prisma.category.findMany({
        where: { familyId, classification: 'EXPENSE' },
        orderBy: { name: 'asc' },
      }),
      prisma.entry.findMany({
        where: {
          familyId,
          entryType: 'TRANSACTION',
          excluded: false,
        },
        include: {
          transaction: true,
          outflowMatch: { select: { id: true } },
          inflowMatch: { select: { id: true } },
          childSplits: { select: { id: true } },
          parentEntry: {
            select: {
              excluded: true,
              outflowMatch: { select: { id: true } },
              inflowMatch: { select: { id: true } },
            },
          },
        },
      }),
    ]);

    const currentBudget = allBudgets.find((b) => b.month === month) ?? null;
    const priorBudgets = allBudgets.filter((b) => b.month < month);

    // Leaf non-transfer-inflow expense entries (includes split children, excludes split parents and excluded transfers)
    const leafExpenseEntries = familyEntries.filter(
      (e) =>
        e.childSplits.length === 0 &&
        !e.inflowMatch &&
        !(e.parentEntry && (e.parentEntry.excluded || e.parentEntry.inflowMatch))
    );

    const categoryRows = expenseCategories.map((cat) => {
      // Walk chronological budget chain matching Sure's Budget::RolloverCalculator:
      // disabled months reset carry to 0 so unused surplus doesn't resurface later.
      let carry = '0.0000';
      for (const prior of priorBudgets) {
        const priorAlloc = prior.categories.find((a) => a.categoryId === cat.id);
        const priorRolloverOn = priorAlloc?.rolloverEnabled ?? prior.rolloverEnabled;
        if (!priorRolloverOn) {
          carry = '0.0000';
          continue;
        }
        const priorBudgeted = priorAlloc ? decimalToFixed(priorAlloc.budgetedAmount) : '0.0000';
        const priorSpentEntries = leafExpenseEntries.filter(
          (e) =>
            e.transaction?.categoryId === cat.id &&
            toIsoDate(e.date).startsWith(prior.month) &&
            compareMoney(decimalToFixed(e.amount), '0.0000') < 0
        );
        let priorSpent = '0.0000';
        for (const e of priorSpentEntries) {
          priorSpent = addMoney(priorSpent, absMoney(decimalToFixed(e.amount)));
        }
        carry = subMoney(addMoney(priorBudgeted, carry), priorSpent);
      }

      const alloc = currentBudget?.categories.find((a) => a.categoryId === cat.id);
      const budgetedAmount = alloc ? decimalToFixed(alloc.budgetedAmount) : '500.0000';
      const rolloverEnabled = alloc?.rolloverEnabled ?? currentBudget?.rolloverEnabled ?? true;
      const prevRolloverBalance = rolloverEnabled ? carry : '0.0000';

      const currSpentEntries = leafExpenseEntries.filter(
        (e) =>
          e.transaction?.categoryId === cat.id &&
          toIsoDate(e.date).startsWith(month) &&
          compareMoney(decimalToFixed(e.amount), '0.0000') < 0
      );
      let actualSpent = '0.0000';
      for (const e of currSpentEntries) {
        actualSpent = addMoney(actualSpent, absMoney(decimalToFixed(e.amount)));
      }

      const rolloverMetrics = calculateBudgetRollover({
        budgetedAmount,
        actualSpentAmount: actualSpent,
        previousRolloverBalance: prevRolloverBalance,
        rolloverEnabled,
      });

      return {
        category: cat,
        budgetedAmount,
        actualSpent,
        previousRolloverBalance: prevRolloverBalance,
        rolloverEnabled,
        ...rolloverMetrics,
      };
    });

    let totalBudgeted = '0.0000';
    let totalSpent = '0.0000';
    for (const r of categoryRows) {
      totalBudgeted = addMoney(totalBudgeted, r.budgetedAmount);
      totalSpent = addMoney(totalSpent, r.actualSpent);
    }

    return {
      month,
      expectedIncome: currentBudget ? decimalToFixed(currentBudget.expectedIncome) : '12500.0000',
      rolloverEnabled: currentBudget?.rolloverEnabled ?? true,
      totalBudgeted,
      totalSpent,
      totalRemaining: subMoney(totalBudgeted, totalSpent),
      categories: categoryRows,
    };
  }

  public async upsertBudgetMonth(familyId: string, input: UpsertBudgetMonthInput) {
    const budget = await prisma.$transaction(async (tx) => {
      const upserted = await tx.budget.upsert({
        where: { familyId_month: { familyId, month: input.month } },
        update: {
          expectedIncome: toFixedDecimalString(input.expectedIncome),
          rolloverEnabled: input.rolloverEnabled,
        },
        create: {
          familyId,
          month: input.month,
          expectedIncome: toFixedDecimalString(input.expectedIncome),
          rolloverEnabled: input.rolloverEnabled,
        },
      });

      await tx.budgetCategory.deleteMany({ where: { budgetId: upserted.id } });
      if (input.allocations.length > 0) {
        await tx.budgetCategory.createMany({
          data: input.allocations.map((a) => ({
            budgetId: upserted.id,
            categoryId: a.categoryId,
            budgetedAmount: toFixedDecimalString(a.budgetedAmount),
            rolloverEnabled: a.rolloverEnabled,
          })),
        });
      }

      return tx.budget.findUnique({
        where: { id: upserted.id },
        include: { categories: true },
      });
    });

    return budget;
  }

  public async listGoals(familyId: string) {
    const [family, goals] = await Promise.all([
      prisma.family.findUnique({ where: { id: familyId }, select: { baseCurrency: true } }),
      prisma.goal.findMany({
        where: { familyId },
        include: {
          accounts: {
            include: {
              account: {
                select: {
                  id: true,
                  name: true,
                  balance: true,
                  currency: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const baseCurrency = family?.baseCurrency ?? 'USD';

    return Promise.all(
      goals.map(async (goal) => {
        const targetAmount = decimalToFixed(goal.targetAmount);
        let currentAmount = decimalToFixed(goal.currentAmount);

        if (goal.accounts.length > 0) {
          let linkedTotal = '0.0000';
          for (const link of goal.accounts) {
            const rate = await getExchangeRate(link.account.currency, baseCurrency);
            linkedTotal = addMoney(
              linkedTotal,
              convertCurrency(decimalToFixed(link.account.balance), rate)
            );
          }
          currentAmount = linkedTotal;
        }

        const monthlyPledge = decimalToFixed(goal.monthlyPledge);
        const progressPct =
          compareMoney(targetAmount, '0.0000') > 0
            ? Number(divMoney(mulMoney(currentAmount, '100.0000'), targetAmount))
            : 0;
        const remainingRaw = subMoney(targetAmount, currentAmount);
        const remaining = compareMoney(remainingRaw, '0.0000') > 0 ? remainingRaw : '0.0000';

        const daysRemaining = Math.max(
          0,
          Math.ceil((goal.targetDate.getTime() - Date.now()) / 86_400_000)
        );
        const monthsRemaining = daysRemaining / 30;
        const requiredMonthly =
          monthsRemaining > 0 && compareMoney(remaining, '0.0000') > 0
            ? divMoney(remaining, monthsRemaining.toFixed(4))
            : '0.0000';

        const monthsToGoal =
          compareMoney(monthlyPledge, '0.0000') > 0 && compareMoney(remaining, '0.0000') > 0
            ? Math.ceil(Number(divMoney(remaining, monthlyPledge)))
            : 0;

        let status: 'REACHED' | 'ON_TRACK' | 'BEHIND' = 'BEHIND';
        if (progressPct >= 100 || compareMoney(remaining, '0.0000') === 0) {
          status = 'REACHED';
        } else if (
          monthsRemaining > 0 &&
          compareMoney(monthlyPledge, requiredMonthly) >= 0
        ) {
          status = 'ON_TRACK';
        }

        return {
          id: goal.id,
          familyId: goal.familyId,
          name: goal.name,
          targetAmount,
          currentAmount,
          monthlyPledge,
          targetDate: toIsoDate(goal.targetDate),
          color: goal.color,
          icon: goal.icon,
          status,
          requiredMonthlyAmount: requiredMonthly,
          linkedAccountIds: goal.accounts.map((a) => a.accountId),
          linkedAccounts: goal.accounts.map((a) => ({
            id: a.account.id,
            name: a.account.name,
            balance: decimalToFixed(a.account.balance),
            currency: a.account.currency,
            color: a.account.color,
          })),
          createdAt: goal.createdAt.toISOString(),
          progressPercentage: Math.min(100, Math.max(0, progressPct)),
          remainingAmount: remaining,
          estimatedMonthsToTarget: monthsToGoal,
        };
      })
    );
  }

  public async deleteGoal(familyId: string, goalId: string) {
    const existing = await prisma.goal.findFirst({ where: { id: goalId, familyId } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Goal not found');
    }
    await prisma.goal.delete({ where: { id: goalId } });
  }

  public async createGoal(familyId: string, input: CreateGoalInput) {
    const created = await prisma.goal.create({
      data: {
        familyId,
        name: input.name,
        targetAmount: toFixedDecimalString(input.targetAmount),
        currentAmount: toFixedDecimalString(input.currentAmount),
        monthlyPledge: toFixedDecimalString(input.monthlyPledge),
        targetDate: parseIsoDate(input.targetDate),
        color: input.color,
        icon: input.icon,
        ...(input.linkedAccountIds.length > 0
          ? {
              accounts: {
                create: input.linkedAccountIds.map((accountId) => ({ accountId })),
              },
            }
          : {}),
      },
      include: { accounts: true },
    });

    return {
      ...created,
      targetAmount: decimalToFixed(created.targetAmount),
      currentAmount: decimalToFixed(created.currentAmount),
      monthlyPledge: decimalToFixed(created.monthlyPledge),
      targetDate: toIsoDate(created.targetDate),
      linkedAccountIds: created.accounts.map((a) => a.accountId),
      createdAt: created.createdAt.toISOString(),
    };
  }

  public async listRecurring(familyId: string) {
    const items = await prisma.recurringTransaction.findMany({
      where: { familyId },
      orderBy: { nextOccurrenceDate: 'asc' },
    });

    return items.map((rec) => {
      const amount = decimalToFixed(rec.amount);
      const lastAmount = rec.lastAmount ? decimalToFixed(rec.lastAmount) : null;
      const priceHikeDetected =
        lastAmount !== null && compareMoney(absMoney(amount), absMoney(lastAmount)) > 0;
      return {
        id: rec.id,
        familyId: rec.familyId,
        accountId: rec.accountId,
        categoryId: rec.categoryId,
        merchantId: rec.merchantId,
        name: rec.name,
        amount,
        lastAmount,
        currency: rec.currency,
        cadence: rec.cadence,
        nextOccurrenceDate: toIsoDate(rec.nextOccurrenceDate),
        autoPay: rec.autoPay,
        priceHikeDetected,
      };
    });
  }

  public async createRecurring(familyId: string, input: CreateRecurringInput) {
    const created = await prisma.recurringTransaction.create({
      data: {
        familyId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        merchantId: input.merchantId ?? null,
        name: input.name,
        amount: toFixedDecimalString(input.amount),
        currency: input.currency.toUpperCase(),
        cadence: input.cadence,
        nextOccurrenceDate: parseIsoDate(input.nextOccurrenceDate),
        autoPay: input.autoPay,
      },
    });

    return {
      ...created,
      amount: decimalToFixed(created.amount),
      lastAmount: created.lastAmount ? decimalToFixed(created.lastAmount) : null,
      nextOccurrenceDate: toIsoDate(created.nextOccurrenceDate),
    };
  }

  public async markRecurringPaid(familyId: string, recurringId: string, paidDate?: string) {
    const rec = await prisma.recurringTransaction.findFirst({
      where: { id: recurringId, familyId },
    });
    if (!rec) {
      throw new AppError('NOT_FOUND', 'Recurring bill not found');
    }

    const paymentDateIso = paidDate ?? toIsoDate(rec.nextOccurrenceDate);
    const nextDate = new Date(Date.parse(`${toIsoDate(rec.nextOccurrenceDate)}T00:00:00Z`));
    switch (rec.cadence) {
      case 'WEEKLY':
        nextDate.setUTCDate(nextDate.getUTCDate() + 7);
        break;
      case 'BIWEEKLY':
        nextDate.setUTCDate(nextDate.getUTCDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 3);
        break;
      case 'YEARLY':
        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);
        break;
    }

    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.create({
        data: {
          accountId: rec.accountId,
          familyId,
          entryType: 'TRANSACTION',
          date: parseIsoDate(paymentDateIso),
          amount: decimalToFixed(rec.amount),
          currency: rec.currency,
          name: rec.name,
          notes: `Bill payment recorded (${rec.cadence})`,
          excluded: false,
          transaction: {
            create: {
              categoryId: rec.categoryId,
              merchantId: rec.merchantId,
            },
          },
        },
      });

      await tx.recurringOccurrence.create({
        data: {
          recurringTransactionId: rec.id,
          expectedDate: rec.nextOccurrenceDate,
          amount: rec.amount,
          matchedEntryId: entry.id,
          status: 'PAID',
        },
      });

      const updatedRec = await tx.recurringTransaction.update({
        where: { id: rec.id },
        data: {
          lastAmount: rec.amount,
          nextOccurrenceDate: nextDate,
        },
      });

      return { entryId: entry.id, recurring: updatedRec };
    });

    await BalanceService.materializeAccount(familyId, rec.accountId);

    return {
      entryId: result.entryId,
      recurring: {
        ...result.recurring,
        amount: decimalToFixed(result.recurring.amount),
        lastAmount: result.recurring.lastAmount
          ? decimalToFixed(result.recurring.lastAmount)
          : null,
        nextOccurrenceDate: toIsoDate(result.recurring.nextOccurrenceDate),
      },
    };
  }

  public async deleteRecurring(familyId: string, recurringId: string): Promise<void> {
    const res = await prisma.recurringTransaction.deleteMany({
      where: { id: recurringId, familyId },
    });
    if (res.count === 0) {
      throw new AppError('NOT_FOUND', 'Recurring bill not found');
    }
  }
}

export const budgetsAndGoalsService = new BudgetsAndGoalsService();
