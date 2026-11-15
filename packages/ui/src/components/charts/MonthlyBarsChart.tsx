import React, { useState } from 'react';
import { useContainerWidth } from './useContainerWidth.js';

export interface MonthlyBarDatum {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  incomeFormatted: string;
  expensesFormatted: string;
}

export interface MonthlyBarsChartProps {
  data: MonthlyBarDatum[];
  height?: number;
}

/**
 * <MonthlyBarsChart /> — Container-responsive grouped bar chart for Sure's Money In / Out widget.
 */
export const MonthlyBarsChart: React.FC<MonthlyBarsChartProps> = ({
  data,
  height = 165,
}) => {
  const [containerRef, width] = useContainerWidth(480);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartW = Math.max(240, width);
  const padTop = 10;
  const padBottom = 26;
  const plotH = Math.max(60, height - padTop - padBottom);
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));

  const colW = chartW / Math.max(1, data.length);
  const barW = Math.max(8, Math.min(20, Math.floor(colW * 0.28)));
  const activeDatum = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div ref={containerRef} className="w-full relative select-none">
      <svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`} className="block">
        {data.map((d, idx) => {
          const cx = colW * idx + colW / 2;
          const incH = Math.max(d.income > 0 ? 4 : 2, (d.income / maxVal) * plotH);
          const expH = Math.max(d.expenses > 0 ? 4 : 2, (d.expenses / maxVal) * plotH);
          const incY = padTop + plotH - incH;
          const expY = padTop + plotH - expH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={d.monthKey}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <rect
                x={colW * idx + 2}
                y={padTop}
                width={colW - 4}
                height={plotH}
                rx="6"
                fill="var(--bg-surface-hover)"
                opacity={isHovered ? 0.45 : 0}
              />
              <rect
                x={cx - barW - 2}
                y={incY}
                width={barW}
                height={incH}
                rx="4"
                fill="#078C52"
                opacity={hoveredIdx !== null && !isHovered ? 0.5 : 1}
              />
              <rect
                x={cx + 2}
                y={expY}
                width={barW}
                height={expH}
                rx="4"
                fill="var(--text-muted)"
                opacity={hoveredIdx !== null && !isHovered ? 0.35 : 0.65}
              />
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight={isHovered ? '600' : '400'}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {activeDatum && hoveredIdx !== null && (
        <div
          className="pointer-events-none absolute top-0 z-20 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 shadow-md text-xs"
          style={{
            left: `${Math.min(Math.max(colW * hoveredIdx + colW / 2, 70), Math.max(70, chartW - 90))}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-[var(--text-primary)]">{activeDatum.label}</div>
          <div className="font-mono-tabular text-[11px] text-[var(--status-positive)]">
            In: {activeDatum.incomeFormatted}
          </div>
          <div className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
            Out: {activeDatum.expensesFormatted}
          </div>
        </div>
      )}
    </div>
  );
};
