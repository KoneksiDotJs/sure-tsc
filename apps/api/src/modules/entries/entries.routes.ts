import { Router } from 'express';
import { z } from 'zod';
import {
  authenticateMiddleware,
  validateRequest,
  asyncHandler,
} from '../../middleware/pipeline.js';
import {
  CreateEntrySchema,
  UpdateEntrySchema,
  SplitTransactionSchema,
  MatchTransferSchema,
  CreateTransferSchema,
  BulkEntryUpdateSchema,
  EntryFilterQuerySchema,
} from './entries.schema.js';
import { entriesController } from './entries.controller.js';

export const entriesRouter: Router = Router();

const IdParamSchema = z.object({ id: z.string().uuid() });

entriesRouter.use(authenticateMiddleware);

entriesRouter.get(
  '/',
  validateRequest({ query: EntryFilterQuerySchema }),
  asyncHandler(entriesController.list.bind(entriesController))
);

entriesRouter.post(
  '/bulk',
  validateRequest({ body: BulkEntryUpdateSchema }),
  asyncHandler(entriesController.bulkAction.bind(entriesController))
);

entriesRouter.get(
  '/transfers/suggestions',
  asyncHandler(entriesController.suggestTransfers.bind(entriesController))
);

entriesRouter.post(
  '/transfers/match',
  validateRequest({ body: MatchTransferSchema }),
  asyncHandler(entriesController.matchTransfer.bind(entriesController))
);

entriesRouter.post(
  '/transfers',
  validateRequest({ body: CreateTransferSchema }),
  asyncHandler(entriesController.createTransfer.bind(entriesController))
);

entriesRouter.get(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(entriesController.getById.bind(entriesController))
);

entriesRouter.post(
  '/',
  validateRequest({ body: CreateEntrySchema }),
  asyncHandler(entriesController.create.bind(entriesController))
);

entriesRouter.patch(
  '/:id',
  validateRequest({ params: IdParamSchema, body: UpdateEntrySchema }),
  asyncHandler(entriesController.update.bind(entriesController))
);

entriesRouter.delete(
  '/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(entriesController.remove.bind(entriesController))
);

entriesRouter.post(
  '/:id/split',
  validateRequest({ params: IdParamSchema, body: SplitTransactionSchema }),
  asyncHandler(entriesController.split.bind(entriesController))
);
