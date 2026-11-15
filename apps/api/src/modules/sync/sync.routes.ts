import { Router } from 'express';
import {
  CreateProviderConnectionSchema,
  ResolveFinancekitConflictSchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';
import { aiService } from '../ai/ai.service.js';
import { syncService } from './sync.service.js';

export const syncRouter: Router = Router();

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

syncRouter.post(
  '/run',
  asyncHandler(async (req, res) => {
    const result = await syncService.runSyncAll(req.auth.familyId);
    await aiService.generateProactiveInsights(req.auth.familyId);
    res.json({ data: result });
  })
);
