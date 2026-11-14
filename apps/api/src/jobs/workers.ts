import { syncService } from '../modules/sync/sync.service.js';
import { rulesService } from '../modules/rules/rules.service.js';
import { importsService } from '../modules/imports/imports.service.js';
import { aiService } from '../modules/ai/ai.service.js';
import { logger } from '../config/logger.js';

export type BullQueueName =
  | 'sync-provider-item'
  | 'apply-rules-batch'
  | 'process-pdf-statement'
  | 'generate-insights';

/**
 * Background Jobs (`BullMQ + Redis` processors per 02-backend-express-api.md Section 5)
 * Every background job strictly enforces `familyId` tenant scoping.
 */
export const jobProcessors = {
  async 'sync-provider-item'(payload: {
    familyId: string;
    accountId: string;
    items: Array<{
      externalId: string;
      date: string;
      name: string;
      amount: string;
      currency: string;
    }>;
  }) {
    logger.info('Executing sync-provider-item job', {
      familyId: payload.familyId,
      accountId: payload.accountId,
    });
    return syncService.ingestExternalTransactions(
      payload.familyId,
      payload.accountId,
      payload.items
    );
  },

  async 'apply-rules-batch'(payload: { familyId: string }) {
    logger.info('Executing apply-rules-batch job', { familyId: payload.familyId });
    return rulesService.executeActiveRulesOnFamily(payload.familyId);
  },

  async 'process-pdf-statement'(payload: {
    familyId: string;
    accountId: string;
    fileName: string;
    rawContent: string;
  }) {
    logger.info('Executing process-pdf-statement job', {
      familyId: payload.familyId,
      accountId: payload.accountId,
    });
    return importsService.parseAndStagePreview(payload.familyId, {
      accountId: payload.accountId,
      format: 'PDF',
      fileName: payload.fileName,
      rawContent: payload.rawContent,
    });
  },

  async 'generate-insights'(payload: { familyId: string }) {
    logger.info('Executing generate-insights job', { familyId: payload.familyId });
    return aiService.generateProactiveInsights(payload.familyId);
  },
};
