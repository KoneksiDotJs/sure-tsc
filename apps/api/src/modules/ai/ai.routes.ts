import { Router } from 'express';
import { z } from 'zod';
import {
  AiChatExportQuerySchema,
  AiChatMessageInputSchema,
  AiConfigUpdateSchema,
  LlmUsageQuerySchema,
  UpdateAiChatSchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';
import { aiService } from './ai.service.js';

export const aiRouter: Router = Router();
const IdParamSchema = z.object({ id: z.string().uuid() });

aiRouter.use(authenticateMiddleware);

aiRouter.get(
  '/insights',
  asyncHandler(async (req, res) => {
    const insights = await aiService.listInsights(req.auth.familyId);
    res.json({ data: insights });
  })
);

aiRouter.post(
  '/categorize',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      provider?: 'auto' | 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'bayes';
      model?: string;
      systemPrompt?: string;
    };
    const result = await aiService.autoCategorizeUncategorized(req.auth.familyId, body);
    res.json({ data: result });
  })
);

aiRouter.get(
  '/models',
  asyncHandler(async (req, res) => {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
    const parsed = AiConfigUpdateSchema.partial().safeParse(provider ? { provider } : {});
    const data = await aiService.listAiModels(
      req.auth.familyId,
      parsed.success ? parsed.data : undefined
    );
    res.json({ data });
  })
);

aiRouter.post(
  '/models',
  validateRequest({ body: AiConfigUpdateSchema.partial().optional() }),
  asyncHandler(async (req, res) => {
    const data = await aiService.listAiModels(req.auth.familyId, req.body);
    res.json({ data });
  })
);

aiRouter.get(
  '/usage',
  validateRequest({ query: LlmUsageQuerySchema }),
  asyncHandler(async (req, res) => {
    const report = await aiService.getLlmUsage(req.auth.familyId, req.query);
    res.json({ data: report });
  })
);

aiRouter.get(
  '/config',
  asyncHandler(async (req, res) => {
    const cfg = aiService.getAiConfig(req.auth.familyId);
    res.json({ data: cfg });
  })
);

aiRouter.put(
  '/config',
  validateRequest({ body: AiConfigUpdateSchema }),
  asyncHandler(async (req, res) => {
    const cfg = aiService.updateAiConfig(req.auth.familyId, req.body);
    res.json({ data: cfg });
  })
);

aiRouter.post(
  '/test',
  validateRequest({ body: AiConfigUpdateSchema.partial().optional() }),
  asyncHandler(async (req, res) => {
    const result = await aiService.testAiConnection(req.auth.familyId, req.body);
    res.json({ data: result });
  })
);

aiRouter.post(
  '/chat',
  validateRequest({ body: AiChatMessageInputSchema }),
  asyncHandler(async (req, res) => {
    const chat = await aiService.sendChatMessage(
      req.auth.familyId,
      req.auth.userId,
      req.body.prompt,
      req.body.systemPrompt,
      req.body.chatId
    );
    res.status(201).json({ data: chat });
  })
);

aiRouter.get(
  '/chats',
  asyncHandler(async (req, res) => {
    const chats = await aiService.listChats(req.auth.familyId);
    res.json({ data: chats });
  })
);

aiRouter.get(
  '/chats/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    const chat = await aiService.getChatById(req.auth.familyId, String(req.params.id));
    res.json({ data: chat });
  })
);

aiRouter.patch(
  '/chats/:id',
  validateRequest({ params: IdParamSchema, body: UpdateAiChatSchema }),
  asyncHandler(async (req, res) => {
    const updated = await aiService.updateChatTitle(
      req.auth.familyId,
      String(req.params.id),
      req.body.title
    );
    res.json({ data: updated });
  })
);

aiRouter.delete(
  '/chats/:id',
  validateRequest({ params: IdParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await aiService.deleteChat(req.auth.familyId, String(req.params.id));
    res.json({ data: result });
  })
);

aiRouter.get(
  '/chats/:id/export',
  validateRequest({ params: IdParamSchema, query: AiChatExportQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = AiChatExportQuerySchema.parse(req.query);
    const redactAmounts = query.redact === 'true';
    const exported = await aiService.exportChat(
      req.auth.familyId,
      String(req.params.id),
      query.format,
      redactAmounts
    );
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.buffer);
  })
);
