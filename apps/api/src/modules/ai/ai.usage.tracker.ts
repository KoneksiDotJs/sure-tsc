import { LlmUsageQueryInput } from '@sure/shared';
import { decimalToFixed, prisma } from '../../config/prisma.js';
import { estimateLlmCostUsd, summarizeLlmUsage } from './ai.usage.js';

export async function recordLlmUsageEvent(params: {
  familyId: string;
  userId?: string;
  operation: 'Chat' | 'Categorize' | 'Test';
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const promptTokens = Math.max(0, Math.trunc(params.promptTokens));
  const completionTokens = Math.max(0, Math.trunc(params.completionTokens));
  const totalTokens = promptTokens + completionTokens;
  const estimatedCostUsd = estimateLlmCostUsd({
    provider: params.provider,
    model: params.model,
    promptTokens,
    completionTokens,
  });

  try {
    await prisma.llmUsageEvent.create({
      data: {
        familyId: params.familyId,
        userId: params.userId,
        operation: params.operation,
        provider: params.provider,
        model: params.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    });
  } catch {
    // Usage telemetry failure must not block user-facing AI completions
  }
}

export async function queryFamilyLlmUsage(familyId: string, query?: LlmUsageQueryInput) {
  const now = new Date();
  const defaultEnd = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const defaultStart = thirtyDaysAgo.toISOString().slice(0, 10);

  const startDate = query?.startDate ?? defaultStart;
  const endDate = query?.endDate ?? defaultEnd;
  const limit = query?.limit ?? 50;

  const gte = new Date(`${startDate}T00:00:00.000Z`);
  const lte = new Date(`${endDate}T23:59:59.999Z`);

  const rows = await prisma.llmUsageEvent.findMany({
    where: {
      familyId,
      createdAt: { gte, lte },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return summarizeLlmUsage(
    rows.map((r) => ({
      id: r.id,
      operation: r.operation,
      provider: r.provider,
      model: r.model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      estimatedCostUsd: r.estimatedCostUsd ? decimalToFixed(r.estimatedCostUsd) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    startDate,
    endDate
  );
}
