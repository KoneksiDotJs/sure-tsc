import React from 'react';
import { ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CashflowSankeyChart, Pill, type SankeyFlowItem } from '@sure/ui';

interface CashflowSankeyCardProps {
  open: boolean;
  expanded: boolean;
  onToggleOpen: () => void;
  onToggleExpanded: () => void;
  savingsRateLabel: string;
  incomeNodes: SankeyFlowItem[];
  outflowNodes: SankeyFlowItem[];
  totalInflowFormatted: string;
}

export const CashflowSankeyCard: React.FC<CashflowSankeyCardProps> = ({
  open,
  expanded,
  onToggleOpen,
  onToggleExpanded,
  savingsRateLabel,
  incomeNodes,
  outflowNodes,
  totalInflowFormatted,
}) => (
  <Card padding="none">
    <div className="px-5 py-3.5 flex items-center justify-between">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center gap-2 text-left cursor-pointer"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
        <span className="text-sm font-semibold text-[var(--text-primary)]">Cashflow</span>
      </button>

      <div className="flex items-center gap-2">
        <Pill label={savingsRateLabel} color="#078C52" size="xs" />
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Compact cashflow height' : 'Expand cashflow height'}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>

    {open && (
      <div className="px-5 pb-5 pt-2 border-t border-[var(--border-primary)]">
        {incomeNodes.length === 0 && outflowNodes.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
            Record income and expense transactions to visualize your cashflow streams.
          </div>
        ) : (
          <CashflowSankeyChart
            incomeNodes={incomeNodes}
            outflowNodes={outflowNodes}
            totalInflowFormatted={totalInflowFormatted}
            height={expanded ? 380 : 270}
          />
        )}
      </div>
    )}
  </Card>
);
