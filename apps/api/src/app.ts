import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import {
  CreateCategorySchema,
  CreateMerchantSchema,
  CreateTagSchema,
  CreateImportPreviewSchema,
  CommitImportSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  UpsertBudgetMonthSchema,
  CreateGoalSchema,
  CreateRecurringSchema,
  CreateProviderConnectionSchema,
  ResolveFinancekitConflictSchema,
  AiChatMessageInputSchema,
  AiConfigUpdateSchema,
  LlmUsageQuerySchema,
  UpdateFamilySettingsSchema,
  InviteFamilyMemberSchema,
} from '@sure/shared';
import {
  requestIdMiddleware,
  authenticateMiddleware,
  validateRequest,
  asyncHandler,
  errorHandlerMiddleware,
  getRouteParam,
} from './middleware/pipeline.js';
import { prisma } from './config/prisma.js';
import { hashPassword } from './config/crypto.js';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { entriesRouter } from './modules/entries/entries.routes.js';
import { importsService } from './modules/imports/imports.service.js';
import { rulesService } from './modules/rules/rules.service.js';
import { budgetsAndGoalsService } from './modules/budgets/budgets.service.js';
import { reportsService } from './modules/reports/reports.service.js';
import { syncService } from './modules/sync/sync.service.js';
import { aiService } from './modules/ai/ai.service.js';
import { mcpRouter } from './modules/mcp/mcp.routes.js';
import { getOpenApiSpec, renderApiDocsHtml } from './docs/openapi.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  // Healthcheck
  app.get('/api/v1/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        data: { status: 'ok', database: 'connected', service: 'sure-api', version: '1.0.0' },
      });
    } catch {
      res.status(503).json({
        error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' },
      });
    }
  });

  // Self-hosted OpenAPI 3.0.3 Spec & Interactive API Explorer
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });

  app.get('/api/docs', (_req, res) => {
    res.type('text/html').send(renderApiDocsHtml());
  });

  // Authentication, MFA & API Keys
  app.use('/api/v1/auth', authRouter);

  // Domain Modules: Accounts & Entries
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/entries', entriesRouter);

  // Family Settings & Multi-Tenancy
  app.get(
    '/api/v1/family',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const [family, memberships] = await Promise.all([
        prisma.family.findUnique({ where: { id: req.auth.familyId } }),
        prisma.familyMembership.findMany({
          where: { familyId: req.auth.familyId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      res.json({
        data: {
          family,
          memberships: memberships.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
          })),
        },
      });
    })
  );

  app.patch(
    '/api/v1/family',
    authenticateMiddleware,
    validateRequest({ body: UpdateFamilySettingsSchema }),
    asyncHandler(async (req, res) => {
      const updated = await prisma.family.update({
        where: { id: req.auth.familyId },
        data: req.body,
      });
      res.json({ data: updated });
    })
  );

  app.post(
    '/api/v1/family/members',
    authenticateMiddleware,
    validateRequest({ body: InviteFamilyMemberSchema }),
    asyncHandler(async (req, res) => {
      const email = req.body.email.trim().toLowerCase();
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: req.body.name.trim(),
            passwordHash: hashPassword('SureMemberInvite2026!'),
          },
        });
      }
      const membership = await prisma.familyMembership.upsert({
        where: {
          familyId_userId: {
            familyId: req.auth.familyId,
            userId: user.id,
          },
        },
        update: { role: req.body.role },
        create: {
          familyId: req.auth.familyId,
          userId: user.id,
          role: req.body.role,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      res.status(201).json({
        data: {
          id: membership.id,
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
        },
      });
    })
  );

  // Full Family Backup Snapshot (JSON export scoped to familyId)
  app.get(
    '/api/v1/family/backup',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const familyId = req.auth.familyId;
      const [family, accounts, entries, categories, merchants, tags, rules, goals, recurring, budgets] =
        await Promise.all([
          prisma.family.findUnique({ where: { id: familyId } }),
          prisma.account.findMany({ where: { familyId } }),
          prisma.entry.findMany({ where: { familyId }, orderBy: { date: 'desc' } }),
          prisma.category.findMany({ where: { familyId } }),
          prisma.merchant.findMany({ where: { familyId } }),
          prisma.tag.findMany({ where: { familyId } }),
          prisma.rule.findMany({ where: { familyId } }),
          prisma.goal.findMany({ where: { familyId } }),
          prisma.recurringTransaction.findMany({ where: { familyId } }),
          prisma.budget.findMany({ where: { familyId }, include: { categories: true } }),
        ]);

      res.json({
        data: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          family,
          accounts,
          entries,
          taxonomies: { categories, merchants, tags },
          rules,
          goals,
          recurring,
          budgets,
        },
      });
    })
  );

  // Taxonomies: Categories, Merchants, Tags
  app.get(
    '/api/v1/taxonomies',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const familyId = req.auth.familyId;
      const [categories, merchants, tags] = await Promise.all([
        prisma.category.findMany({ where: { familyId }, orderBy: { name: 'asc' } }),
        prisma.merchant.findMany({ where: { familyId }, orderBy: { name: 'asc' } }),
        prisma.tag.findMany({ where: { familyId }, orderBy: { name: 'asc' } }),
      ]);
      res.json({ data: { categories, merchants, tags } });
    })
  );

  app.post(
    '/api/v1/taxonomies/categories',
    authenticateMiddleware,
    validateRequest({ body: CreateCategorySchema }),
    asyncHandler(async (req, res) => {
      const cat = await prisma.category.create({
        data: {
          familyId: req.auth.familyId,
          name: req.body.name,
          classification: req.body.classification,
          color: req.body.color,
          icon: req.body.icon,
          parentId: req.body.parentId ?? null,
        },
      });
      res.status(201).json({ data: cat });
    })
  );

  app.post(
    '/api/v1/taxonomies/merchants',
    authenticateMiddleware,
    validateRequest({ body: CreateMerchantSchema }),
    asyncHandler(async (req, res) => {
      const merch = await prisma.merchant.create({
        data: {
          familyId: req.auth.familyId,
          name: req.body.name,
          color: req.body.color,
          icon: req.body.icon,
          website: req.body.website ?? null,
          defaultCategoryId: req.body.defaultCategoryId ?? null,
        },
      });
      res.status(201).json({ data: merch });
    })
  );

  app.post(
    '/api/v1/taxonomies/tags',
    authenticateMiddleware,
    validateRequest({ body: CreateTagSchema }),
    asyncHandler(async (req, res) => {
      const tag = await prisma.tag.create({
        data: {
          familyId: req.auth.familyId,
          name: req.body.name,
          color: req.body.color,
        },
      });
      res.status(201).json({ data: tag });
    })
  );

  // FR-3.1 Imports (CSV, QIF, PDF & RevertImport)
  app.get(
    '/api/v1/imports',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const list = await importsService.listImports(req.auth.familyId);
      res.json({ data: list });
    })
  );

  app.post(
    '/api/v1/imports/preview',
    authenticateMiddleware,
    validateRequest({ body: CreateImportPreviewSchema }),
    asyncHandler(async (req, res) => {
      const preview = await importsService.parseAndStagePreview(req.auth.familyId, req.body);
      res.status(201).json({ data: preview });
    })
  );

  app.post(
    '/api/v1/imports/commit',
    authenticateMiddleware,
    validateRequest({ body: CommitImportSchema }),
    asyncHandler(async (req, res) => {
      const batch = await importsService.commitImport(req.auth.familyId, req.body);
      res.json({ data: batch });
    })
  );

  app.post(
    '/api/v1/imports/:id/revert',
    authenticateMiddleware,
    validateRequest({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      const reverted = await importsService.revertImport(
        req.auth.familyId,
        getRouteParam(req, 'id')
      );
      res.json({ data: reverted });
    })
  );

  // FR-3.2 Rule Engine & Dry-Run Preview
  app.get(
    '/api/v1/rules',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const rules = await rulesService.listRules(req.auth.familyId);
      res.json({ data: rules });
    })
  );

  app.post(
    '/api/v1/rules',
    authenticateMiddleware,
    validateRequest({ body: CreateRuleSchema }),
    asyncHandler(async (req, res) => {
      const created = await rulesService.createRule(req.auth.familyId, req.body);
      res.status(201).json({ data: created });
    })
  );

  app.delete(
    '/api/v1/rules/:id',
    authenticateMiddleware,
    validateRequest({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      await rulesService.deleteRule(req.auth.familyId, getRouteParam(req, 'id'));
      res.status(204).send();
    })
  );

  app.patch(
    '/api/v1/rules/:id',
    authenticateMiddleware,
    validateRequest({ params: z.object({ id: z.string().uuid() }), body: UpdateRuleSchema }),
    asyncHandler(async (req, res) => {
      const updated = await rulesService.updateRule(
        req.auth.familyId,
        getRouteParam(req, 'id'),
        req.body
      );
      res.json({ data: updated });
    })
  );

  app.post(
    '/api/v1/rules/dry-run',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const preview = await rulesService.dryRunRule(req.auth.familyId, req.body);
      res.json({ data: preview });
    })
  );

  app.post(
    '/api/v1/rules/execute',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const result = await rulesService.executeActiveRulesOnFamily(req.auth.familyId);
      res.json({ data: result });
    })
  );

  // FR-4 Budgets, Goals & Recurring Bills
  app.get(
    '/api/v1/budgets/:month',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const data = await budgetsAndGoalsService.getBudgetForMonth(
        req.auth.familyId,
        getRouteParam(req, 'month')
      );
      res.json({ data });
    })
  );

  app.put(
    '/api/v1/budgets',
    authenticateMiddleware,
    validateRequest({ body: UpsertBudgetMonthSchema }),
    asyncHandler(async (req, res) => {
      const saved = await budgetsAndGoalsService.upsertBudgetMonth(
        req.auth.familyId,
        req.body
      );
      res.json({ data: saved });
    })
  );

  app.get(
    '/api/v1/goals',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const goals = await budgetsAndGoalsService.listGoals(req.auth.familyId);
      res.json({ data: goals });
    })
  );

  app.post(
    '/api/v1/goals',
    authenticateMiddleware,
    validateRequest({ body: CreateGoalSchema }),
    asyncHandler(async (req, res) => {
      const goal = await budgetsAndGoalsService.createGoal(req.auth.familyId, req.body);
      res.status(201).json({ data: goal });
    })
  );

  app.delete(
    '/api/v1/goals/:id',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      await budgetsAndGoalsService.deleteGoal(req.auth.familyId, getRouteParam(req, 'id'));
      res.status(204).send();
    })
  );

  app.get(
    '/api/v1/version',
    asyncHandler(async (_req, res) => {
      res.json({
        data: {
          version: '1.0.0',
          commit_sha: process.env.COMMIT_SHA ?? null,
        },
      });
    })
  );

  app.get(
    '/api/v1/recurring',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const items = await budgetsAndGoalsService.listRecurring(req.auth.familyId);
      res.json({ data: items });
    })
  );

  app.post(
    '/api/v1/recurring',
    authenticateMiddleware,
    validateRequest({ body: CreateRecurringSchema }),
    asyncHandler(async (req, res) => {
      const created = await budgetsAndGoalsService.createRecurring(req.auth.familyId, req.body);
      res.status(201).json({ data: created });
    })
  );

  app.post(
    '/api/v1/recurring/:id/mark-paid',
    authenticateMiddleware,
    validateRequest({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      const paid = await budgetsAndGoalsService.markRecurringPaid(
        req.auth.familyId,
        getRouteParam(req, 'id'),
        req.body?.paidDate
      );
      res.status(201).json({ data: paid });
    })
  );

  app.delete(
    '/api/v1/recurring/:id',
    authenticateMiddleware,
    validateRequest({ params: z.object({ id: z.string().uuid() }) }),
    asyncHandler(async (req, res) => {
      await budgetsAndGoalsService.deleteRecurring(req.auth.familyId, getRouteParam(req, 'id'));
      res.status(204).send();
    })
  );

  // FR-5 Financial Reports (Balance Sheet, Income Statement, Cash Flow Sankey)
  app.get(
    '/api/v1/reports',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const report = await reportsService.getFinancialReport(req.auth.familyId);
      res.json({ data: report });
    })
  );

  // FR-6 Sync & FinanceKit Conflict Resolution
  app.get(
    '/api/v1/sync',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const overview = await syncService.getSyncOverview(req.auth.familyId);
      res.json({ data: overview });
    })
  );

  app.post(
    '/api/v1/sync/conflicts/resolve',
    authenticateMiddleware,
    validateRequest({ body: ResolveFinancekitConflictSchema }),
    asyncHandler(async (req, res) => {
      const resolved = await syncService.resolveConflict(req.auth.familyId, req.body);
      res.json({ data: resolved });
    })
  );

  app.post(
    '/api/v1/sync/connections',
    authenticateMiddleware,
    validateRequest({ body: CreateProviderConnectionSchema }),
    asyncHandler(async (req, res) => {
      const conn = await syncService.createConnection(req.auth.familyId, req.body);
      res.status(201).json({ data: conn });
    })
  );

  app.post(
    '/api/v1/sync/run',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const result = await syncService.runSyncAll(req.auth.familyId);
      await aiService.generateProactiveInsights(req.auth.familyId);
      res.json({ data: result });
    })
  );

  // Model Context Protocol (MCP) JSON-RPC 2.0 Server
  app.use('/api/v1/mcp', mcpRouter);
  app.use('/mcp', mcpRouter);

  // FR-7 AI Assistant, Naive Bayes Categorizer & Proactive Insights
  app.get(
    '/api/v1/ai/insights',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const insights = await aiService.listInsights(req.auth.familyId);
      res.json({ data: insights });
    })
  );

  app.post(
    '/api/v1/ai/categorize',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as {
        provider?: 'auto' | 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'bayes';
        model?: string;
        systemPrompt?: string;
      };
      const result = await aiService.autoCategorizeUncategorized(req.auth.familyId, body);
      res.json({ data: result });
    })
  );

  app.get(
    '/api/v1/ai/models',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
      const parsed = AiConfigUpdateSchema.partial().safeParse(
        provider ? { provider } : {}
      );
      const data = await aiService.listAiModels(
        req.auth.familyId,
        parsed.success ? parsed.data : undefined
      );
      res.json({ data });
    })
  );

  app.post(
    '/api/v1/ai/models',
    authenticateMiddleware,
    validateRequest({ body: AiConfigUpdateSchema.partial().optional() }),
    asyncHandler(async (req, res) => {
      const data = await aiService.listAiModels(req.auth.familyId, req.body);
      res.json({ data });
    })
  );

  app.get(
    '/api/v1/ai/usage',
    authenticateMiddleware,
    validateRequest({ query: LlmUsageQuerySchema }),
    asyncHandler(async (req, res) => {
      const report = await aiService.getLlmUsage(req.auth.familyId, req.query);
      res.json({ data: report });
    })
  );

  app.get(
    '/api/v1/ai/config',
    authenticateMiddleware,
    asyncHandler(async (req, res) => {
      const cfg = aiService.getAiConfig(req.auth.familyId);
      res.json({ data: cfg });
    })
  );

  app.put(
    '/api/v1/ai/config',
    authenticateMiddleware,
    validateRequest({ body: AiConfigUpdateSchema }),
    asyncHandler(async (req, res) => {
      const cfg = aiService.updateAiConfig(req.auth.familyId, req.body);
      res.json({ data: cfg });
    })
  );

  app.post(
    '/api/v1/ai/test',
    authenticateMiddleware,
    validateRequest({ body: AiConfigUpdateSchema.partial().optional() }),
    asyncHandler(async (req, res) => {
      const result = await aiService.testAiConnection(req.auth.familyId, req.body);
      res.json({ data: result });
    })
  );

  app.post(
    '/api/v1/ai/chat',
    authenticateMiddleware,
    validateRequest({ body: AiChatMessageInputSchema }),
    asyncHandler(async (req, res) => {
      const chat = await aiService.sendChatMessage(
        req.auth.familyId,
        req.auth.userId,
        req.body.prompt,
        req.body.systemPrompt
      );
      res.status(201).json({ data: chat });
    })
  );

  app.use(errorHandlerMiddleware);
  return app;
}
