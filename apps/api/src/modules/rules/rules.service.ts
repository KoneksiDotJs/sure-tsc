import { Prisma } from '@prisma/client';
import {
  CreateRuleInput,
  RuleAction,
  RuleCondition,
  compareMoney,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  toFixedDecimalString,
} from '@sure/shared';
import { decimalToFixed, prisma, toIsoDate } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';

export interface RuleEvaluatableEntry {
  id: string;
  accountId: string;
  familyId: string;
  amount: string;
  name: string;
  notes: string | null;
  excluded: boolean;
  merchantName?: string | null;
  categoryId?: string | null;
  merchantId?: string | null;
  tagIds?: string[];
}

export interface RuleDto {
  id: string;
  familyId: string;
  name: string;
  groupName: string;
  priority: number;
  matchMode: 'ALL' | 'ANY';
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction;
  createdAt: string;
}

/**
 * Rule Engine (`Rule` & `RuleGroup` per FR-3.2)
 * Evaluates conditions (`merchant`, `name`, `notes`, `amount`, `account`, `transaction_type`)
 * with operators (`equals`, `contains`, `starts_with`, `gt`, `lt`, `between`)
 * and applies actions (`category`, `merchant`, `tags`, `display_name`, `excluded`, `split`).
 */
export class RulesService {
  public static evaluateCondition(
    entry: RuleEvaluatableEntry,
    condition: RuleCondition
  ): boolean {
    const { field, operator, value, secondaryValue } = condition;

    if (field === 'amount') {
      try {
        const entryAmt = toFixedDecimalString(entry.amount);
        const targetAmt = toFixedDecimalString(value);
        const cmp = compareMoney(entryAmt, targetAmt);

        switch (operator) {
          case 'equals':
            return cmp === 0;
          case 'gt':
            return cmp === 1;
          case 'lt':
            return cmp === -1;
          case 'between': {
            if (!secondaryValue) return false;
            const upperAmt = toFixedDecimalString(secondaryValue);
            return compareMoney(entryAmt, targetAmt) >= 0 && compareMoney(entryAmt, upperAmt) <= 0;
          }
          default:
            return false;
        }
      } catch {
        return false;
      }
    }

    let candidate = '';
    if (field === 'name') {
      candidate = entry.name;
    } else if (field === 'notes') {
      candidate = entry.notes ?? '';
    } else if (field === 'account') {
      candidate = entry.accountId;
    } else if (field === 'merchant') {
      candidate = entry.merchantName ?? entry.name;
    } else if (field === 'transaction_type') {
      candidate = compareMoney(entry.amount, '0.0000') >= 0 ? 'INCOME' : 'EXPENSE';
    }

    const normCandidate = candidate.toLowerCase();
    const normValue = value.toLowerCase();

    switch (operator) {
      case 'equals':
        return normCandidate === normValue;
      case 'contains':
        return normCandidate.includes(normValue);
      case 'starts_with':
        return normCandidate.startsWith(normValue);
      default:
        return false;
    }
  }

  public static doesRuleMatch(
    entry: RuleEvaluatableEntry,
    rule: Pick<RuleDto, 'matchMode' | 'conditions'>
  ): boolean {
    if (rule.conditions.length === 0) return false;
    if (rule.matchMode === 'ALL') {
      return rule.conditions.every((cond) => RulesService.evaluateCondition(entry, cond));
    }
    return rule.conditions.some((cond) => RulesService.evaluateCondition(entry, cond));
  }

  public static async applyRuleActionsToEntryInDb(entryId: string, rule: RuleDto): Promise<void> {
    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { transaction: true },
    });
    if (!entry || entry.entryType !== 'TRANSACTION') return;

    const actions = rule.actions;

    await prisma.$transaction(async (tx) => {
      if (actions.setDisplayName || actions.setExcluded !== undefined) {
        await tx.entry.update({
          where: { id: entryId },
          data: {
            ...(actions.setDisplayName ? { name: actions.setDisplayName } : {}),
            ...(actions.setExcluded !== undefined ? { excluded: actions.setExcluded } : {}),
          },
        });
      }

      if (actions.setCategoryId || actions.setMerchantId) {
        await tx.transaction.upsert({
          where: { entryId },
          update: {
            ...(actions.setCategoryId ? { categoryId: actions.setCategoryId } : {}),
            ...(actions.setMerchantId ? { merchantId: actions.setMerchantId } : {}),
          },
          create: {
            entryId,
            categoryId: actions.setCategoryId ?? null,
            merchantId: actions.setMerchantId ?? null,
          },
        });
      }

      if (actions.addTagIds && actions.addTagIds.length > 0) {
        for (const tagId of actions.addTagIds) {
          await tx.entryTag.upsert({
            where: { entryId_tagId: { entryId, tagId } },
            update: {},
            create: { entryId, tagId },
          });
        }
      }

      if (actions.splitRatios && actions.splitRatios.length >= 2) {
        await tx.entry.deleteMany({ where: { parentEntryId: entryId } });
        const parentAmount = decimalToFixed(entry.amount);
        let allocatedSoFar = '0.0000';
        for (let idx = 0; idx < actions.splitRatios.length; idx++) {
          const ratio = actions.splitRatios[idx]!;
          const isLast = idx === actions.splitRatios.length - 1;
          const splitAmount = isLast
            ? subMoney(parentAmount, allocatedSoFar)
            : divMoney(mulMoney(parentAmount, ratio.percentage), '100.0000');
          allocatedSoFar = addMoney(allocatedSoFar, splitAmount);
          await tx.entry.create({
            data: {
              accountId: entry.accountId,
              familyId: entry.familyId,
              entryType: 'TRANSACTION',
              date: entry.date,
              amount: splitAmount,
              currency: entry.currency,
              name: `${actions.setDisplayName ?? entry.name} (${ratio.label})`,
              notes: entry.notes,
              excluded: actions.setExcluded ?? entry.excluded,
              parentEntryId: entryId,
              transaction: {
                create: {
                  categoryId: ratio.categoryId,
                  merchantId: actions.setMerchantId ?? entry.transaction?.merchantId ?? null,
                },
              },
            },
          });
        }
      }
    });
  }

  public async listRules(familyId: string): Promise<RuleDto[]> {
    const rows = await prisma.rule.findMany({
      where: { familyId },
      include: { ruleGroup: true },
      orderBy: { priority: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      familyId: r.familyId,
      name: r.name,
      groupName: r.ruleGroup?.name ?? 'General',
      priority: r.priority,
      matchMode: r.matchMode as 'ALL' | 'ANY',
      isActive: r.isActive,
      conditions: r.conditions as unknown as RuleCondition[],
      actions: r.actions as unknown as RuleAction,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public async createRule(familyId: string, input: CreateRuleInput): Promise<RuleDto> {
    const groupName = input.groupName ?? 'General';
    let group = await prisma.ruleGroup.findFirst({
      where: { familyId, name: groupName },
    });
    if (!group) {
      group = await prisma.ruleGroup.create({
        data: { familyId, name: groupName },
      });
    }

    const created = await prisma.rule.create({
      data: {
        familyId,
        ruleGroupId: group.id,
        name: input.name,
        priority: input.priority ?? 100,
        matchMode: input.matchMode ?? 'ALL',
        isActive: input.isActive ?? true,
        conditions: input.conditions as unknown as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
      },
      include: { ruleGroup: true },
    });

    return {
      id: created.id,
      familyId: created.familyId,
      name: created.name,
      groupName: created.ruleGroup?.name ?? 'General',
      priority: created.priority,
      matchMode: created.matchMode as 'ALL' | 'ANY',
      isActive: created.isActive,
      conditions: created.conditions as unknown as RuleCondition[],
      actions: created.actions as unknown as RuleAction,
      createdAt: created.createdAt.toISOString(),
    };
  }

  public async deleteRule(familyId: string, ruleId: string): Promise<void> {
    const res = await prisma.rule.deleteMany({
      where: { id: ruleId, familyId },
    });
    if (res.count === 0) {
      throw new AppError('NOT_FOUND', 'Rule not found');
    }
  }

  public async updateRule(
    familyId: string,
    ruleId: string,
    patch: Partial<CreateRuleInput>
  ): Promise<RuleDto> {
    const existing = await prisma.rule.findFirst({
      where: { id: ruleId, familyId },
      include: { ruleGroup: true },
    });
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Rule not found');
    }

    const updated = await prisma.rule.update({
      where: { id: existing.id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.matchMode !== undefined ? { matchMode: patch.matchMode } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.conditions !== undefined
          ? { conditions: patch.conditions as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.actions !== undefined
          ? { actions: patch.actions as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { ruleGroup: true },
    });

    return {
      id: updated.id,
      familyId: updated.familyId,
      name: updated.name,
      groupName: updated.ruleGroup?.name ?? 'General',
      priority: updated.priority,
      matchMode: updated.matchMode as 'ALL' | 'ANY',
      isActive: updated.isActive,
      conditions: updated.conditions as unknown as RuleCondition[],
      actions: updated.actions as unknown as RuleAction,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  public async dryRunRule(
    familyId: string,
    params: Pick<CreateRuleInput, 'matchMode' | 'conditions' | 'actions'>
  ) {
    const entries = await prisma.entry.findMany({
      where: { familyId, entryType: 'TRANSACTION', parentEntryId: null },
      include: {
        transaction: { include: { merchant: true } },
      },
      orderBy: { date: 'desc' },
    });

    const matching = entries.filter((e) =>
      RulesService.doesRuleMatch(
        {
          id: e.id,
          accountId: e.accountId,
          familyId: e.familyId,
          amount: decimalToFixed(e.amount),
          name: e.name,
          notes: e.notes,
          excluded: e.excluded,
          merchantName: e.transaction?.merchant?.name ?? null,
        },
        {
          matchMode: params.matchMode ?? 'ALL',
          conditions: params.conditions,
        }
      )
    );

    return {
      totalEvaluated: entries.length,
      matchCount: matching.length,
      matches: matching.slice(0, 50).map((m) => ({
        id: m.id,
        date: toIsoDate(m.date),
        name: m.name,
        amount: decimalToFixed(m.amount),
        proposedName: params.actions.setDisplayName ?? m.name,
        proposedCategoryId: params.actions.setCategoryId ?? m.transaction?.categoryId ?? null,
        proposedExcluded: params.actions.setExcluded ?? m.excluded,
      })),
    };
  }

  public async executeActiveRulesOnFamily(familyId: string): Promise<{ updatedCount: number }> {
    const activeRules = (await this.listRules(familyId)).filter((r) => r.isActive);
    const entries = await prisma.entry.findMany({
      where: { familyId, entryType: 'TRANSACTION', parentEntryId: null },
      include: {
        transaction: { include: { merchant: true } },
      },
    });

    let updatedCount = 0;
    for (const entry of entries) {
      const evalInput: RuleEvaluatableEntry = {
        id: entry.id,
        accountId: entry.accountId,
        familyId: entry.familyId,
        amount: decimalToFixed(entry.amount),
        name: entry.name,
        notes: entry.notes,
        excluded: entry.excluded,
        merchantName: entry.transaction?.merchant?.name ?? null,
      };
      for (const rule of activeRules) {
        if (RulesService.doesRuleMatch(evalInput, rule)) {
          await RulesService.applyRuleActionsToEntryInDb(entry.id, rule);
          updatedCount++;
        }
      }
    }

    return { updatedCount };
  }
}

export const rulesService = new RulesService();
