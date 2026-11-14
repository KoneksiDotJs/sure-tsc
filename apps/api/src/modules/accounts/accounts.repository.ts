import { Prisma } from '@prisma/client';
import {
  AccountClassification,
  AccountType,
  CreateAccountInput,
  UpdateAccountInput,
  getClassificationForAccountType,
  toFixedDecimalString,
} from '@sure/shared';
import { decimalToFixed, prisma } from '../../config/prisma.js';

export interface AccountDto {
  id: string;
  familyId: string;
  name: string;
  accountType: AccountType;
  classification: AccountClassification;
  currency: string;
  balance: string;
  subtypeDetails: Record<string, unknown>;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapAccount(row: {
  id: string;
  familyId: string;
  name: string;
  accountType: string;
  classification: string;
  currency: string;
  balance: Prisma.Decimal;
  subtypeDetails: Prisma.JsonValue;
  color: string;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AccountDto {
  return {
    id: row.id,
    familyId: row.familyId,
    name: row.name,
    accountType: row.accountType as AccountType,
    classification: row.classification as AccountClassification,
    currency: row.currency,
    balance: decimalToFixed(row.balance),
    subtypeDetails:
      row.subtypeDetails && typeof row.subtypeDetails === 'object' && !Array.isArray(row.subtypeDetails)
        ? (row.subtypeDetails as Record<string, unknown>)
        : {},
    color: row.color,
    icon: row.icon,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AccountsRepository {
  public async findAll(familyId: string): Promise<AccountDto[]> {
    const rows = await prisma.account.findMany({
      where: { familyId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapAccount);
  }

  public async findById(familyId: string, accountId: string): Promise<AccountDto | null> {
    const row = await prisma.account.findFirst({
      where: { id: accountId, familyId },
    });
    return row ? mapAccount(row) : null;
  }

  public async create(familyId: string, input: CreateAccountInput): Promise<AccountDto> {
    const row = await prisma.account.create({
      data: {
        familyId,
        name: input.name,
        accountType: input.accountType,
        classification: getClassificationForAccountType(input.accountType),
        currency: input.currency.toUpperCase(),
        balance: toFixedDecimalString(input.initialBalance ?? '0.0000'),
        subtypeDetails: input.subtypeDetails as Prisma.InputJsonValue,
        color: input.color,
        icon: input.icon,
        isActive: true,
      },
    });
    return mapAccount(row);
  }

  public async update(
    familyId: string,
    accountId: string,
    input: UpdateAccountInput
  ): Promise<AccountDto | null> {
    const existing = await prisma.account.findFirst({
      where: { id: accountId, familyId },
    });
    if (!existing) return null;

    const mergedDetails =
      input.subtypeDetails !== undefined
        ? {
            ...(existing.subtypeDetails as Record<string, unknown>),
            ...input.subtypeDetails,
          }
        : undefined;

    const updated = await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(mergedDetails !== undefined
          ? { subtypeDetails: mergedDetails as Prisma.InputJsonValue }
          : {}),
      },
    });
    return mapAccount(updated);
  }

  public async delete(familyId: string, accountId: string): Promise<boolean> {
    const res = await prisma.account.deleteMany({
      where: { id: accountId, familyId },
    });
    return res.count > 0;
  }
}

export const accountsRepository = new AccountsRepository();
