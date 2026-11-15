import { Router } from 'express';
import { InviteFamilyMemberSchema, UpdateFamilySettingsSchema } from '@sure/shared';
import { hashPassword } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';

export const familyRouter: Router = Router();

familyRouter.use(authenticateMiddleware);

familyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const [family, memberships] = await Promise.all([
      prisma.family.findUnique({ where: { id: req.auth.familyId } }),
      prisma.familyMembership.findMany({
        where: { familyId: req.auth.familyId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    res.json({
      data: {
        family,
        memberships: memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
      },
    });
  })
);

familyRouter.patch(
  '/',
  validateRequest({ body: UpdateFamilySettingsSchema }),
  asyncHandler(async (req, res) => {
    const updated = await prisma.family.update({
      where: { id: req.auth.familyId },
      data: req.body,
    });
    res.json({ data: updated });
  })
);

familyRouter.post(
  '/members',
  validateRequest({ body: InviteFamilyMemberSchema }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: req.body.name.trim(),
          passwordHash: hashPassword('SureMemberInvite2026!'),
        },
      });
    }
    const membership = await prisma.familyMembership.upsert({
      where: {
        familyId_userId: {
          familyId: req.auth.familyId,
          userId: user.id,
        },
      },
      update: { role: req.body.role },
      create: {
        familyId: req.auth.familyId,
        userId: user.id,
        role: req.body.role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json({
      data: {
        id: membership.id,
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
      },
    });
  })
);

familyRouter.get(
  '/backup',
  asyncHandler(async (req, res) => {
    const familyId = req.auth.familyId;
    const [family, accounts, entries, categories, merchants, tags, rules, goals, recurring, budgets] =
      await Promise.all([
        prisma.family.findUnique({ where: { id: familyId } }),
        prisma.account.findMany({ where: { familyId } }),
        prisma.entry.findMany({ where: { familyId }, orderBy: { date: 'desc' } }),
        prisma.category.findMany({ where: { familyId } }),
        prisma.merchant.findMany({ where: { familyId } }),
        prisma.tag.findMany({ where: { familyId } }),
        prisma.rule.findMany({ where: { familyId } }),
        prisma.goal.findMany({ where: { familyId } }),
        prisma.recurringTransaction.findMany({ where: { familyId } }),
        prisma.budget.findMany({ where: { familyId }, include: { categories: true } }),
      ]);

    res.json({
      data: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        family,
        accounts,
        entries,
        taxonomies: { categories, merchants, tags },
        rules,
        goals,
        recurring,
        budgets,
      },
    });
  })
);
