import { Router } from 'express';
import { z } from 'zod';
import { CreateRuleSchema, UpdateRuleSchema } from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  getRouteParam,
  validateRequest,
} from '../../middleware/pipeline.js';
import { rulesService } from './rules.service.js';

export const rulesRouter: Router = Router();

rulesRouter.use(authenticateMiddleware);

rulesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rules = await rulesService.listRules(req.auth.familyId);
    res.json({ data: rules });
  })
);

rulesRouter.post(
  '/',
  validateRequest({ body: CreateRuleSchema }),
  asyncHandler(async (req, res) => {
    const created = await rulesService.createRule(req.auth.familyId, req.body);
    res.status(201).json({ data: created });
  })
);

rulesRouter.delete(
  '/:id',
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await rulesService.deleteRule(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  })
);

rulesRouter.patch(
  '/:id',
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

rulesRouter.post(
  '/dry-run',
  asyncHandler(async (req, res) => {
    const preview = await rulesService.dryRunRule(req.auth.familyId, req.body);
    res.json({ data: preview });
  })
);

rulesRouter.post(
  '/execute',
  asyncHandler(async (req, res) => {
    const result = await rulesService.executeActiveRulesOnFamily(req.auth.familyId);
    res.json({ data: result });
  })
);
