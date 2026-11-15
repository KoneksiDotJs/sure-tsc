import { Router } from 'express';
import {
  CreateCategorySchema,
  CreateMerchantSchema,
  CreateTagSchema,
} from '@sure/shared';
import { prisma } from '../../config/prisma.js';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';

export const taxonomiesRouter: Router = Router();

taxonomiesRouter.use(authenticateMiddleware);

taxonomiesRouter.get(
  '/',
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

taxonomiesRouter.post(
  '/categories',
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

taxonomiesRouter.post(
  '/merchants',
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

taxonomiesRouter.post(
  '/tags',
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
