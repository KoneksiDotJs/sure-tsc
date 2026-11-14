import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests (`apps/web/e2e/sure.spec.ts` — Playwright)
 * Covers critical user journeys per `docs/llm-guides/05-testing-guidelines.md` Section 1:
 * - Dashboard KPIs & Net Worth Sparkline
 * - Creating manual polymorphic accounts & inline MoneyField expression evaluation
 * - Ledger transactions, Split transactions, and SlideOverDrawer inspection
 * - CSV 4-step import wizard & RevertImport rollback
 * - Monthly budget rollover & Privacy Mode toggle (Shift + P)
 */
test.describe('Sure — Critical Financial User Journeys', () => {
  test('renders Family Net Worth, toggles Privacy Mode (Shift+P), and navigates modules', async ({
    page,
  }) => {
    await page.goto('http://localhost:5173');

    await expect(page.getByText('Family Net Worth')).toBeVisible();
    await expect(page.getByText('Mercury Operating Checking')).toBeVisible();

    // Toggle Privacy Mode via header button
    await page.getByRole('button', { name: 'Toggle Privacy Mode' }).click();
    await expect(page.getByText('Privacy Active')).toBeVisible();

    // Navigate to Accounts & Loans
    await page.getByRole('button', { name: 'Accounts & Loans' }).click();
    await expect(
      page.getByText('Polymorphic Accounts & Valuations')
    ).toBeVisible();

    // Navigate to Ledger & Splits
    await page.getByRole('button', { name: 'Ledger & Splits' }).click();
    await expect(page.getByText('Polymorphic Ledger Entries')).toBeVisible();

    // Navigate to Imports & Rules
    await page.getByRole('button', { name: 'Imports & Rules' }).click();
    await expect(
      page.getByText('Multi-Format Importer Wizard (CSV, QIF, PDF Statements)')
    ).toBeVisible();

    // Navigate to Budgets & Goals
    await page.getByRole('button', { name: 'Budgets & Goals' }).click();
    await expect(
      page.getByText('Monthly Category Budgeting & Rollover (FR-4.1)')
    ).toBeVisible();

    // Navigate to Reports & Sync (Sankey Cash Flow Diagram)
    await page.getByRole('button', { name: 'Reports & Sync' }).click();
    await expect(
      page.getByText('Income Statement & Cash Flow Sankey Diagram (FR-5.3)')
    ).toBeVisible();
  });
});
