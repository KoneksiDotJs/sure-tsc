import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { getOpenApiSpec, renderApiDocsHtml } from './docs/openapi.js';
import {
  asyncHandler,
  errorHandlerMiddleware,
  requestIdMiddleware,
} from './middleware/pipeline.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import {
  budgetsRouter,
  goalsRouter,
  recurringRouter,
} from './modules/budgets/budgets.routes.js';
import { entriesRouter } from './modules/entries/entries.routes.js';
import { familyRouter } from './modules/family/family.routes.js';
import { importsRouter } from './modules/imports/imports.routes.js';
import { mcpRouter } from './modules/mcp/mcp.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { rulesRouter } from './modules/rules/rules.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { taxonomiesRouter } from './modules/taxonomies/taxonomies.routes.js';

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

  // Health & Version Metadata
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

  // Self-hosted OpenAPI 3.0.3 Spec & Interactive API Explorer
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(getOpenApiSpec());
  });
  app.get('/api/docs', (_req, res) => {
    res.type('text/html').send(renderApiDocsHtml());
  });

  // API v1 Domain Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/family', familyRouter);
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/entries', entriesRouter);
  app.use('/api/v1/taxonomies', taxonomiesRouter);
  app.use('/api/v1/imports', importsRouter);
  app.use('/api/v1/rules', rulesRouter);
  app.use('/api/v1/budgets', budgetsRouter);
  app.use('/api/v1/goals', goalsRouter);
  app.use('/api/v1/recurring', recurringRouter);
  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/sync', syncRouter);
  app.use('/api/v1/ai', aiRouter);

  // Model Context Protocol (MCP) JSON-RPC 2.0 Server
  app.use('/api/v1/mcp', mcpRouter);
  app.use('/mcp', mcpRouter);

  app.use(errorHandlerMiddleware);
  return app;
}
