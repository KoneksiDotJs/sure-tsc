import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CategoryIcon, MoneyAmount, OutflowsDonutChart, type DonutSlice } from '@sure/ui';
import type { OutflowCategoryRow } from './useDashboardMetrics.js';

interface OutflowsDonutCardProps {
  open: boolean;
  onToggleOpen: () => void;
  baseCurrency: string;
  outflowCategories: OutflowCategoryRow[];
  donutSlices: DonutSlice[];
  totalOutflowAmount: string;
  hoveredOutflowId: string | null;
  onHoverChange: (id: string | null) => void;
  onNavigateTransactions: () => void;
}

export const OutflowsDonutCard: React.FC<OutflowsDonutCardProps> = ({
  open,
  onToggleOpen,
  baseCurrency,
  outflowCategories,
  donutSlices,
  totalOutflowAmount,
  hoveredOutflowId,
  onHoverChange,
  onNavigateTransactions,
}) => (
  <Card padding="none" className="xl:col-span-5">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
    >
      <div className="flex items-center gap-2">
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
        <span className="text-sm font-semibold text-[var(--text-primary)]">Outflows</span>
      </div>
      <span className="text-xs text-[var(--text-secondary)]">
        {outflowCategories.length} categories
      </span>
    </button>

    {open && (
      <div className="px-5 pb-5 pt-2 border-t border-[var(--border-primary)] space-y-5">
        <div className="flex justify-center pt-1">
          <OutflowsDonutChart
            slices={donutSlices}
            centerLabel="Total Outflows"
            centerValue={<MoneyAmount value={totalOutflowAmount} currency={baseCurrency} />}
            activeId={hoveredOutflowId}
            onHoverChange={onHoverChange}
          />
        </div>

        <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] p-2 space-y-1">
          <div className="grid grid-cols-12 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            <div className="col-span-6">Categories • {outflowCategories.length}</div>
            <div className="col-span-4 text-right">Value</div>
            <div className="col-span-2 text-right">Weight</div>
          </div>

          {outflowCategories.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-lg">
              No outflows in selected period.
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {outflowCategories.map((cat) => {
                const highlighted = hoveredOutflowId === cat.id;
                return (
                  <div
                    key={cat.id}
                    onMouseEnter={() => onHoverChange(cat.id)}
                    onMouseLeave={() => onHoverChange(null)}
                    onClick={onNavigateTransactions}
                    className={`grid grid-cols-12 items-center px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      highlighted
                        ? 'bg-[var(--bg-surface-hover)] ring-1 ring-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                      <CategoryIcon
                        icon={cat.icon}
                        label={cat.name}
                        color={cat.color}
                        variant="circle"
                        size="sm"
                      />
                      <span className="truncate font-medium text-[var(--text-primary)]">
                        {cat.name}
                      </span>
                    </div>
                    <div className="col-span-4 text-right font-mono-tabular font-semibold">
                      <MoneyAmount value={cat.amount} currency={baseCurrency} />
                    </div>
                    <div className="col-span-2 text-right font-mono-tabular text-[var(--text-secondary)]">
                      {cat.weightPercent}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </Card>
);
