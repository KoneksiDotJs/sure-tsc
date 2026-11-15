import { Router } from 'express';
import { asyncHandler, authenticateMiddleware } from '../../middleware/pipeline.js';
import { reportsService } from './reports.service.js';

export const reportsRouter: Router = Router();

reportsRouter.use(authenticateMiddleware);

reportsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const report = await reportsService.getFinancialReport(req.auth.familyId);
    res.json({ data: report });
  })
);
