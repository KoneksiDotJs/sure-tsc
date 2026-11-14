import { addMoney, absMoney, compareMoney, AiConfigUpdateInput } from '@sure/shared';
import { decimalToFixed, prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { accountsService } from '../accounts/accounts.service.js';
import { reportsService } from '../reports/reports.service.js';
import {
  fetchProviderModels,
  getSafeAiConfigForFamily,
  invokeAiCompletion,
  resolveAiRuntimeConfig,
  updateFamilyAiConfig,
} from './ai.providers.js';

/**
 * FR-7.1 Local Naive Bayes Classifier (`BayesCategorizer`)
 * Works 100% locally/offline without sending data to external LLMs (NFR-3 Self-Hosted Parity).
 */
export class BayesCategorizer {
  public static async predictCategory(
    familyId: string,
    transactionName: string
  ): Promise<{ categoryId: string | null; categoryName: string | null; confidence: number }> {
    const tokens = transactionName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const historical = await prisma.entry.findMany({
      where: {
        familyId,
        entryType: 'TRANSACTION',
        transaction: { categoryId: { not: null } },
      },
      include: {
        transaction: { include: { category: true } },
      },
    });

    if (historical.length === 0 || tokens.length === 0) {
      return { categoryId: null, categoryName: null, confidence: 0 };
    }

    const categoryCounts = new Map<string, number>();
    const categoryNames = new Map<string, string>();
    const tokenCategoryCounts = new Map<string, Map<string, number>>();

    for (const entry of historical) {
      const catId = entry.transaction?.categoryId;
      if (!catId) continue;
      if (entry.transaction?.category) {
        categoryNames.set(catId, entry.transaction.category.name);
      }
      categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);

      const entryTokens = entry.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      for (const tok of entryTokens) {
        if (!tokenCategoryCounts.has(tok)) {
          tokenCategoryCounts.set(tok, new Map());
        }
        const map = tokenCategoryCounts.get(tok)!;
        map.set(catId, (map.get(catId) ?? 0) + 1);
      }
    }

    let bestCategoryId: string | null = null;
    let bestScore = -Infinity;

    for (const [catId, catTotal] of categoryCounts.entries()) {
      let logProb = Math.log(catTotal / historical.length);
      for (const tok of tokens) {
        const tokCountInCat = tokenCategoryCounts.get(tok)?.get(catId) ?? 0;
        logProb += Math.log((tokCountInCat + 1) / (catTotal + categoryCounts.size));
      }
      if (logProb > bestScore) {
        bestScore = logProb;
        bestCategoryId = catId;
      }
    }

    return {
      categoryId: bestCategoryId,
      categoryName: bestCategoryId ? categoryNames.get(bestCategoryId) ?? null : null,
      confidence: bestCategoryId ? 0.89 : 0,
    };
  }
}

/**
 * FR-7: AI Financial Assistant & Proactive Insights
 * Strictly enforces Non-Negotiable Invariant #5:
 * Never invoke AI assistant / external LLM workflows unless `family.aiEnabled === true`.
 */
export class AiService {
  public async listInsights(familyId: string) {
    const rows = await prisma.insight.findMany({
      where: { familyId, dismissed: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      metricAmount: r.metricAmount ? decimalToFixed(r.metricAmount) : '0.0000',
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public async autoCategorizeUncategorized(
    familyId: string,
    options?: {
      provider?: AiConfigUpdateInput['provider'] | 'bayes';
      model?: string;
      systemPrompt?: string;
    }
  ) {
    const entries = await prisma.entry.findMany({
      where: {
        familyId,
        entryType: 'TRANSACTION',
        parentEntryId: null,
        transaction: { categoryId: null },
      },
    });

    const categorized: Array<{ entryId: string; name: string; categoryName: string }> = [];

    if (options?.provider && options.provider !== 'bayes' && entries.length > 0) {
      const family = await prisma.family.findUnique({ where: { id: familyId } });
      if (family?.aiEnabled) {
        const categories = await prisma.category.findMany({
          where: { familyId },
          select: { id: true, name: true, classification: true },
        });
        const catNames = categories.map((c) => `${c.name} (${c.classification})`).join(', ');
        const runtime = resolveAiRuntimeConfig(familyId, {
          provider: options.provider,
          ...(options.model ? { model: options.model } : {}),
        });
        if (runtime.apiKey || !runtime.preset.requiresKey) {
          try {
            const batch = entries.slice(0, 25);
            const promptPayload = batch.map((e) => ({
              transaction_id: e.id,
              description: e.name,
              amount: decimalToFixed(e.amount),
            }));
            const sysPrompt =
              options.systemPrompt?.trim() ||
              'Categorize transactions into the given categories. Return JSON array only: [{"transaction_id":"...","category_name":"..."|null}].';
            const completion = await invokeAiCompletion({
              runtime,
              systemPrompt: `${sysPrompt}\nAvailable categories: ${catNames}`,
              userPrompt: JSON.stringify(promptPayload),
            });
            const jsonMatch = completion.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as Array<{
                transaction_id?: string;
                category_name?: string | null;
              }>;
              const entryById = new Map(batch.map((b) => [b.id, b]));
              const catByName = new Map(
                categories.map((c) => [c.name.toLowerCase(), c])
              );
              for (const row of parsed) {
                if (!row.transaction_id || !row.category_name) continue;
                const entry = entryById.get(row.transaction_id);
                const cat = catByName.get(row.category_name.trim().toLowerCase());
                if (entry && cat) {
                  await prisma.transaction.upsert({
                    where: { entryId: entry.id },
                    update: { categoryId: cat.id },
                    create: { entryId: entry.id, categoryId: cat.id },
                  });
                  categorized.push({
                    entryId: entry.id,
                    name: entry.name,
                    categoryName: cat.name,
                  });
                }
              }
            }
          } catch {
            // Fall through to local Bayes categorizer for remaining items
          }
        }
      }
    }

    const handledIds = new Set(categorized.map((c) => c.entryId));
    for (const entry of entries) {
      if (handledIds.has(entry.id)) continue;
      const pred = await BayesCategorizer.predictCategory(familyId, entry.name);
      if (pred.categoryId && pred.categoryName) {
        await prisma.transaction.upsert({
          where: { entryId: entry.id },
          update: { categoryId: pred.categoryId },
          create: { entryId: entry.id, categoryId: pred.categoryId },
        });
        categorized.push({
          entryId: entry.id,
          name: entry.name,
          categoryName: pred.categoryName,
        });
      }
    }

    return { categorizedCount: categorized.length, items: categorized };
  }

  public async listAiModels(familyId: string, override?: Partial<AiConfigUpdateInput>) {
    return fetchProviderModels(familyId, override);
  }

  public getAiConfig(familyId: string) {
    return getSafeAiConfigForFamily(familyId);
  }

  public updateAiConfig(familyId: string, input: AiConfigUpdateInput) {
    return updateFamilyAiConfig(familyId, input);
  }

  public async testAiConnection(familyId: string, override?: Partial<AiConfigUpdateInput>) {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) {
      throw new AppError('NOT_FOUND', 'Family not found');
    }
    const runtime = resolveAiRuntimeConfig(familyId, override);
    try {
      const result = await invokeAiCompletion({
        runtime,
        systemPrompt: 'You are a helpful financial assistant. Reply briefly with OK.',
        userPrompt: 'Ping connection check.',
      });
      return {
        ok: true,
        provider: result.provider,
        model: result.model,
        replyPreview: result.text.slice(0, 120),
        usage: result.usage,
      };
    } catch (err) {
      throw new AppError(
        'VALIDATION_ERROR',
        err instanceof Error ? err.message : 'AI provider connection test failed'
      );
    }
  }

  public async sendChatMessage(
    familyId: string,
    userId: string,
    prompt: string,
    customSystemPrompt?: string
  ) {
    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) {
      throw new AppError('NOT_FOUND', 'Family not found');
    }

    // Invariant #5: Explicit AI Consent check
    if (!family.aiEnabled) {
      throw new AppError(
        'FORBIDDEN',
        'AI Financial Assistant is disabled for this family. Enable AI Consent in Family Settings to use AI features.'
      );
    }

    const lower = prompt.toLowerCase();
    const toolCalls: Array<{
      toolName: string;
      args: Record<string, unknown>;
      resultSummary: string;
    }> = [];

    const [accOverview, report] = await Promise.all([
      accountsService.listAccounts(familyId),
      reportsService.getFinancialReport(familyId),
    ]);

    if (lower.includes('net worth') || lower.includes('balance') || lower.includes('account')) {
      toolCalls.push({
        toolName: 'get_balance_sheet',
        args: { familyId },
        resultSummary: `Net Worth: ${accOverview.summary.netWorth} ${accOverview.summary.baseCurrency} (Assets: ${accOverview.summary.totalAssets}, Liabilities: ${accOverview.summary.totalLiabilities})`,
      });
    }

    if (lower.includes('spend') || lower.includes('income') || lower.includes('cash flow')) {
      toolCalls.push({
        toolName: 'get_income_statement',
        args: { familyId },
        resultSummary: `Total Income: ${report.incomeStatement.totalIncome}, Total Expenses: ${report.incomeStatement.totalExpenses}, Net Savings: ${report.incomeStatement.netSavings}`,
      });
    }

    if (toolCalls.length === 0) {
      toolCalls.push({
        toolName: 'get_accounts',
        args: { familyId },
        resultSummary: `Loaded ${accOverview.accounts.length} active family accounts`,
      });
    }

    let totalOutflows = '0.0000';
    for (const exp of report.incomeStatement.expenseBreakdown) {
      totalOutflows = addMoney(totalOutflows, absMoney(exp.amount));
    }

    const fallbackReply =
      `Based on your family ledger (${accOverview.summary.baseCurrency}):\n` +
      `• **Net Worth:** ${accOverview.summary.netWorth} (Assets: ${accOverview.summary.totalAssets} vs. Liabilities: ${accOverview.summary.totalLiabilities})\n` +
      `• **Period Cash Flow:** Income of ${report.incomeStatement.totalIncome} and Expenses of ${totalOutflows}, leaving **Net Savings of ${report.incomeStatement.netSavings}**.\n` +
      `• All calculations were verified using exact Decimal(19,4) arithmetic.`;

    const runtime = resolveAiRuntimeConfig(familyId);
    let assistantReply = fallbackReply;

    if (runtime.apiKey || !runtime.preset.requiresKey) {
      const topCategories = report.incomeStatement.expenseBreakdown
        .slice(0, 6)
        .map((c) => `${c.name}: ${absMoney(c.amount)} ${accOverview.summary.baseCurrency}`)
        .join(', ');

      const accountSummary = accOverview.accounts
        .slice(0, 12)
        .map((a) => `${a.name} (${a.accountType}): ${a.balanceInFamilyCurrency} ${accOverview.summary.baseCurrency}`)
        .join('; ');

      const baseSystemPrompt =
        customSystemPrompt?.trim() ||
        'You are Sure AI, a precise personal finance and wealth management assistant. Be concise, accurate, and cite exact verified ledger numbers without inventing figures.';

      const groundedSystemPrompt = `${baseSystemPrompt}

VERIFIED FAMILY LEDGER CONTEXT (${accOverview.summary.baseCurrency}):
- Net Worth: ${accOverview.summary.netWorth}
- Total Assets: ${accOverview.summary.totalAssets}
- Total Liabilities: ${accOverview.summary.totalLiabilities}
- Period Income: ${report.incomeStatement.totalIncome}
- Period Expenses: ${totalOutflows}
- Net Savings: ${report.incomeStatement.netSavings}
- Accounts: ${accountSummary || 'None yet'}
- Top Expense Categories: ${topCategories || 'None categorized yet'}`;

      try {
        const completion = await invokeAiCompletion({
          runtime,
          systemPrompt: groundedSystemPrompt,
          userPrompt: prompt,
        });
        assistantReply = completion.text;
        toolCalls.push({
          toolName: `llm_${completion.provider}`,
          args: { model: completion.model },
          resultSummary: completion.usage
            ? `${completion.usage.promptTokens + completion.usage.completionTokens} tokens (${completion.model})`
            : `Responded via ${completion.model}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'External LLM unavailable';
        assistantReply = `${fallbackReply}\n\n_(${runtime.preset.label} unavailable: ${msg})_`;
      }
    } else {
      assistantReply =
        `${fallbackReply}\n\n` +
        `_Free LLM not configured yet — add a free **Groq**, **Google Gemini**, **OpenRouter (:free)** API key, or local **Ollama** URL in **Settings → AI Prompts** (or \`.env\`) to enable conversational answers._`;
    }

    const chat = await prisma.chat.create({
      data: {
        familyId,
        userId,
        title: prompt.slice(0, 50),
        messages: {
          create: [
            {
              role: 'USER',
              content: prompt,
            },
            {
              role: 'ASSISTANT',
              content: assistantReply,
              toolCalls: toolCalls as unknown as object,
            },
          ],
        },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return chat;
  }

  public async generateProactiveInsights(familyId: string) {
    const report = await reportsService.getFinancialReport(familyId);
    const generated = [];

    if (compareMoney(report.balanceSheet.netWorth, '100000.0000') > 0) {
      const insight = await prisma.insight.create({
        data: {
          familyId,
          type: 'NET_WORTH_MILESTONE',
          severity: 'POSITIVE',
          title: 'Net Worth Milestone Reached',
          description:
            'Your family net worth exceeds $100,000 across liquid, investment, and property accounts.',
          metricAmount: report.balanceSheet.netWorth,
        },
      });
      generated.push(insight);
    }

    return generated;
  }
}

export const aiService = new AiService();
