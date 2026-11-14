# 04 — Sure Design System (`packages/ui`) Guidelines

This design system translates Sure's original ViewComponent + Stimulus + Tailwind system (`app/components/DS/` & `app/assets/tailwind/`) into accessible React primitives.

## 1. Typography & Tokens
- **UI Font:** `Geist` (`font-sans`) for headings, labels, navigation, and prose.
- **Financial / Numeric Font:** `Geist Mono` (`font-mono tabular-nums`) for all currency amounts, percentages, account balances, and table dates.
- **Surface Hierarchy (CSS Variables):**
  - Canvas background: `bg-canvas` (`#F9FAFB` light / `#09090B` dark)
  - Card / Panel surface: `bg-surface` (`#FFFFFF` light / `#121215` dark) with `border border-primary` (`#E5E7EB` light / `#27272A` dark)
  - Subtle hover row/button: `hover:bg-surface-hover` (`#F3F4F6` light / `#1E1E22` dark)
- **Elevation:** Flat-first design. Rely on `1px` borders rather than heavy shadows; reserve `shadow-lg` exclusively for floating overlays (`Popover`, `Menu`, `Dialog`).

## 2. Core Primitives in `packages/ui`
Reuse these primitives instead of writing raw HTML/Tailwind boilerplate:
- **Layout:** `Card`, `Section`, `DetailRow`, `ActionRow`, `Disclosure`
- **Navigation & Controls:** `Tabs`, `SegmentedControl`, `Menu`, `Popover`, `Tooltip`
- **Forms:** `MoneyField`, `CategorySelect`, `MerchantSelect`, `TagSelect`, `IconPicker`, `Toggle`, `SearchInput`
- **Data Display:** `DataTable` (supports bulk selection checkboxes & `j`/`k` keyboard row navigation), `Pill` (10% tinted background badge), `Sparkline` (mini SVG trend), `ProgressRing`, `EmptyState`
- **Overlays:** `Dialog` (centered confirmation/form), `SlideOverDrawer` (right-hand inspection drawer for transaction/account details), `ConfirmDialog`

## 3. Interaction & Accessibility Rules
- Every interactive icon-only button must include an `aria-label` and `<Tooltip />`.
- All modals, drawers, and popovers must trap focus and close on `Escape`.
- Tables displaying financial lists must support keyboard navigation (`ArrowDown`/`j`, `ArrowUp`/`k`, `Enter` to open detail drawer).