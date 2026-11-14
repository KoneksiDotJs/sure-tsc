import { PrismaClient, Prisma } from '@prisma/client';
import { toFixedDecimalString } from '@sure/shared';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function toIsoDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function decimalToFixed(
  val: Prisma.Decimal | string | null | undefined,
  scale = 4
): string {
  if (val === null || val === undefined) {
    return toFixedDecimalString('0', scale);
  }
  return toFixedDecimalString(typeof val === 'string' ? val : val.toString(), scale);
}

const DEFAULT_FX_RATES: Record<string, string> = {
  'USD:USD': '1.0000',
  'EUR:USD': '1.0850',
  'USD:EUR': '0.9217',
  'GBP:USD': '1.2750',
  'USD:GBP': '0.7843',
  'CAD:USD': '0.7400',
  'USD:CAD': '1.3514',
};

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<string> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return '1.0000';

  const latest = await prisma.exchangeRate.findFirst({
    where: { baseCurrency: from, targetCurrency: to },
    orderBy: { date: 'desc' },
  });
  if (latest) {
    return latest.rate.toString();
  }
  return DEFAULT_FX_RATES[`${from}:${to}`] ?? '1.0000';
}
