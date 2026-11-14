import {
  CreateEntryInput,
  UpdateEntryInput,
  SplitTransactionInput,
  MatchTransferInput,
  CreateTransferInput,
  BulkEntryUpdateInput,
  EntryFilterQuery,
  sumMoney,
  compareMoney,
  absMoney,
  negateMoney,
  isPositiveMoney,
  toFixedDecimalString,
} from '@sure/shared';
import { AppError } from '../../middleware/pipeline.js';
import { decimalToFixed, parseIsoDate, prisma, toIsoDate } from '../../config/prisma.js';
import { BalanceService } from '../balances/balance.service.js';
import { RulesService, rulesService } from '../rules/rules.service.js';
import { EntryDto, entriesRepository, mapEntryToDto } from './entries.repository.js';

export class EntriesService {
  public async listEntries(familyId: string, filters: EntryFilterQuery) {
    const { rows, totalCount } = await entriesRepository.findPaginated(familyId, filters);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const dto = mapEntryToDto(row);
        const splits = await entriesRepository.findChildSplits(familyId, row.id);
        return {
          ...dto,
          accountName: row.account.name,
          category: row.transaction?.category ?? null,
          merchant: row.transaction?.merchant ?? null,
          tags: row.tags.map((et) => et.tag),
          splits,
        };
      })
    );

    const totalPages = Math.max(1, Math.ceil(totalCount / filters.perPage));
    return {
      data: enriched,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        totalCount,
        totalPages,
      },
    };
  }

  public async getEntryById(familyId: string, entryId: string) {
    const entry = await entriesRepository.findById(familyId, entryId);
    if (!entry) {
      throw new AppError('NOT_FOUND', 'Entry not found');
    }
    const splits = await entriesRepository.findChildSplits(familyId, entry.id);
    return { ...entry, splits };
  }

  public async createEntry(familyId: string, input: CreateEntryInput): Promise<EntryDto> {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, familyId },
    });
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }

    const entry = await entriesRepository.create(familyId, input);

    // Apply active rules if entryType === 'TRANSACTION'
    if (entry.entryType === 'TRANSACTION') {
      const activeRules = (await rulesService.listRules(familyId)).filter((r) => r.isActive);
      for (const rule of activeRules) {
        if (
          RulesService.doesRuleMatch(
            {
              id: entry.id,
              accountId: entry.accountId,
              familyId: entry.familyId,
              amount: entry.amount,
              name: entry.name,
              notes: entry.notes,
              excluded: entry.excluded,
            },
            rule
          )
        ) {
          await RulesService.applyRuleActionsToEntryInDb(entry.id, rule);
        }
      }
    }

    // Invariant #3: Any mutation to Entry records MUST trigger BalanceService
    await BalanceService.materializeAccount(familyId, entry.accountId);
    return (await entriesRepository.findById(familyId, entry.id))!;
  }

  public async updateEntry(
    familyId: string,
    entryId: string,
    input: UpdateEntryInput
  ): Promise<EntryDto> {
    const updated = await entriesRepository.update(familyId, entryId, input);
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Entry not found');
    }

    // Invariant #3: Recalculate & materialize daily balances
    await BalanceService.materializeAccount(familyId, updated.accountId);
    return updated;
  }

  public async deleteEntry(familyId: string, entryId: string): Promise<void> {
    const deleted = await entriesRepository.delete(familyId, entryId);
    if (!deleted) {
      throw new AppError('NOT_FOUND', 'Entry not found');
    }
    await BalanceService.materializeAccount(familyId, deleted.accountId);
  }

  /**
   * FR-2.4 Split Transactions: Divide a single parent transaction into multiple child entries
   * across different categories. Sum of child splits MUST equal parent transaction amount.
   */
  public async splitTransaction(
    familyId: string,
    entryId: string,
    input: SplitTransactionInput
  ) {
    const parent = await prisma.entry.findFirst({
      where: { id: entryId, familyId },
    });
    if (!parent) {
      throw new AppError('NOT_FOUND', 'Transaction not found');
    }
    if (parent.entryType !== 'TRANSACTION') {
      throw new AppError('VALIDATION_ERROR', 'Only TRANSACTION entries can be split');
    }

    const parentAmount = decimalToFixed(parent.amount);
    const totalSplits = sumMoney(input.splits.map((s) => s.amount));
    if (compareMoney(totalSplits, parentAmount) !== 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Split total (${totalSplits}) must exactly equal parent transaction amount (${parentAmount})`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.entry.deleteMany({
        where: { familyId, parentEntryId: parent.id },
      });

      for (const s of input.splits) {
        await tx.entry.create({
          data: {
            accountId: parent.accountId,
            familyId,
            entryType: 'TRANSACTION',
            date: parent.date,
            amount: toFixedDecimalString(s.amount),
            currency: parent.currency,
            name: s.name,
            notes: s.notes ?? null,
            excluded: parent.excluded,
            parentEntryId: parent.id,
            transaction: {
              create: {
                categoryId: s.categoryId ?? null,
              },
            },
          },
        });
      }
    });

    await BalanceService.materializeAccount(familyId, parent.accountId);
    const refreshedParent = await entriesRepository.findById(familyId, parent.id);
    const splits = await entriesRepository.findChildSplits(familyId, parent.id);

    return {
      ...refreshedParent,
      splits,
    };
  }

  /**
   * FR-2.4 Transfer Matching: Link offsetting outflow/inflow transactions between family accounts
   * so internal transfers are excluded from income/expense totals.
   */
  public async matchTransfer(familyId: string, input: MatchTransferInput) {
    const outflow = await entriesRepository.findById(familyId, input.outflowEntryId);
    const inflow = await entriesRepository.findById(familyId, input.inflowEntryId);

    if (!outflow || !inflow) {
      throw new AppError('NOT_FOUND', 'One or both transfer entries not found');
    }
    if (outflow.accountId === inflow.accountId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Internal transfer must be between two different accounts'
      );
    }
    if (compareMoney(absMoney(outflow.amount), absMoney(inflow.amount)) !== 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Transfer outflow and inflow absolute amounts must match'
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: outflow.accountId, familyId } }),
      prisma.account.findFirst({ where: { id: inflow.accountId, familyId } }),
    ]);
    const isInvestmentOrCrypto = (t?: string) => t === 'INVESTMENT' || t === 'CRYPTO';
    const outflowExcluded =
      toAccount?.accountType !== 'LOAN' &&
      !(
        isInvestmentOrCrypto(toAccount?.accountType) &&
        !isInvestmentOrCrypto(fromAccount?.accountType)
      );

    const match = await prisma.$transaction(async (tx) => {
      const created = await tx.transferMatch.create({
        data: {
          familyId,
          outflowEntryId: outflow.id,
          inflowEntryId: inflow.id,
          matchedBy: 'MANUAL',
        },
      });

      await tx.entry.update({
        where: { id: outflow.id },
        data: { excluded: outflowExcluded },
      });
      await tx.entry.update({
        where: { id: inflow.id },
        data: { excluded: true },
      });

      return created;
    });

    return match;
  }

  /**
   * Creates an atomic paired transfer between two family accounts (`Transfer::Creator` parity).
   * Outflow leg gets `-amount`, inflow leg gets `+amount`, linked in TransferMatch & excluded from cash flow.
   */
  public async createTransfer(familyId: string, input: CreateTransferInput) {
    if (input.fromAccountId === input.toAccountId) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Internal transfer must be between two different accounts'
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: input.fromAccountId, familyId } }),
      prisma.account.findFirst({ where: { id: input.toAccountId, familyId } }),
    ]);
    if (!fromAccount || !toAccount) {
      throw new AppError('NOT_FOUND', 'One or both transfer accounts not found');
    }

    const absAmt = absMoney(toFixedDecimalString(input.amount));
    if (!isPositiveMoney(absAmt)) {
      throw new AppError('VALIDATION_ERROR', 'Transfer amount must be positive');
    }

    const isInvestmentOrCrypto = (t: string) => t === 'INVESTMENT' || t === 'CRYPTO';
    // Matches Sure Transfer.kind_for_account + Transaction::BUDGET_EXCLUDED_KINDS:
    // loan payments and non-investment->investment/crypto contributions count as expenses.
    const outflowExcluded =
      toAccount.accountType !== 'LOAN' &&
      !(
        isInvestmentOrCrypto(toAccount.accountType) &&
        !isInvestmentOrCrypto(fromAccount.accountType)
      );

    const label =
      input.name?.trim() ||
      (toAccount.classification === 'LIABILITY'
        ? `Payment to ${toAccount.name}`
        : `Transfer to ${toAccount.name}`);

    const created = await prisma.$transaction(async (tx) => {
      const outflow = await tx.entry.create({
        data: {
          accountId: fromAccount.id,
          familyId,
          entryType: 'TRANSACTION',
          date: parseIsoDate(input.date),
          amount: negateMoney(absAmt),
          currency: fromAccount.currency,
          name: label,
          notes: input.notes ?? null,
          excluded: outflowExcluded,
          transaction: { create: {} },
        },
      });

      const inflow = await tx.entry.create({
        data: {
          accountId: toAccount.id,
          familyId,
          entryType: 'TRANSACTION',
          date: parseIsoDate(input.date),
          amount: absAmt,
          currency: toAccount.currency,
          name: `Transfer from ${fromAccount.name}`,
          notes: input.notes ?? null,
          excluded: true,
          transaction: { create: {} },
        },
      });

      const match = await tx.transferMatch.create({
        data: {
          familyId,
          outflowEntryId: outflow.id,
          inflowEntryId: inflow.id,
          matchedBy: 'MANUAL',
        },
      });

      return { match, outflowId: outflow.id, inflowId: inflow.id };
    });

    await BalanceService.materializeAccount(familyId, fromAccount.id);
    await BalanceService.materializeAccount(familyId, toAccount.id);

    return created;
  }

  public async suggestTransfers(familyId: string) {
    const entries = await prisma.entry.findMany({
      where: {
        familyId,
        entryType: 'TRANSACTION',
        parentEntryId: null,
        outflowMatch: null,
        inflowMatch: null,
      },
      include: { account: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 250,
    });

    const outflows = entries.filter(
      (e) => compareMoney(decimalToFixed(e.amount), '0.0000') < 0
    );
    const inflows = entries.filter(
      (e) => compareMoney(decimalToFixed(e.amount), '0.0000') > 0
    );

    const suggestions: Array<{
      outflowEntryId: string;
      inflowEntryId: string;
      amount: string;
      outflowName: string;
      outflowAccountName: string;
      outflowDate: string;
      inflowName: string;
      inflowAccountName: string;
      inflowDate: string;
    }> = [];

    const usedInflows = new Set<string>();
    for (const out of outflows) {
      const outAbs = absMoney(decimalToFixed(out.amount));
      const match = inflows.find((inf) => {
        if (usedInflows.has(inf.id)) return false;
        if (inf.accountId === out.accountId) return false;
        if (compareMoney(outAbs, decimalToFixed(inf.amount)) !== 0) return false;
        const dayDiff = Math.abs(inf.date.getTime() - out.date.getTime()) / (1000 * 60 * 60 * 24);
        return dayDiff <= 5;
      });
      if (match) {
        usedInflows.add(match.id);
        suggestions.push({
          outflowEntryId: out.id,
          inflowEntryId: match.id,
          amount: outAbs,
          outflowName: out.name,
          outflowAccountName: out.account.name,
          outflowDate: toIsoDate(out.date),
          inflowName: match.name,
          inflowAccountName: match.account.name,
          inflowDate: toIsoDate(match.date),
        });
      }
    }

    return suggestions;
  }

  /**
   * FR-2.4 Bulk Actions: Multi-select bulk categorization, tagging, merchant assignment, exclusion, and deletion.
   */
  public async bulkUpdateEntries(
    familyId: string,
    input: BulkEntryUpdateInput
  ): Promise<{ affectedCount: number }> {
    const targets = await prisma.entry.findMany({
      where: { id: { in: input.entryIds }, familyId },
    });

    const affectedAccounts = new Set<string>(targets.map((t) => t.accountId));

    for (const entry of targets) {
      if (input.action === 'DELETE') {
        await prisma.entry.delete({ where: { id: entry.id } });
      } else if (input.action === 'CATEGORIZE') {
        await prisma.transaction.upsert({
          where: { entryId: entry.id },
          update: { categoryId: input.categoryId ?? null },
          create: { entryId: entry.id, categoryId: input.categoryId ?? null },
        });
      } else if (input.action === 'ASSIGN_MERCHANT') {
        await prisma.transaction.upsert({
          where: { entryId: entry.id },
          update: { merchantId: input.merchantId ?? null },
          create: { entryId: entry.id, merchantId: input.merchantId ?? null },
        });
      } else if (input.action === 'ADD_TAGS' && input.tagIds) {
        for (const tagId of input.tagIds) {
          await prisma.entryTag.upsert({
            where: { entryId_tagId: { entryId: entry.id, tagId } },
            update: {},
            create: { entryId: entry.id, tagId },
          });
        }
      } else if (input.action === 'TOGGLE_EXCLUDED') {
        await prisma.entry.update({
          where: { id: entry.id },
          data: { excluded: input.excluded ?? !entry.excluded },
        });
      }
    }

    for (const accId of affectedAccounts) {
      await BalanceService.materializeAccount(familyId, accId);
    }

    return { affectedCount: targets.length };
  }
}

export const entriesService = new EntriesService();
