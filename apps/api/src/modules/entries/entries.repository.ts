import { Prisma } from '@prisma/client';
import {
  CreateEntryInput,
  EntryFilterQuery,
  EntryType,
  TradeAction,
  UpdateEntryInput,
  ValuationKind,
  addMoney,
  subMoney,
  mulMoney,
  divMoney,
  compareMoney,
  isPositiveMoney,
  toFixedDecimalString,
} from '@sure/shared';
import {
  decimalToFixed,
  parseIsoDate,
  prisma,
  toIsoDate,
} from '../../config/prisma.js';

export interface EntryDto {
  id: string;
  accountId: string;
  familyId: string;
  entryType: EntryType;
  date: string;
  amount: string;
  currency: string;
  name: string;
  notes: string | null;
  excluded: boolean;
  parentEntryId: string | null;
  importId: string | null;
  externalId: string | null;
  categoryId: string | null;
  merchantId: string | null;
  tagIds: string[];
  attachments: string[];
  valuationKind?: ValuationKind;
  tradeDetails?: {
    securityTicker: string;
    securityName: string;
    tradeAction: TradeAction;
    qty: string;
    price: string;
    fees: string;
  };
  transferMatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

const entryInclude = {
  account: { select: { id: true, name: true } },
  transaction: {
    include: {
      category: true,
      merchant: true,
    },
  },
  valuation: true,
  trade: {
    include: { security: true },
  },
  tags: {
    include: { tag: true },
  },
  outflowMatch: { select: { id: true } },
  inflowMatch: { select: { id: true } },
} satisfies Prisma.EntryInclude;

type EntryWithRelations = Prisma.EntryGetPayload<{ include: typeof entryInclude }>;

export function mapEntryToDto(row: EntryWithRelations): EntryDto {
  const transferMatchId = row.outflowMatch?.id ?? row.inflowMatch?.id ?? null;

  return {
    id: row.id,
    accountId: row.accountId,
    familyId: row.familyId,
    entryType: row.entryType as EntryType,
    date: toIsoDate(row.date),
    amount: decimalToFixed(row.amount),
    currency: row.currency,
    name: row.name,
    notes: row.notes ?? null,
    excluded: row.excluded,
    parentEntryId: row.parentEntryId ?? null,
    importId: row.importId ?? null,
    externalId: row.externalId ?? null,
    categoryId: row.transaction?.categoryId ?? null,
    merchantId: row.transaction?.merchantId ?? null,
    tagIds: row.tags.map((et) => et.tagId),
    attachments: row.transaction?.attachments ?? [],
    ...(row.valuation ? { valuationKind: row.valuation.kind as ValuationKind } : {}),
    ...(row.trade
      ? {
          tradeDetails: {
            securityTicker: row.trade.security.ticker,
            securityName: row.trade.security.name,
            tradeAction: row.trade.action as TradeAction,
            qty: decimalToFixed(row.trade.qty),
            price: decimalToFixed(row.trade.price),
            fees: decimalToFixed(row.trade.fees),
          },
        }
      : {}),
    transferMatchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class EntriesRepository {
  public async findPaginated(familyId: string, filters: EntryFilterQuery) {
    const where: Prisma.EntryWhereInput = {
      familyId,
      parentEntryId: null,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.entryType ? { entryType: filters.entryType } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            date: {
              ...(filters.startDate ? { gte: parseIsoDate(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: parseIsoDate(filters.endDate) } : {}),
            },
          }
        : {}),
      ...(filters.minAmount || filters.maxAmount
        ? {
            amount: {
              ...(filters.minAmount ? { gte: filters.minAmount } : {}),
              ...(filters.maxAmount ? { lte: filters.maxAmount } : {}),
            },
          }
        : {}),
      ...(filters.categoryId || filters.merchantId
        ? {
            transaction: {
              ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
              ...(filters.merchantId ? { merchantId: filters.merchantId } : {}),
            },
          }
        : {}),
      ...(filters.tagId
        ? {
            tags: {
              some: { tagId: filters.tagId },
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search.trim(), mode: 'insensitive' } },
              { notes: { contains: filters.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.entry.count({ where }),
    ]);

    return { rows, totalCount };
  }

  public async findById(familyId: string, entryId: string): Promise<EntryDto | null> {
    const row = await prisma.entry.findFirst({
      where: { id: entryId, familyId },
      include: entryInclude,
    });
    return row ? mapEntryToDto(row) : null;
  }

  public async findChildSplits(familyId: string, parentEntryId: string): Promise<EntryDto[]> {
    const rows = await prisma.entry.findMany({
      where: { familyId, parentEntryId },
      include: entryInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapEntryToDto);
  }

  public async create(familyId: string, input: CreateEntryInput): Promise<EntryDto> {
    const created = await prisma.$transaction(async (tx) => {
      let securityId: string | undefined;
      if (input.entryType === 'TRADE') {
        const ticker = input.securityTicker.toUpperCase();
        const security = await tx.security.upsert({
          where: { ticker },
          update: { currentPrice: toFixedDecimalString(input.price) },
          create: {
            ticker,
            name: input.securityName,
            currency: input.currency.toUpperCase(),
            currentPrice: toFixedDecimalString(input.price),
          },
        });
        securityId = security.id;
      }

      const row = await tx.entry.create({
        data: {
          accountId: input.accountId,
          familyId,
          entryType: input.entryType,
          date: parseIsoDate(input.date),
          amount: toFixedDecimalString(input.amount),
          currency: input.currency.toUpperCase(),
          name: input.name,
          notes: input.notes ?? null,
          excluded: input.entryType === 'TRANSACTION' ? input.excluded : false,
          ...(input.entryType === 'TRANSACTION'
            ? {
                transaction: {
                  create: {
                    categoryId: input.categoryId ?? null,
                    merchantId: input.merchantId ?? null,
                    attachments: input.attachments ?? [],
                  },
                },
                ...(input.tagIds.length > 0
                  ? {
                      tags: {
                        create: input.tagIds.map((tagId) => ({ tagId })),
                      },
                    }
                  : {}),
              }
            : {}),
          ...(input.entryType === 'VALUATION'
            ? {
                valuation: {
                  create: {
                    kind: input.valuationKind,
                  },
                },
              }
            : {}),
          ...(input.entryType === 'TRADE' && securityId
            ? {
                trade: {
                  create: {
                    securityId,
                    action: input.tradeAction,
                    qty: toFixedDecimalString(input.qty),
                    price: toFixedDecimalString(input.price),
                    fees: toFixedDecimalString(input.fees),
                  },
                },
              }
            : {}),
        },
        include: entryInclude,
      });

      if (input.entryType === 'TRADE' && securityId) {
        const existingHolding = await tx.holding.findUnique({
          where: {
            accountId_securityId: {
              accountId: input.accountId,
              securityId,
            },
          },
        });

        const tradeQty = toFixedDecimalString(input.qty, 8);
        const tradePrice = toFixedDecimalString(input.price);
        const currQty = existingHolding ? decimalToFixed(existingHolding.qty, 8) : '0.00000000';
        const currAvg = existingHolding ? decimalToFixed(existingHolding.avgCostBasis) : tradePrice;

        let nextQty = currQty;
        let nextAvg = currAvg;

        if (input.tradeAction === 'BUY' || input.tradeAction === 'DIVIDEND') {
          nextQty = toFixedDecimalString(addMoney(currQty, tradeQty), 8);
          if (isPositiveMoney(nextQty)) {
            const totalCost = addMoney(
              mulMoney(currQty, currAvg),
              mulMoney(tradeQty, tradePrice)
            );
            nextAvg = divMoney(totalCost, nextQty);
          }
        } else if (input.tradeAction === 'SELL') {
          const subtracted = subMoney(currQty, tradeQty);
          nextQty =
            compareMoney(subtracted, '0.0000') > 0
              ? toFixedDecimalString(subtracted, 8)
              : '0.00000000';
        } else if (input.tradeAction === 'SPLIT' && isPositiveMoney(tradeQty)) {
          nextQty = toFixedDecimalString(mulMoney(currQty, tradeQty), 8);
          nextAvg = divMoney(currAvg, tradeQty);
        }

        const nextMarketValue = mulMoney(nextQty, tradePrice);
        await tx.holding.upsert({
          where: {
            accountId_securityId: {
              accountId: input.accountId,
              securityId,
            },
          },
          update: {
            qty: nextQty,
            avgCostBasis: nextAvg,
            marketValue: nextMarketValue,
          },
          create: {
            accountId: input.accountId,
            securityId,
            qty: nextQty,
            avgCostBasis: nextAvg,
            marketValue: nextMarketValue,
          },
        });
      }

      return row;
    });

    return mapEntryToDto(created);
  }

  public async update(
    familyId: string,
    entryId: string,
    input: UpdateEntryInput
  ): Promise<EntryDto | null> {
    const existing = await prisma.entry.findFirst({
      where: { id: entryId, familyId },
      include: { transaction: true },
    });
    if (!existing) return null;

    const updated = await prisma.$transaction(async (tx) => {
      if (input.tagIds !== undefined) {
        await tx.entryTag.deleteMany({ where: { entryId } });
        if (input.tagIds.length > 0) {
          await tx.entryTag.createMany({
            data: input.tagIds.map((tagId) => ({ entryId, tagId })),
          });
        }
      }

      if (
        existing.entryType === 'TRANSACTION' &&
        (input.categoryId !== undefined || input.merchantId !== undefined)
      ) {
        await tx.transaction.upsert({
          where: { entryId },
          update: {
            ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
            ...(input.merchantId !== undefined ? { merchantId: input.merchantId } : {}),
          },
          create: {
            entryId,
            categoryId: input.categoryId ?? null,
            merchantId: input.merchantId ?? null,
          },
        });
      }

      return tx.entry.update({
        where: { id: entryId },
        data: {
          ...(input.date !== undefined ? { date: parseIsoDate(input.date) } : {}),
          ...(input.amount !== undefined ? { amount: toFixedDecimalString(input.amount) } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.excluded !== undefined ? { excluded: input.excluded } : {}),
        },
        include: entryInclude,
      });
    });

    return mapEntryToDto(updated);
  }

  public async delete(familyId: string, entryId: string): Promise<EntryDto | null> {
    const existing = await this.findById(familyId, entryId);
    if (!existing) return null;

    await prisma.$transaction(async (tx) => {
      // Matches Sure's Transfer#release_transactions: un-exclude any surviving paired leg
      const matches = await tx.transferMatch.findMany({
        where: {
          familyId,
          OR: [{ outflowEntryId: entryId }, { inflowEntryId: entryId }],
        },
      });
      const pairedIds = matches
        .map((m) => (m.outflowEntryId === entryId ? m.inflowEntryId : m.outflowEntryId))
        .filter((id) => id !== entryId);
      if (pairedIds.length > 0) {
        await tx.entry.updateMany({
          where: { familyId, id: { in: pairedIds } },
          data: { excluded: false },
        });
      }

      await tx.entry.delete({ where: { id: entryId } });
    });
    return existing;
  }
}

export const entriesRepository = new EntriesRepository();
