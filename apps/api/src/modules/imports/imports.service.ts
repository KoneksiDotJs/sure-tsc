import { Prisma } from '@prisma/client';
import {
  CommitImportSchema,
  CreateImportPreviewSchema,
  negateMoney,
  toFixedDecimalString,
} from '@sure/shared';
import { z } from 'zod';
import { decimalToFixed, parseIsoDate, prisma, toIsoDate } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { BalanceService } from '../balances/balance.service.js';
import { RulesService, rulesService } from '../rules/rules.service.js';

/**
 * FR-3.1 Guided Import Wizard:
 * 4-step workflow (Upload -> Column Mapping -> Clean/Preflight Review -> Confirm)
 * supporting CSV, QIF, and PDF Bank Statements + full import rollback (`RevertImport`).
 */
export class ImportsService {
  public async listImports(familyId: string) {
    const rows = await prisma.import.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      revertedAt: r.revertedAt ? r.revertedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public async parseAndStagePreview(
    familyId: string,
    input: z.infer<typeof CreateImportPreviewSchema>
  ) {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, familyId },
    });
    if (!account) {
      throw new AppError('NOT_FOUND', 'Target account not found');
    }

    const existingEntries = await prisma.entry.findMany({
      where: { familyId, accountId: account.id },
      select: { date: true, amount: true, name: true },
    });

    const parsedRows: Array<{
      date: string;
      name: string;
      amount: string;
      categoryName?: string;
      merchantName?: string;
      notes?: string;
      duplicateWarning: boolean;
    }> = [];

    if (input.format === 'CSV') {
      const lines = input.rawContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new AppError(
          'VALIDATION_ERROR',
          'CSV file must contain a header and at least one row'
        );
      }

      const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const dateCol = input.columnMapping?.dateColumn ?? headers[0] ?? 'date';
      const nameCol = input.columnMapping?.nameColumn ?? headers[1] ?? 'name';
      const amountCol = input.columnMapping?.amountColumn ?? headers[2] ?? 'amount';
      const catCol = input.columnMapping?.categoryColumn;
      const merchCol = input.columnMapping?.merchantColumn;

      const dateIdx = Math.max(0, headers.indexOf(dateCol));
      const nameIdx = Math.max(1, headers.indexOf(nameCol));
      const amountIdx = Math.max(2, headers.indexOf(amountCol));
      const catIdx = catCol ? headers.indexOf(catCol) : -1;
      const merchIdx = merchCol ? headers.indexOf(merchCol) : -1;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const rawDate = cols[dateIdx] ?? new Date().toISOString().slice(0, 10);
        const rawName = cols[nameIdx] ?? 'Imported Transaction';
        let amt = toFixedDecimalString(cols[amountIdx] ?? '0.0000');
        if (input.columnMapping?.invertSign) {
          amt = negateMoney(amt);
        }

        const isDuplicate = existingEntries.some(
          (e) =>
            toIsoDate(e.date) === rawDate &&
            decimalToFixed(e.amount) === amt &&
            e.name.toLowerCase() === rawName.toLowerCase()
        );

        parsedRows.push({
          date: rawDate,
          name: rawName,
          amount: amt,
          categoryName: catIdx >= 0 ? cols[catIdx] : undefined,
          merchantName: merchIdx >= 0 ? cols[merchIdx] : undefined,
          duplicateWarning: isDuplicate,
        });
      }
    } else if (input.format === 'QIF') {
      const blocks = input.rawContent.split('^').map((b) => b.trim()).filter(Boolean);
      for (const block of blocks) {
        const lines = block.split(/\r?\n/);
        let date = new Date().toISOString().slice(0, 10);
        let name = 'QIF Transaction';
        let amount = '0.0000';
        for (const line of lines) {
          if (line.startsWith('D')) date = line.slice(1).trim().slice(0, 10);
          if (line.startsWith('P')) name = line.slice(1).trim();
          if (line.startsWith('T')) amount = toFixedDecimalString(line.slice(1).trim());
        }
        parsedRows.push({ date, name, amount, duplicateWarning: false });
      }
    } else if (input.format === 'OFX') {
      const blocks = input.rawContent.split(/<STMTTRN>/i).slice(1);
      for (const block of blocks) {
        const dtMatch = block.match(/<DTPOSTED>\s*(\d{4})(\d{2})(\d{2})/i);
        const amtMatch = block.match(/<TRNAMT>\s*(-?\d+(?:\.\d+)?)/i);
        const nameMatch = block.match(/<NAME>\s*([^\r\n<]+)/i) ?? block.match(/<MEMO>\s*([^\r\n<]+)/i);
        if (amtMatch && amtMatch[1]) {
          const date =
            dtMatch && dtMatch[1] && dtMatch[2] && dtMatch[3]
              ? `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`
              : new Date().toISOString().slice(0, 10);
          const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'OFX Transaction';
          const amount = toFixedDecimalString(amtMatch[1]);
          const isDuplicate = existingEntries.some(
            (e) =>
              toIsoDate(e.date) === date &&
              decimalToFixed(e.amount) === amount &&
              e.name.toLowerCase() === name.toLowerCase()
          );
          parsedRows.push({ date, name, amount, duplicateWarning: isDuplicate });
        }
      }
    } else {
      const lines = input.rawContent.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\d+(?:\.\d{1,4})?)$/);
        if (match && match[1] && match[2] && match[3]) {
          parsedRows.push({
            date: match[1],
            name: match[2].trim(),
            amount: toFixedDecimalString(match[3]),
            duplicateWarning: false,
          });
        }
      }
    }

    const persistedFormat = input.format === 'OFX' ? 'QIF' : input.format;
    const importBatch = await prisma.import.create({
      data: {
        familyId,
        accountId: account.id,
        format: persistedFormat,
        fileName: input.fileName,
        status: 'PENDING',
        rowCount: parsedRows.length,
        columnMapping: {
          ...(input.columnMapping ?? {}),
          sourceFormat: input.format,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      importBatch: {
        ...importBatch,
        revertedAt: null,
        createdAt: importBatch.createdAt.toISOString(),
      },
      previewRows: parsedRows,
    };
  }

  public async commitImport(familyId: string, input: z.infer<typeof CommitImportSchema>) {
    const batch = await prisma.import.findFirst({
      where: { id: input.importId, familyId },
    });
    if (!batch) {
      throw new AppError('NOT_FOUND', 'Import batch not found');
    }

    const account = await prisma.account.findFirst({
      where: { id: batch.accountId, familyId },
    });
    if (!account) {
      throw new AppError('NOT_FOUND', 'Account not found');
    }

    const activeRows = input.rows.filter((r) => !r.skip);
    const createdEntryIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of activeRows) {
        const created = await tx.entry.create({
          data: {
            accountId: account.id,
            familyId,
            entryType: 'TRANSACTION',
            date: parseIsoDate(row.date),
            amount: toFixedDecimalString(row.amount),
            currency: account.currency,
            name: row.name,
            notes: row.notes ?? null,
            excluded: false,
            importId: batch.id,
            transaction: {
              create: {},
            },
          },
        });
        createdEntryIds.push(created.id);
      }

      await tx.import.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          rowCount: activeRows.length,
        },
      });
    });

    // Apply active family rules to newly committed imported transactions (Sure Import#confirm parity)
    if (createdEntryIds.length > 0) {
      const activeRules = (await rulesService.listRules(familyId)).filter((r) => r.isActive);
      if (activeRules.length > 0) {
        const importedEntries = await prisma.entry.findMany({
          where: { id: { in: createdEntryIds }, familyId },
        });
        for (const entry of importedEntries) {
          for (const rule of activeRules) {
            if (
              RulesService.doesRuleMatch(
                {
                  id: entry.id,
                  accountId: entry.accountId,
                  familyId: entry.familyId,
                  amount: decimalToFixed(entry.amount),
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
      }
    }

    await BalanceService.materializeAccount(familyId, account.id);
    const updated = await prisma.import.findUnique({ where: { id: batch.id } });
    return {
      ...updated!,
      revertedAt: updated!.revertedAt ? updated!.revertedAt.toISOString() : null,
      createdAt: updated!.createdAt.toISOString(),
    };
  }

  /**
   * RevertImport (FR-3.1): Full import rollback that deletes all entries created by the batch
   * and recalculates account balances.
   */
  public async revertImport(familyId: string, importId: string) {
    const batch = await prisma.import.findFirst({
      where: { id: importId, familyId },
    });
    if (!batch) {
      throw new AppError('NOT_FOUND', 'Import batch not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.entry.deleteMany({
        where: { familyId, importId },
      });

      await tx.import.update({
        where: { id: importId },
        data: {
          status: 'REVERTED',
          revertedAt: new Date(),
        },
      });
    });

    await BalanceService.materializeAccount(familyId, batch.accountId);
    const updated = await prisma.import.findUnique({ where: { id: importId } });
    return {
      ...updated!,
      revertedAt: updated!.revertedAt ? updated!.revertedAt.toISOString() : null,
      createdAt: updated!.createdAt.toISOString(),
    };
  }
}

export const importsService = new ImportsService();
