import { Router } from 'express';
import { z } from 'zod';
import {
  AddWatchlistTickerSchema,
  CreateProviderConnectionSchema,
  MarketHistoryQuerySchema,
  ResolveFinancekitConflictSchema,
  UpdateProviderConnectionSchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';
import { aiService } from '../ai/ai.service.js';
import { syncService } from './sync.service.js';

export const syncRouter: Router = Router();

const IdParamSchema = z.object({ id: z.string().uuid() });

syncRouter.use(authenticateMiddleware);

syncRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const overview = await syncService.getSyncOverview(req.auth.familyId);
    res.json({ data: overview });
  })
);

syncRouter.post(
  '/conflicts/resolve',
  validateRequest({ body: ResolveFinancekitConflictSchema }),
  asyncHandler(async (req, res) => {
    const resolved = await syncService.resolveConflict(req.auth.familyId, req.body);
    res.json({ data: resolved });
  })
);

syncRouter.post(
  '/connections',
  validateRequest({ body: CreateProviderConnectionSchema }),
  asyncHandler(async (req, res) => {
    const conn = await syncService.createConnection(req.auth.familyId, req.body);
    res.status(201).json({ data: conn });
  })
);

syncRouter.patch(
  '/connections/:id',
  validateRequest({ params: IdParamSchema, body: UpdateProviderConnectionSchema }),
  asyncHandler(async (req, res) => {
    const conn = await syncService.updateConnection(
      req.auth.familyId,
      String(req.params.id),
      req.body
    );
    res.json({ data: conn });
  })
);

syncRouter.delete(
  '/connections/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await syncService.deleteConnection(req.auth.familyId, String(req.params.id));
    res.json({ data: result });
  })
);

syncRouter.post(
  '/connections/:id/sync',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await syncService.runConnectionSync(req.auth.familyId, String(req.params.id));
    res.json({ data: result });
  })
);

syncRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const result = await syncService.runSyncAll(req.auth.familyId);
    await aiService.generateProactiveInsights(req.auth.familyId);
    res.json({ data: result });
  })
);

syncRouter.get(
  '/markets/history',
  validateRequest({ query: MarketHistoryQuerySchema }),
  asyncHandler(async (req, res) => {
    const parsed = MarketHistoryQuerySchema.parse(req.query);
    const history = await syncService.getMarketHistory(parsed);
    res.json({ data: history });
  })
);

syncRouter.post(
  '/watchlist',
  validateRequest({ body: AddWatchlistTickerSchema }),
  asyncHandler(async (req, res) => {
    const added = await syncService.addWatchlistTicker(req.auth.familyId, req.body.ticker);
    res.status(201).json({ data: added });
  })
);
