import {
  Decimal,
  LlmUsageEventDto,
  LlmUsageReportDto,
  toFixedDecimalString,
} from '@sure/shared';

export const LLM_PRICING_VERIFIED_AT = '2026-10-17';

export interface ModelTokenPricing {
  /** USD per 1,000,000 input/prompt tokens */
  inputPerMillion: string;
  /** USD per 1,000,000 output/completion tokens */
  outputPerMillion: string;
}

/**
 * Published commercial provider pricing per 1M tokens (last verified 2026-10-17).
 * Self-hosted, `:free`, and unrecognized/custom models intentionally return null ("N/A").
 */
const PUBLISHED_MODEL_PRICING: ReadonlyArray<{
  match: RegExp;
  pricing: ModelTokenPricing;
}> = [
  // OpenAI
  { match: /^(openai\/)?gpt-4o-mini/i, pricing: { inputPerMillion: '0.1500', outputPerMillion: '0.6000' } },
  { match: /^(openai\/)?gpt-4o/i, pricing: { inputPerMillion: '2.5000', outputPerMillion: '10.0000' } },
  { match: /^(openai\/)?gpt-4\.1-nano/i, pricing: { inputPerMillion: '0.1000', outputPerMillion: '0.4000' } },
  { match: /^(openai\/)?gpt-4\.1-mini/i, pricing: { inputPerMillion: '0.4000', outputPerMillion: '1.6000' } },
  { match: /^(openai\/)?gpt-4\.1/i, pricing: { inputPerMillion: '2.0000', outputPerMillion: '8.0000' } },
  { match: /^(openai\/)?o[34]-mini/i, pricing: { inputPerMillion: '1.1000', outputPerMillion: '4.4000' } },

  // Anthropic
  { match: /^(anthropic\/)?claude-3-5-haiku/i, pricing: { inputPerMillion: '0.8000', outputPerMillion: '4.0000' } },
  { match: /^(anthropic\/)?claude-3-5-sonnet/i, pricing: { inputPerMillion: '3.0000', outputPerMillion: '15.0000' } },
  { match: /^(anthropic\/)?claude-3-7-sonnet/i, pricing: { inputPerMillion: '3.0000', outputPerMillion: '15.0000' } },
  { match: /^(anthropic\/)?claude-sonnet-4/i, pricing: { inputPerMillion: '3.0000', outputPerMillion: '15.0000' } },
  { match: /^(anthropic\/)?claude-opus-4/i, pricing: { inputPerMillion: '15.0000', outputPerMillion: '75.0000' } },

  // Google Gemini (paid API tiers; free-tier/OpenRouter `:free` return null before lookup)
  { match: /^(google\/)?gemini-2\.5-pro/i, pricing: { inputPerMillion: '1.2500', outputPerMillion: '10.0000' } },
  { match: /^(google\/)?gemini-2\.5-flash/i, pricing: { inputPerMillion: '0.3000', outputPerMillion: '2.5000' } },
  { match: /^(google\/)?gemini-2\.0-flash/i, pricing: { inputPerMillion: '0.1000', outputPerMillion: '0.4000' } },
  { match: /^(google\/)?gemini-1\.5-pro/i, pricing: { inputPerMillion: '1.2500', outputPerMillion: '5.0000' } },
];

export function lookupPublishedPricing(
  provider: string,
  model: string
): ModelTokenPricing | null {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedModel = model.trim();

  // Custom, self-hosted, Cloudflare Workers AI, and `:free` routes have no billed pricing data -> "N/A"
  if (
    !normalizedModel ||
    normalizedProvider === 'ollama' ||
    normalizedModel.endsWith(':free') ||
    normalizedModel.startsWith('@cf/')
  ) {
    return null;
  }

  for (const entry of PUBLISHED_MODEL_PRICING) {
    if (entry.match.test(normalizedModel)) {
      return entry.pricing;
    }
  }
  return null;
}

export function estimateLlmCostUsd(params: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): string | null {
  const pricing = lookupPublishedPricing(params.provider, params.model);
  if (!pricing) {
    return null;
  }

  const oneMillion = new Decimal('1000000');
  const inputCost = new Decimal(Math.max(0, Math.trunc(params.promptTokens)))
    .dividedBy(oneMillion)
    .times(new Decimal(pricing.inputPerMillion));
  const outputCost = new Decimal(Math.max(0, Math.trunc(params.completionTokens)))
    .dividedBy(oneMillion)
    .times(new Decimal(pricing.outputPerMillion));

  return inputCost.plus(outputCost).toFixed(4, Decimal.ROUND_HALF_EVEN);
}

export function summarizeLlmUsage(
  events: LlmUsageEventDto[],
  startDate: string,
  endDate: string
): LlmUsageReportDto {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let requestsWithCostData = 0;
  let totalCostDecimal = new Decimal('0');

  for (const ev of events) {
    totalPromptTokens += ev.promptTokens;
    totalCompletionTokens += ev.completionTokens;
    totalTokens += ev.totalTokens;
    if (ev.estimatedCostUsd !== null) {
      requestsWithCostData += 1;
      totalCostDecimal = totalCostDecimal.plus(new Decimal(ev.estimatedCostUsd));
    }
  }

  const avgCostDecimal =
    requestsWithCostData > 0
      ? totalCostDecimal.dividedBy(new Decimal(requestsWithCostData))
      : new Decimal('0');

  return {
    startDate,
    endDate,
    pricingVerifiedAt: LLM_PRICING_VERIFIED_AT,
    summary: {
      totalRequests: events.length,
      requestsWithCostData,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCostUsd: toFixedDecimalString(totalCostDecimal, 2),
      avgCostPerRequestUsd: toFixedDecimalString(avgCostDecimal, 4),
    },
    events,
  };
}
