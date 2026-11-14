-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('VIEW', 'EDIT', 'FULL');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('DEPOSITORY', 'CREDIT_CARD', 'INVESTMENT', 'CRYPTO', 'PROPERTY', 'VEHICLE', 'LOAN', 'OTHER_ASSET', 'OTHER_LIABILITY');

-- CreateEnum
CREATE TYPE "AccountClassification" AS ENUM ('ASSET', 'LIABILITY');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('TRANSACTION', 'VALUATION', 'TRADE');

-- CreateEnum
CREATE TYPE "ValuationKind" AS ENUM ('OPENING', 'RECONCILIATION', 'MARKET');

-- CreateEnum
CREATE TYPE "TradeAction" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'SPLIT');

-- CreateEnum
CREATE TYPE "CategoryClassification" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('CSV', 'QIF', 'PDF');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERTED');

-- CreateEnum
CREATE TYPE "RuleMatchMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "RecurringCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('BANKING', 'CRYPTO', 'BROKERAGE', 'MARKET_DATA');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('CONNECTED', 'SYNCING', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "FinancekitStatus" AS ENUM ('STAGED', 'CONFLICT', 'COMMITTED');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('DUPLICATE_ENTRY', 'UNMAPPED_ACCOUNT', 'BALANCE_MISMATCH');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('SPENDING_ANOMALY', 'SUBSCRIPTION_HIKE', 'IDLE_CASH', 'CASH_FLOW_WARNING', 'NET_WORTH_MILESTONE');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'POSITIVE');

-- CreateTable
CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passkeyCredentials" JSONB NOT NULL DEFAULT '[]',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_memberships" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_shares" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "permission" "PermissionLevel" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "account_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_shares" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "permission" "PermissionLevel" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "budget_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "superAdminUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "classification" "AccountClassification" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "subtypeDetails" JSONB NOT NULL DEFAULT '{}',
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "icon" TEXT NOT NULL DEFAULT 'Wallet',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "providerConnectionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL,
    "balanceInFamilyCurrency" DECIMAL(19,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "parentEntryId" UUID,
    "importId" UUID,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "categoryId" UUID,
    "merchantId" UUID,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "kind" "ValuationKind" NOT NULL DEFAULT 'RECONCILIATION',

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "securities" (
    "id" UUID NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "currentPrice" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "assetClass" TEXT NOT NULL DEFAULT 'EQUITY',

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "securityId" UUID NOT NULL,
    "action" "TradeAction" NOT NULL,
    "qty" DECIMAL(19,8) NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "fees" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "securityId" UUID NOT NULL,
    "qty" DECIMAL(19,8) NOT NULL,
    "avgCostBasis" DECIMAL(19,4) NOT NULL,
    "marketValue" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_matches" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "outflowEntryId" UUID NOT NULL,
    "inflowEntryId" UUID NOT NULL,
    "matchedBy" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "classification" "CategoryClassification" NOT NULL DEFAULT 'EXPENSE',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "icon" TEXT NOT NULL DEFAULT 'Tag',
    "parentId" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'Store',
    "website" TEXT,
    "defaultCategoryId" UUID,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_tags" (
    "entryId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "entry_tags_pkey" PRIMARY KEY ("entryId","tagId")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB NOT NULL DEFAULT '{}',
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_groups" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rule_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "ruleGroupId" UUID,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchMode" "RuleMatchMode" NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "expectedIncome" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "rolloverEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "budgetedAmount" DECIMAL(19,4) NOT NULL,
    "rolloverAmount" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "rolloverEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(19,4) NOT NULL,
    "currentAmount" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "monthlyPledge" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "targetDate" DATE NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "icon" TEXT NOT NULL DEFAULT 'Target',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_accounts" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "allocationPercent" DECIMAL(19,4) NOT NULL DEFAULT 100.0000,

    CONSTRAINT "goal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_pledges" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "goal_pledges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "categoryId" UUID,
    "merchantId" UUID,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "lastAmount" DECIMAL(19,4),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "cadence" "RecurringCadence" NOT NULL DEFAULT 'MONTHLY',
    "nextOccurrenceDate" DATE NOT NULL,
    "autoPay" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_occurrences" (
    "id" UUID NOT NULL,
    "recurringTransactionId" UUID NOT NULL,
    "expectedDate" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "matchedEntryId" UUID,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "baseCurrency" VARCHAR(3) NOT NULL,
    "targetCurrency" VARCHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerCategory" "ProviderCategory" NOT NULL,
    "institutionName" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncedAt" TIMESTAMP(3),
    "encryptedCredentials" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financekit_batches" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "providerConnectionId" UUID NOT NULL,
    "status" "FinancekitStatus" NOT NULL DEFAULT 'STAGED',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financekit_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financekit_items" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "FinancekitStatus" NOT NULL DEFAULT 'STAGED',

    CONSTRAINT "financekit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financekit_conflicts" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "incomingSummary" JSONB NOT NULL,
    "existingEntryId" UUID,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "financekit_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "type" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metricAmount" DECIMAL(19,4),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "family_memberships_familyId_userId_key" ON "family_memberships"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_shares_accountId_membershipId_key" ON "account_shares"("accountId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_shares_budgetId_membershipId_key" ON "budget_shares"("budgetId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "accounts_familyId_accountType_idx" ON "accounts"("familyId", "accountType");

-- CreateIndex
CREATE INDEX "account_balances_accountId_date_idx" ON "account_balances"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_accountId_date_key" ON "account_balances"("accountId", "date");

-- CreateIndex
CREATE INDEX "entries_familyId_date_idx" ON "entries"("familyId", "date" DESC);

-- CreateIndex
CREATE INDEX "entries_accountId_date_idx" ON "entries"("accountId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_entryId_key" ON "transactions"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "valuations_entryId_key" ON "valuations"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "securities_ticker_key" ON "securities"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "trades_entryId_key" ON "trades"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_accountId_securityId_key" ON "holdings"("accountId", "securityId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_matches_outflowEntryId_key" ON "transfer_matches"("outflowEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_matches_inflowEntryId_key" ON "transfer_matches"("inflowEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_familyId_name_key" ON "categories"("familyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_familyId_name_key" ON "merchants"("familyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_familyId_name_key" ON "tags"("familyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_familyId_month_key" ON "budgets"("familyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_budgetId_categoryId_key" ON "budget_categories"("budgetId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_accounts_goalId_accountId_key" ON "goal_accounts"("goalId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_baseCurrency_targetCurrency_date_key" ON "exchange_rates"("baseCurrency", "targetCurrency", "date");

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "family_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_shares" ADD CONSTRAINT "budget_shares_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_shares" ADD CONSTRAINT "budget_shares_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "family_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_superAdminUserId_fkey" FOREIGN KEY ("superAdminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_parentEntryId_fkey" FOREIGN KEY ("parentEntryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_matches" ADD CONSTRAINT "transfer_matches_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_matches" ADD CONSTRAINT "transfer_matches_outflowEntryId_fkey" FOREIGN KEY ("outflowEntryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_matches" ADD CONSTRAINT "transfer_matches_inflowEntryId_fkey" FOREIGN KEY ("inflowEntryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_groups" ADD CONSTRAINT "rule_groups_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_ruleGroupId_fkey" FOREIGN KEY ("ruleGroupId") REFERENCES "rule_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_accounts" ADD CONSTRAINT "goal_accounts_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_accounts" ADD CONSTRAINT "goal_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_pledges" ADD CONSTRAINT "goal_pledges_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_pledges" ADD CONSTRAINT "goal_pledges_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "family_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurringTransactionId_fkey" FOREIGN KEY ("recurringTransactionId") REFERENCES "recurring_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_batches" ADD CONSTRAINT "financekit_batches_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_batches" ADD CONSTRAINT "financekit_batches_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_items" ADD CONSTRAINT "financekit_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "financekit_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_conflicts" ADD CONSTRAINT "financekit_conflicts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "financekit_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_conflicts" ADD CONSTRAINT "financekit_conflicts_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "financekit_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financekit_conflicts" ADD CONSTRAINT "financekit_conflicts_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
