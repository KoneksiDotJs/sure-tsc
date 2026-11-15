import { Router } from 'express';
import { z } from 'zod';
import { CommitImportSchema, CreateImportPreviewSchema } from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  getRouteParam,
  validateRequest,
} from '../../middleware/pipeline.js';
import { importsService } from './imports.service.js';

export const importsRouter: Router = Router();

importsRouter.use(authenticateMiddleware);

importsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await importsService.listImports(req.auth.familyId);
    res.json({ data: list });
  })
);

importsRouter.post(
  '/preview',
  validateRequest({ body: CreateImportPreviewSchema }),
  asyncHandler(async (req, res) => {
    const preview = await importsService.parseAndStagePreview(req.auth.familyId, req.body);
    res.status(201).json({ data: preview });
  })
);

importsRouter.post(
  '/commit',
  validateRequest({ body: CommitImportSchema }),
  asyncHandler(async (req, res) => {
    const batch = await importsService.commitImport(req.auth.familyId, req.body);
    res.json({ data: batch });
  })
);

importsRouter.post(
  '/:id/revert',
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const reverted = await importsService.revertImport(
      req.auth.familyId,
      getRouteParam(req, 'id')
    );
    res.json({ data: reverted });
  })
);
