import { describe, expect, it } from 'vitest';
import { estimateLlmCostUsd, summarizeLlmUsage } from './ai.usage.js';

describe('LLM Usage Cost Estimation & Aggregation', () => {
  it('returns null (N/A) for custom, self-hosted, and :free models', () => {
    expect(
      estimateLlmCostUsd({
        provider: 'openrouter',
        model: '@cf/moonshotai/kimi-k2.5',
        promptTokens: 16686,
        completionTokens: 1163,
      })
    ).toBeNull();

    expect(
      estimateLlmCostUsd({
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        promptTokens: 15000,
        completionTokens: 500,
      })
    ).toBeNull();

    expect(
      estimateLlmCostUsd({
        provider: 'ollama',
        model: 'llama3.2',
        promptTokens: 8000,
        completionTokens: 400,
      })
    ).toBeNull();
  });

  it('computes exact Decimal cost for commercial models and excludes N/A rows from paid average', () => {
    const paidCost = estimateLlmCostUsd({
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 100000, // 0.1M * $0.15 = $0.0150
      completionTokens: 10000, // 0.01M * $0.60 = $0.0060
    });
    expect(paidCost).toBe('0.0210');

    const report = summarizeLlmUsage(
      [
        {
          id: '1',
          operation: 'Chat',
          provider: 'openrouter',
          model: '@cf/moonshotai/kimi-k2.5',
          promptTokens: 16686,
          completionTokens: 1163,
          totalTokens: 17849,
          estimatedCostUsd: null,
          createdAt: '2026-11-15T01:35:00.000Z',
        },
        {
          id: '2',
          operation: 'Chat',
          provider: 'openai',
          model: 'gpt-4o-mini',
          promptTokens: 100000,
          completionTokens: 10000,
          totalTokens: 110000,
          estimatedCostUsd: paidCost,
          createdAt: '2026-11-15T01:34:00.000Z',
        },
      ],
      '2026-10-16',
      '2026-11-15'
    );

    expect(report.summary.totalRequests).toBe(2);
    expect(report.summary.requestsWithCostData).toBe(1);
    expect(report.summary.totalPromptTokens).toBe(116686);
    expect(report.summary.totalCompletionTokens).toBe(11163);
    expect(report.summary.totalTokens).toBe(127849);
    expect(report.summary.totalCostUsd).toBe('0.02');
    expect(report.summary.avgCostPerRequestUsd).toBe('0.0210');
  });
});
