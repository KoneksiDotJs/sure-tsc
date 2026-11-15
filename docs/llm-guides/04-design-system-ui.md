# 04 — Sure Design System (`packages/ui`) Guidelines

This design system translates Sure's ViewComponent + Stimulus + Tailwind system into accessible, domain-agnostic React primitives under `packages/ui/src/components/`.

## 1. Typography & Tokens
- **UI Font:** `Geist` (`font-sans`) for headings, labels, navigation, and prose.
- **Financial / Numeric Font:** `Geist Mono` (`font-mono-tabular` / `font-mono tabular-nums`) for all currency amounts, percentages, token/usage counts, account balances, and table dates.
- **Surface Hierarchy (CSS Variables):**
  - Canvas background: `bg-[var(--bg-canvas)]` (`#F9FAFB` light / `#09090B` dark)
  - Card / Panel surface: `bg-[var(--bg-surface)]` (`#FFFFFF` light / `#121215` dark) with `border border-[var(--border-primary)]`
  - Subtle inner block / hover surface: `bg-[var(--bg-surface-subtle)]` / `hover:bg-[var(--bg-surface-hover)]`
- **Elevation:** Flat-first design. Rely on `1px` borders rather than heavy shadows; reserve shadows for floating overlays (`Dialog`, `SlideOverDrawer`, popovers).

## 2. Modular Component Organization (`packages/ui/src/components/`)
Large UI suites are organized into single-purpose files and re-exported through thin barrels:
- **`Charts.tsx` → `charts/`:**
  - `useContainerWidth.ts` (ResizeObserver responsiveness hook)
  - `ResponsiveAreaChart.tsx` (single or comparison area/line time-series)
  - `CashflowSankeyChart.tsx` (inflow → total → outflow/surplus streams)
  - `OutflowsDonutChart.tsx` (interactive category donut with center total & hover sync)
  - `MonthlyBarsChart.tsx` (grouped income vs. expense bars)
- **`Forms.tsx` → `forms/`:**
  - `MoneyField.tsx` (Decimal string input supporting inline arithmetic expressions)
  - `ComboboxSelects.tsx` (`CategorySelect`, `MerchantSelect`, `TagSelect`)
  - `IconPicker.tsx`
  - `BasicControls.tsx` (`Button`, `Toggle`, `SearchInput`, `SegmentedControl`, etc.)
- **Core Primitives:**
  - **Layout & Navigation:** `Layout.tsx` (`Card`, `Section`, `DetailRow`, `Alert`), `Navigation.tsx`
  - **Display & Tables:** `FinancialDisplay.tsx` (`MoneyAmount`, `Sparkline`, `ProgressRing`, `Pill`, `EmptyState`), `CategoryIcon.tsx`, `DataTable.tsx` (sortable columns, bulk selection checkboxes, `j`/`k`/`Enter` navigation)
  - **Overlays:** `Overlays.tsx` (`Dialog`, `SlideOverDrawer`)

## 3. Interaction, Privacy & Accessibility Rules
- Every interactive icon-only button MUST include an explicit `aria-label` and `title`.
- Respect `PrivacyMode` (`usePrivacyMode()`) in all monetary and LLM cost displays (`<MoneyAmount />` or explicit `blur-sm select-none` masking).
- Keep all tables and drawers keyboard-accessible and responsive without horizontal page overflow (overflow containers must scroll locally inside cards/chat bubbles/tables).
