import { Router } from 'express';
import { z } from 'zod';
import {
  authenticateMiddleware,
  validateRequest,
  asyncHandler,
} from '../../middleware/pipeline.js';
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  LoanSimulationInputSchema,
} from './accounts.schema.js';
import { UpsertHoldingSchema } from '@sure/shared';
import { accountsController } from './accounts.controller.js';

export const accountsRouter: Router = Router();

const IdParamSchema = z.object({ id: z.string().uuid() });

accountsRouter.use(authenticateMiddleware);

accountsRouter.get('/', asyncHandler(accountsController.list.bind(accountsController)));

accountsRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(accountsController.getById.bind(accountsController))
);

accountsRouter.post(
  '/',
  validateRequest({ body: CreateAccountSchema }),
  asyncHandler(accountsController.create.bind(accountsController))
);

accountsRouter.patch(
  '/:id',
  validateRequest({ params: IdParamSchema, body: UpdateAccountSchema }),
  asyncHandler(accountsController.update.bind(accountsController))
);

accountsRouter.delete(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(accountsController.remove.bind(accountsController))
);

accountsRouter.post(
  '/:id/loan-simulation',
  validateRequest({ params: IdParamSchema, body: LoanSimulationInputSchema }),
  asyncHandler(accountsController.simulateLoan.bind(accountsController))
);

accountsRouter.get(
  '/:id/holdings',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(accountsController.getHoldings.bind(accountsController))
);

accountsRouter.post(
  '/:id/holdings',
  validateRequest({ params: IdParamSchema, body: UpsertHoldingSchema }),
  asyncHandler(accountsController.upsertHolding.bind(accountsController))
);
