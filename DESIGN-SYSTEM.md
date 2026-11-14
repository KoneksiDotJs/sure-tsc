# Sure Design System (`packages/ui`) Specification

## 1. Design Philosophy
Derived from Sure's original ViewComponent + Stimulus + Tailwind architecture (`app/components/DS/` and `design/tokens/sure.tokens.json` v2.1.0), **Sure DS** prioritizes:
* **Financial Legibility First:** Strict alignment of tabular numbers using `Geist Mono` (`tabular-nums`) so columns of currency figures scan effortlessly.
* **Flat-First High-Contrast Surfaces:** Crisp alpha-hairline elevation (`--shadow-border-xs/sm/md/lg`) and `1px` borders over heavy drop shadows, paired with Sure's neutral `#FAFAFA`–`#0B0B0B` palette for Light and Dark (`[data-theme="dark"]` / `.dark`) modes.
* **Three-Pane Shell & Clean Controls:** Primary icon rail (`Overview`, `Transactions`, `Accounts`, `Investments`, `Budgets`, `Rules & Imports`, `Reports & Sync`, `Settings`), collapsible family accounts sidebar, and dockable AI assistant panel; utility toggles (Theme / Privacy Mode) stay flat without unnecessary hover treatments.
* **Keyboard-Driven Speed:** Full keyboard navigation across transaction tables, command menus, comboboxes, and slide-over drawers.
* **Privacy by Default:** Built-in support for `PrivacyMode` masking (`html.privacy-mode .privacy-sensitive`) on every monetary display primitive.

---

## 2. Typography Tokens
Load `Geist` and `Geist Mono` variable/static WOFF2 fonts and enforce the following typographic roles:

* **UI Sans (`--font-sans`):** `'Geist', -apple-system, BlinkMacSystemFont, sans-serif` — used for headings, navigation, form labels, and prose.
* **Financial Mono (`--font-mono`):** `'Geist Mono', ui-monospace, SFMono-Regular, monospace` — **mandatory** for all currency amounts, account balances, percentages, quantities, and table dates with `font-variant-numeric: tabular-nums`.

| Scale Token | Size / Line-Height | Weight | Usage |
| :--- | :--- | :--- | :--- |
| `text-xs` | `12px` / `16px` | `400`–`500` | Badges (`Pill`), table column headers, chart axis labels |
| `text-sm` | `14px` / `20px` | `400`–`500` | Primary table rows, form inputs, dropdown menu items |
| `text-base` | `16px` / `24px` | `400`–`600` | Card body copy, modal descriptions, chat messages |
| `text-lg` | `18px` / `28px` | `600` | Card titles, drawer headers |
| `text-xl` | `20px` / `28px` | `600` | Page section headers |
| `text-2xl` / `3xl` | `24px`–`30px` / `32px`–`36px` | `600`–`700` | Primary KPI figures (Net Worth, Total Assets, Cash Flow) |

---

## 3. Color, Radius & Shadow Tokens (`packages/ui/src/styles/tokens.css`)
Aligned directly with Sure's canonical W3C token contract (`design/tokens/sure.tokens.json` v2.1.0):

```css
:root {
  color-scheme: light;

  /* Core Neutral Palette */
  --color-white: #ffffff;
  --color-black: #0B0B0B;
  --color-gray-50: #F7F7F7;
  --color-gray-100: #F0F0F0;
  --color-gray-200: #E7E7E7;
  --color-gray-500: #737373;
  --color-gray-900: #171717;

  /* Surfaces (Light Mode) */
  --bg-canvas: var(--color-gray-50);
  --bg-surface: var(--color-white);
  --bg-surface-subtle: var(--color-gray-50);
  --bg-surface-hover: var(--color-gray-100);
  --color-container: var(--color-white);
  --color-container-inset: var(--color-gray-50);

  /* Borders & Hairline Elevation */
  --border-primary: rgba(11, 11, 11, 0.08);
  --border-secondary: rgba(11, 11, 11, 0.10);
  --border-subdued: rgba(11, 11, 11, 0.05);
  --border-strong: rgba(11, 11, 11, 0.10);
  --shadow-border-xs: 0px 1px 2px 0px rgba(11, 11, 11, 0.06), 0px 0px 0px 1px rgba(11, 11, 11, 0.05);
  --border-radius-md: 8px;
  --border-radius-lg: 10px;

  /* Typography & Accent */
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-500);
  --text-muted: #9E9E9E;
  --accent-primary: var(--color-gray-900);
  --accent-primary-fg: var(--color-white);

  /* Semantic Statuses & Budget Chart Fills */
  --status-positive: #078C52;
  --status-negative: #F13636;
  --status-warning: #DC6803;
  --status-info: #1570EF;
  --budget-unused-fill: var(--color-gray-200);
  --budget-unallocated-fill: var(--color-gray-50);
}

[data-theme="dark"],
.dark {
  color-scheme: dark;
  --bg-canvas: var(--color-black);
  --bg-surface: var(--color-gray-900);
  --bg-surface-subtle: #242424;
  --bg-surface-hover: #363636;
  --border-primary: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.15);
  --text-primary: var(--color-white);
  --text-secondary: #CFCFCF;
  --text-muted: #9E9E9E;
  --accent-primary: var(--color-white);
  --accent-primary-fg: var(--color-gray-900);
  --status-positive: #32D583;
  --status-negative: #ED4E4E;
  --status-warning: #FDB022;
  --status-info: #2E90FA;
  --budget-unused-fill: var(--color-gray-500);
  --budget-unallocated-fill: #363636;
}
```

> **Privacy Mode CSS Contract:** Applying `.privacy-mode` to `<html>` automatically blurs all `.privacy-sensitive` monetary nodes (`filter: blur(8px); user-select: none;`) and disables pointer interaction unless `.privacy-sensitive-interactive` is present. Helper classes `.chart-tooltip`, `.goal-avatar`, and `.table-scroll` live alongside tokens in [tokens.css](packages/ui/src/styles/tokens.css).

---

## 4. Spacing, Border Radius & Elevation
* **Spacing Scale:** Standard `4px` base grid (`p-3` = `12px`, `p-4` = `16px`, `p-5` = `20px` card padding, `gap-6` = `24px` section spacing).
* **Border Radius:**
  * `rounded-md` (`6px`): Buttons, form inputs, `Pill` badges, menu items.
  * `rounded-xl` (`12px`): `Card` containers, `Dialog` modals, `Popover` panels.
  * `rounded-full`: Avatars, status dots, `ProgressRing` tracks.
* **Elevation:**
  * Default cards & panels: `border border-primary shadow-none`.
  * Floating overlays (`Popover`, `Menu`, `Dialog`, `SlideOverDrawer`): `border border-primary shadow-lg`.

---

## 5. Core Component Catalog (`packages/ui/src/components/`)

### A. Layout & Structural Primitives
1. **`<Card />`** (maps to `DS::Card`)
   * Props: `title?: string`, `subtitle?: string`, `action?: ReactNode`, `padding?: 'none' | 'sm' | 'md'`, `children`.
2. **`<Section />`** (maps to `DS::Section`)
   * Groups related settings or report blocks with a standardized header and optional collapsible behavior.
3. **`<DetailRow />` & `<ActionRow />`** (maps to `DS::DetailRow` & `DS::ActionRow`)
   * Key-value metadata row (`label`, `value`, `icon`, `description`) and clickable navigation/action row with trailing chevron or control.
4. **`<Disclosure />`** (maps to `DS::Disclosure`)
   * Collapsible accordion panel with optional `persistKey` backed by `localStorage`.

### B. Navigation & Controls
5. **`<Tabs />` & `<SegmentedControl />`** (maps to `DS::Tabs` & `DS::SegmentedControl`)
   * `SegmentedControl` is used for compact timeframe selectors (`1M | 3M | 6M | YTD | 1Y | ALL`) and transaction type switchers (`Expense | Income | Transfer`).
6. **`<Menu />`, `<Popover />`, & `<Tooltip />`** (maps to `DS::Menu`, `DS::Popover`, `DS::Tooltip`)
   * Built on accessible floating primitives with keyboard arrow navigation, focus trapping, and `Escape` dismissal.

### C. Financial Forms & Selectors
7. **`<MoneyField />`** (maps to `money_field_controller.js` + `evaluate_amount_expression.js`)
   * Formatted decimal input displaying currency symbol/code, locale-aware thousand separators, and **inline arithmetic evaluation** on `blur` or `Enter` (e.g., entering `125000 + 15000 * 2` evaluates to `155000.00`).
8. **`<CategorySelect />`, `<MerchantSelect />`, & `<TagSelect />`** (maps to `DS::CategorySelect`, `DS::MerchantSelect`, `DS::TagSelect`)
   * Searchable comboboxes displaying color-coded icons/pills and an inline `+ Create "..."` quick-creation option when no exact match exists.
9. **`<IconPicker />`** (maps to `DS::IconPicker` & `color_icon_picker_controller.js`)
   * Grid selector combining Lucide icons and Sure's curated category/account color swatches.
10. **`<Toggle />` & `<SearchInput />`** (maps to `DS::Toggle` & `DS::SearchInput`)
    * Accessible boolean switch and debounced search bar with keyboard shortcut hint (`/` or `⌘K`) and clear button.

### D. Data Display & Financial Visuals
11. **`<MoneyAmount />` & `<PrivacyModeProvider />`** (maps to `privacy-mode.css` & `privacy_mode_controller.js`)
    * Renders currency values in `Geist Mono` (`tabular-nums`) with optional sign coloring (`positive` / `negative`). Automatically applies `blur-sm select-none transition-[filter]` when global Privacy Mode is active.
12. **`<DataTable />`** (maps to `DS::Table` + `bulk_select_controller.js` + `list_keyboard_navigation_controller.js`)
    * Supports sticky headers, sortable columns, row selection checkboxes with floating bulk-action bar, and `j`/`k` + `Enter` keyboard navigation.
13. **`<Pill />`** (maps to `DS::Pill`)
    * Rounded status/category badge using a 10% tinted background derived from its assigned hex color (`backgroundColor: ${color}1A`, `color`).
14. **`<Sparkline />`** (maps to `DS::Sparkline`)
    * Lightweight SVG polyline with gradient area fill for inline 30-day account balance trends.
15. **`<ProgressRing />`** (maps to `DS::ProgressRing`)
    * Circular SVG progress indicator used in Goal cards and Budget category rows.
16. **`<EmptyState />`** (maps to `DS::EmptyState`)
    * Centered zero-data placeholder with icon, explanation, and primary CTA button.

### E. Overlays & Feedback
17. **`<Dialog />` & `<ConfirmDialog />`** (maps to `DS::Dialog` & `confirm_dialog_controller.js`)
    * Centered modal dialog with destructive variant support for irreversible actions (account deletion, import revert).
18. **`<SlideOverDrawer />`**
    * Right-anchored drawer (`max-w-lg`) for inspecting and editing transaction details, splits, attachments, and audit logs without losing scroll position in `<DataTable />`.
19. **`<Alert />`** (maps to `DS::Alert`)
    * Inline contextual banner (`info`, `warning`, `error`, `success`) for sync errors, AI consent notices, and reconciliation prompts.

---

## 6. Accessibility & Keyboard Standards
* **Focus Management:** All interactive elements must display a visible `2px` focus ring (`focus-visible:ring-2 focus-visible:ring-offset-2`).
* **Global Shortcuts:**
  * `⌘K` / `Ctrl+K`: Focus global search / command palette.
  * `Shift + P`: Toggle **Privacy Mode** globally.
  * `j` / `k`: Move active highlight down/up in financial tables (`<DataTable />`).
  * `Enter`: Open `<SlideOverDrawer />` for the currently highlighted row.
  * `Escape`: Close active `<Dialog />`, `<SlideOverDrawer />`, or `<Popover />`.