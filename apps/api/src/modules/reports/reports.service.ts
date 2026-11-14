import {
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  absMoney,
  compareMoney,
  convertCurrency,
} from '@sure/shared';
import { decimalToFixed, getExchangeRate, prisma, toIsoDate } from '../../config/prisma.js';

/**
 * FR-5: Financial Reports & Data Visualization
 * - Balance Sheet (Asset vs. Liability breakdown & net worth velocity)
 * - Income Statement & Cash Flow Sankey Diagram (nodes & links)
 */
export class ReportsService {
  public async getFinancialReport(familyId: string) {
    const [family, accounts, entries, snapshots] = await Promise.all([
      prisma.family.findUnique({ where: { id: familyId } }),
      prisma.account.findMany({ where: { familyId } }),
      prisma.entry.findMany({
        where: {
          familyId,
          entryType: 'TRANSACTION',
          excluded: false,
        },
        include: {
          transaction: { include: { category: true } },
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
      prisma.accountBalance.findMany({
        where: { account: { familyId } },
        include: { account: { select: { classification: true, currency: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const baseCurrency = family?.baseCurrency ?? 'USD';

    let totalAssets = '0.0000';
    let totalLiabilities = '0.0000';
    let cashAndDepository = '0.0000';
    let investmentsAndCrypto = '0.0000';
    let realEstateAndVehicles = '0.0000';
    let otherAssets = '0.0000';

    const assetGroups: Array<{
      id: string;
      name: string;
      accountType: string;
      balanceInBase: string;
    }> = [];
    const liabilityGroups: Array<{
      id: string;
      name: string;
      accountType: string;
      balanceInBase: string;
    }> = [];

    for (const acc of accounts) {
      const rate = await getExchangeRate(acc.currency, baseCurrency);
      const inBase = convertCurrency(decimalToFixed(acc.balance), rate);
      if (acc.classification === 'ASSET') {
        totalAssets = addMoney(totalAssets, inBase);
        if (acc.accountType === 'DEPOSITORY') {
          cashAndDepository = addMoney(cashAndDepository, inBase);
        } else if (acc.accountType === 'INVESTMENT' || acc.accountType === 'CRYPTO') {
          investmentsAndCrypto = addMoney(investmentsAndCrypto, inBase);
        } else if (acc.accountType === 'PROPERTY' || acc.accountType === 'VEHICLE') {
          realEstateAndVehicles = addMoney(realEstateAndVehicles, inBase);
        } else {
          otherAssets = addMoney(otherAssets, inBase);
        }
        assetGroups.push({
          id: acc.id,
          name: acc.name,
          accountType: acc.accountType,
          balanceInBase: inBase,
        });
      } else {
        totalLiabilities = addMoney(totalLiabilities, inBase);
        liabilityGroups.push({
          id: acc.id,
          name: acc.name,
          accountType: acc.accountType,
          balanceInBase: inBase,
        });
      }
    }

    const netWorth = subMoney(totalAssets, totalLiabilities);

    // Aggregate daily materialized AccountBalance snapshots into family Net Worth history
    const dailyMap = new Map<string, { assets: string; liabilities: string }>();
    for (const snap of snapshots) {
      const dateStr = toIsoDate(snap.date);
      const rate = await getExchangeRate(snap.currency, baseCurrency);
      const valInBase = convertCurrency(decimalToFixed(snap.balance), rate);
      const bucket = dailyMap.get(dateStr) ?? { assets: '0.0000', liabilities: '0.0000' };
      if (snap.account.classification === 'ASSET') {
        bucket.assets = addMoney(bucket.assets, valInBase);
      } else {
        bucket.liabilities = addMoney(bucket.liabilities, valInBase);
      }
      dailyMap.set(dateStr, bucket);
    }

    const netWorthHistory = Array.from(dailyMap.entries()).map(([date, vals]) => ({
      date,
      assets: vals.assets,
      liabilities: vals.liabilities,
      netWorth: subMoney(vals.assets, vals.liabilities),
    }));

    if (netWorthHistory.length === 0) {
      netWorthHistory.push({
        date: new Date().toISOString().slice(0, 10),
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth,
      });
    }

    let totalIncome = '0.0000';
    let totalExpenses = '0.0000';
    const currentMonth = new Date().toISOString().slice(0, 7);
    const incomeByCategory = new Map<string, { name: string; color: string; amount: string }>();
    const expenseByCategory = new Map<string, { name: string; color: string; amount: string }>();
    const currentMonthSpentByCat = new Map<string, { color: string; amount: string }>();
    const priorMonthSpentByCat = new Map<
      string,
      { color: string; total: string; months: Set<string> }
    >();
    const priorMonthsSeen = new Set<string>();

    for (const entry of entries) {
      if (entry.childSplits.length > 0) continue;
      if (entry.inflowMatch) continue;
      if (
        entry.parentEntry &&
        (entry.parentEntry.excluded || entry.parentEntry.inflowMatch)
      ) {
        continue;
      }
      const rate = await getExchangeRate(entry.currency, baseCurrency);
      const amtInBase = convertCurrency(decimalToFixed(entry.amount), rate);
      const cat = entry.transaction?.category;
      const entryMonth = toIsoDate(entry.date).slice(0, 7);

      if (compareMoney(amtInBase, '0.0000') > 0) {
        totalIncome = addMoney(totalIncome, amtInBase);
        const catName = cat?.name ?? 'General Income';
        const prev = incomeByCategory.get(catName) ?? {
          name: catName,
          color: cat?.color ?? '#10b981',
          amount: '0.0000',
        };
        prev.amount = addMoney(prev.amount, amtInBase);
        incomeByCategory.set(catName, prev);
      } else if (compareMoney(amtInBase, '0.0000') < 0) {
        const absAmt = absMoney(amtInBase);
        totalExpenses = addMoney(totalExpenses, absAmt);
        const catName = cat?.name ?? 'Uncategorized Expense';
        const catColor = cat?.color ?? '#ef4444';
        const prev = expenseByCategory.get(catName) ?? {
          name: catName,
          color: catColor,
          amount: '0.0000',
        };
        prev.amount = addMoney(prev.amount, absAmt);
        expenseByCategory.set(catName, prev);

        if (entryMonth === currentMonth) {
          const cur = currentMonthSpentByCat.get(catName) ?? {
            color: catColor,
            amount: '0.0000',
          };
          cur.amount = addMoney(cur.amount, absAmt);
          currentMonthSpentByCat.set(catName, cur);
        } else if (entryMonth < currentMonth) {
          priorMonthsSeen.add(entryMonth);
          const hist = priorMonthSpentByCat.get(catName) ?? {
            color: catColor,
            total: '0.0000',
            months: new Set<string>(),
          };
          hist.total = addMoney(hist.total, absAmt);
          hist.months.add(entryMonth);
          priorMonthSpentByCat.set(catName, hist);
        }
      }
    }

    // Spending vs Normal (Sure reports/spending_vs_normal parity: up to 12 prior months average)
    const activePriorCount = Math.min(12, priorMonthsSeen.size);
    const allSpendCats = new Set([
      ...currentMonthSpentByCat.keys(),
      ...priorMonthSpentByCat.keys(),
    ]);
    const spendingVsNormal = Array.from(allSpendCats)
      .map((name) => {
        const cur = currentMonthSpentByCat.get(name);
        const hist = priorMonthSpentByCat.get(name);
        const currentSpent = cur?.amount ?? '0.0000';
        const divisor = activePriorCount > 0 ? activePriorCount : 1;
        const normalAverage =
          hist && activePriorCount > 0
            ? divMoney(hist.total, `${divisor}.0000`)
            : '0.0000';
        const deltaAmount = subMoney(currentSpent, normalAverage);
        const deltaPercent =
          compareMoney(normalAverage, '0.0000') > 0
            ? divMoney(mulMoney(deltaAmount, '100.0000'), normalAverage)
            : '0.0000';
        let status: 'ABOVE' | 'BELOW' | 'ON_PACE' = 'ON_PACE';
        if (compareMoney(deltaAmount, '0.0000') > 0) status = 'ABOVE';
        else if (compareMoney(deltaAmount, '0.0000') < 0) status = 'BELOW';

        return {
          name,
          color: cur?.color ?? hist?.color ?? '#ef4444',
          currentSpent,
          normalAverage,
          deltaAmount,
          deltaPercent,
          status,
          priorMonthsCount: hist?.months.size ?? 0,
        };
      })
      .sort((a, b) => compareMoney(b.currentSpent, a.currentSpent));

    const netSavings = subMoney(totalIncome, totalExpenses);
    const savingsRatePercent =
      compareMoney(totalIncome, '0.0000') > 0
        ? divMoney(mulMoney(netSavings, '100.0000'), totalIncome)
        : '0.0000';

    const sankeyNodes: Array<{ id: string; label: string; color: string; amount: string }> = [];
    const sankeyLinks: Array<{ source: string; target: string; value: string; color: string }> = [];

    const hubId = 'hub:total_cash_flow';
    sankeyNodes.push({
      id: hubId,
      label: 'Total Cash Inflow',
      color: '#3b82f6',
      amount: totalIncome,
    });

    for (const inc of incomeByCategory.values()) {
      const nodeId = `in:${inc.name}`;
      sankeyNodes.push({
        id: nodeId,
        label: inc.name,
        color: inc.color,
        amount: inc.amount,
      });
      sankeyLinks.push({
        source: nodeId,
        target: hubId,
        value: inc.amount,
        color: inc.color,
      });
    }

    for (const exp of expenseByCategory.values()) {
      const nodeId = `out:${exp.name}`;
      sankeyNodes.push({
        id: nodeId,
        label: exp.name,
        color: exp.color,
        amount: exp.amount,
      });
      sankeyLinks.push({
        source: hubId,
        target: nodeId,
        value: exp.amount,
        color: exp.color,
      });
    }

    if (compareMoney(netSavings, '0.0000') > 0) {
      const savId = 'out:net_savings';
      sankeyNodes.push({
        id: savId,
        label: 'Net Savings',
        color: '#10b981',
        amount: netSavings,
      });
      sankeyLinks.push({
        source: hubId,
        target: savId,
        value: netSavings,
        color: '#10b981',
      });
    }

    return {
      baseCurrency,
      balanceSheet: {
        totalAssets,
        totalLiabilities,
        netWorth,
        assetMix: {
          cashAndDepository,
          investmentsAndCrypto,
          realEstateAndVehicles,
          otherAssets,
        },
        netWorthHistory,
        assets: assetGroups,
        liabilities: liabilityGroups,
      },
      incomeStatement: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRatePercent,
        incomeBreakdown: Array.from(incomeByCategory.values()),
        expenseBreakdown: Array.from(expenseByCategory.values()),
      },
      spendingVsNormal: {
        currentMonth,
        priorMonthsCompared: activePriorCount,
        categories: spendingVsNormal,
      },
      sankey: {
        nodes: sankeyNodes,
        links: sankeyLinks,
      },
    };
  }
}

export const reportsService = new ReportsService();
