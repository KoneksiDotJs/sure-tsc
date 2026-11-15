import { Router } from 'express';
import { z } from 'zod';
import {
  CreateGoalSchema,
  CreateRecurringSchema,
  UpsertBudgetMonthSchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  getRouteParam,
  validateRequest,
} from '../../middleware/pipeline.js';
import { budgetsAndGoalsService } from './budgets.service.js';

export const budgetsRouter: Router = Router();
budgetsRouter.use(authenticateMiddleware);

budgetsRouter.get(
  '/:month',
  asyncHandler(async (req, res) => {
    const data = await budgetsAndGoalsService.getBudgetForMonth(
      req.auth.familyId,
      getRouteParam(req, 'month')
    );
    res.json({ data });
  })
);

budgetsRouter.put(
  '/',
  validateRequest({ body: UpsertBudgetMonthSchema }),
  asyncHandler(async (req, res) => {
    const saved = await budgetsAndGoalsService.upsertBudgetMonth(req.auth.familyId, req.body);
    res.json({ data: saved });
  })
);

export const goalsRouter: Router = Router();
goalsRouter.use(authenticateMiddleware);

goalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const goals = await budgetsAndGoalsService.listGoals(req.auth.familyId);
    res.json({ data: goals });
  })
);

goalsRouter.post(
  '/',
  validateRequest({ body: CreateGoalSchema }),
  asyncHandler(async (req, res) => {
    const goal = await budgetsAndGoalsService.createGoal(req.auth.familyId, req.body);
    res.status(201).json({ data: goal });
  })
);

goalsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await budgetsAndGoalsService.deleteGoal(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  })
);

export const recurringRouter: Router = Router();
recurringRouter.use(authenticateMiddleware);

recurringRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await budgetsAndGoalsService.listRecurring(req.auth.familyId);
    res.json({ data: items });
  })
);

recurringRouter.post(
  '/',
  validateRequest({ body: CreateRecurringSchema }),
  asyncHandler(async (req, res) => {
    const created = await budgetsAndGoalsService.createRecurring(req.auth.familyId, req.body);
    res.status(201).json({ data: created });
  })
);

recurringRouter.post(
  '/:id/mark-paid',
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

recurringRouter.delete(
  '/:id',
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    await budgetsAndGoalsService.deleteRecurring(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  })
);
