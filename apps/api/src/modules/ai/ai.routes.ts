import { Router } from 'express';
import {
  AiChatMessageInputSchema,
  AiConfigUpdateSchema,
  LlmUsageQuerySchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';
import { aiService } from './ai.service.js';

export const aiRouter: Router = Router();

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
      req.body.systemPrompt
    );
    res.status(201).json({ data: chat });
  })
);
