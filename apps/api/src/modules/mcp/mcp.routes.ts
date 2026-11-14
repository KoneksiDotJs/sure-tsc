import { Router, Request, Response } from 'express';
import { authenticateMiddleware, asyncHandler } from '../../middleware/pipeline.js';
import { accountsService } from '../accounts/accounts.service.js';
import { entriesService } from '../entries/entries.service.js';
import { reportsService } from '../reports/reports.service.js';
import { budgetsAndGoalsService } from '../budgets/budgets.service.js';
import {
  CreateEntrySchema,
  CreateGoalSchema,
  EntryFilterQuerySchema,
} from '@sure/shared';

export const mcpRouter: Router = Router();

mcpRouter.use(authenticateMiddleware);

const MCP_TOOLS = [
  {
    name: 'get_accounts',
    description: 'List all financial accounts, balances, and family net worth summary.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_transactions',
    description: 'Query paginated ledger entries for the authenticated family.',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        search: { type: 'string' },
        perPage: { type: 'number' },
      },
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Retrieve the consolidated family Balance Sheet and asset mix.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_income_statement',
    description: 'Retrieve income vs expenses breakdown, savings rate, and Sankey links.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_budget',
    description: 'Retrieve monthly category budget allocations, spending, and rollover carryovers.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Month formatted as YYYY-MM' },
      },
    },
  },
  {
    name: 'get_goals',
    description: 'List family savings and investment goals with progress metrics.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_holdings',
    description: 'List security holdings, cost basis, unrealized gain, and portfolio weights for an account.',
    inputSchema: {
      type: 'object',
      required: ['accountId'],
      properties: {
        accountId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_transaction',
    description: 'Create a TRANSACTION entry in a family account and recalculate materialized balances.',
    inputSchema: {
      type: 'object',
      required: ['accountId', 'date', 'amount', 'name'],
      properties: {
        accountId: { type: 'string' },
        date: { type: 'string' },
        amount: { type: 'string' },
        name: { type: 'string' },
        currency: { type: 'string' },
        categoryId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new savings or investment goal for the family.',
    inputSchema: {
      type: 'object',
      required: ['name', 'targetAmount', 'targetDate'],
      properties: {
        name: { type: 'string' },
        targetAmount: { type: 'string' },
        currentAmount: { type: 'string' },
        monthlyPledge: { type: 'string' },
        targetDate: { type: 'string' },
      },
    },
  },
  {
    name: 'record_bill_payment',
    description: 'Mark an upcoming recurring bill as paid and materialize the payment entry.',
    inputSchema: {
      type: 'object',
      required: ['recurringId'],
      properties: {
        recurringId: { type: 'string' },
        paidDate: { type: 'string' },
      },
    },
  },
];

async function executeMcpTool(
  familyId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_accounts':
      return accountsService.listAccounts(familyId);
    case 'get_transactions': {
      const filters = EntryFilterQuerySchema.parse({
        accountId: args.accountId,
        search: args.search,
        perPage: args.perPage ?? 25,
      });
      return entriesService.listEntries(familyId, filters);
    }
    case 'get_balance_sheet': {
      const rep = await reportsService.getFinancialReport(familyId);
      return rep.balanceSheet;
    }
    case 'get_income_statement': {
      const rep = await reportsService.getFinancialReport(familyId);
      return { incomeStatement: rep.incomeStatement, sankey: rep.sankey };
    }
    case 'get_budget': {
      const month =
        typeof args.month === 'string' && /^\d{4}-\d{2}$/.test(args.month)
          ? args.month
          : new Date().toISOString().slice(0, 7);
      return budgetsAndGoalsService.getBudgetForMonth(familyId, month);
    }
    case 'get_goals':
      return budgetsAndGoalsService.listGoals(familyId);
    case 'get_holdings':
      return accountsService.getAccountHoldings(familyId, String(args.accountId ?? ''));
    case 'create_transaction': {
      const parsed = CreateEntrySchema.parse({
        entryType: 'TRANSACTION',
        accountId: args.accountId,
        date: args.date ?? new Date().toISOString().slice(0, 10),
        amount: args.amount,
        currency: args.currency ?? 'USD',
        name: args.name,
        categoryId: args.categoryId ?? null,
      });
      return entriesService.createEntry(familyId, parsed);
    }
    case 'create_goal': {
      const parsed = CreateGoalSchema.parse(args);
      return budgetsAndGoalsService.createGoal(familyId, parsed);
    }
    case 'record_bill_payment':
      return budgetsAndGoalsService.markRecurringPaid(
        familyId,
        String(args.recurringId ?? ''),
        typeof args.paidDate === 'string' ? args.paidDate : undefined
      );
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

mcpRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const scopes = req.auth.scopes ?? [];
    if (req.auth.authType === 'api_key' && !scopes.includes('mcp:tools')) {
      res.status(403).json({
        jsonrpc: '2.0',
        id: req.body?.id ?? null,
        error: { code: -32001, message: 'API key missing required scope: mcp:tools' },
      });
      return;
    }

    const { id = null, method, params } = (req.body ?? {}) as {
      id?: string | number | null;
      method?: string;
      params?: Record<string, unknown>;
    };

    try {
      if (method === 'initialize') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'sure-mcp-server', version: '1.0.0' },
            capabilities: { tools: {} },
          },
        });
        return;
      }

      if (method === 'notifications/initialized') {
        res.status(204).send();
        return;
      }

      if (method === 'tools/list') {
        res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: MCP_TOOLS },
        });
        return;
      }

      if (method === 'tools/call') {
        const toolName = String(params?.name ?? '');
        const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
        const data = await executeMcpTool(req.auth.familyId, toolName, toolArgs);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          },
        });
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${String(method)}` },
      });
    } catch (err) {
      res.status(200).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'MCP execution error',
        },
      });
    }
  })
);
