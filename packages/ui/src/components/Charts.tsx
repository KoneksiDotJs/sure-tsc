import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export function useContainerWidth(defaultWidth = 640): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(defaultWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const next = Math.round(entry.contentRect.width);
          if (next > 0) setWidth(next);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return [ref, width];
}

export interface AreaChartPoint {
  date: string;
  value: number;
  comparisonValue?: number;
}

export interface ResponsiveAreaChartProps {
  data: AreaChartPoint[];
  height?: number;
  color?: string;
  comparisonColor?: string;
  formatValue?: (value: number) => string;
  primaryLabel?: string;
  comparisonLabel?: string;
  showDateAxis?: boolean;
}

function formatShortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * <ResponsiveAreaChart /> — Container-responsive SVG line/area chart using ResizeObserver
 * with smooth gradient fill, optional comparison curve, date axis, and interactive hover crosshair.
 */
export const ResponsiveAreaChart: React.FC<ResponsiveAreaChartProps> = ({
  data,
  height = 175,
  color = '#078C52',
  comparisonColor = '#9ca3af',
  formatValue = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
  primaryLabel = 'Current',
  comparisonLabel = 'Prior',
  showDateAxis = true,
}) => {
  const [containerRef, width] = useContainerWidth(640);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, '');

  const normalizedData = useMemo(() => {
    if (data.length === 0) return [];
    if (data.length === 1) return [data[0]!, data[0]!];
    return data;
  }, [data]);

  const allValues = useMemo(() => {
    const vals: number[] = [];
    for (const p of normalizedData) {
      vals.push(p.value);
      if (typeof p.comparisonValue === 'number') vals.push(p.comparisonValue);
    }
    return vals;
  }, [normalizedData]);

  const padX = 6;
  const padTop = 12;
  const padBottom = 10;
  const plotW = Math.max(120, width - padX * 2);
  const plotH = Math.max(60, height - padTop - padBottom);

  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 0;
  const span = maxVal - minVal || Math.max(Math.abs(maxVal) * 0.1, 1);

  const coords = useMemo(() => {
    return normalizedData.map((pt, idx) => {
      const x = padX + (idx / Math.max(1, normalizedData.length - 1)) * plotW;
      const y = padTop + plotH - ((pt.value - minVal) / span) * plotH;
      const cy =
        typeof pt.comparisonValue === 'number'
          ? padTop + plotH - ((pt.comparisonValue - minVal) / span) * plotH
          : undefined;
      return { x, y, cy, pt };
    });
  }, [normalizedData, plotW, plotH, minVal, span]);

  if (coords.length === 0) return null;

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPolygon = `${padX},${padTop + plotH} ${polyline} ${(padX + plotW).toFixed(1)},${padTop + plotH}`;

  const hasComparison = coords.some((c) => typeof c.cy === 'number');
  const comparisonPolyline = hasComparison
    ? coords
        .filter((c): c is typeof c & { cy: number } => typeof c.cy === 'number')
        .map((c) => `${c.x.toFixed(1)},${c.cy.toFixed(1)}`)
        .join(' ')
    : '';

  const activePoint = hoverIdx !== null ? coords[hoverIdx] : null;
  const startDate = normalizedData[0]?.date;
  const endDate = normalizedData[normalizedData.length - 1]?.date;

  return (
    <div ref={containerRef} className="w-full relative select-none">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(160, width)} ${height}`}
        className="overflow-visible block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = Math.max(0, Math.min(plotW, e.clientX - rect.left - padX));
          const idx = Math.round((relX / Math.max(1, plotW)) * (coords.length - 1));
          setHoverIdx(Math.max(0, Math.min(coords.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`area-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => {
          const gy = padTop + plotH * ratio;
          return (
            <line
              key={ratio}
              x1={padX}
              x2={padX + plotW}
              y1={gy}
              y2={gy}
              stroke="var(--border-primary)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          );
        })}

        {hasComparison && (
          <polyline
            fill="none"
            stroke={comparisonColor}
            strokeWidth="1.75"
            strokeDasharray="4 3"
            points={comparisonPolyline}
          />
        )}

        <polygon points={areaPolygon} fill={`url(#area-grad-${gradId})`} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />

        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padTop}
              y2={padTop + plotH}
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4.5"
              fill={color}
              stroke="var(--bg-surface)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute top-1 z-20 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 shadow-md text-xs"
          style={{
            left: `${Math.min(Math.max(activePoint.x, 70), Math.max(70, width - 160))}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-mono-tabular text-[10px] text-[var(--text-secondary)]">
            {formatShortDate(activePoint.pt.date)}
          </div>
          <div className="font-mono-tabular font-semibold text-[var(--text-primary)]">
            {primaryLabel}: {formatValue(activePoint.pt.value)}
          </div>
          {typeof activePoint.pt.comparisonValue === 'number' && (
            <div className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
              {comparisonLabel}: {formatValue(activePoint.pt.comparisonValue)}
            </div>
          )}
        </div>
      )}

      {showDateAxis && startDate && endDate && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono-tabular">
          <span>{formatShortDate(startDate)}</span>
          <span>{formatShortDate(endDate)}</span>
        </div>
      )}
    </div>
  );
};

export interface SankeyFlowItem {
  name: string;
  color: string;
  amount: string;
  numericValue: number;
  formattedAmount: string;
}

export interface CashflowSankeyChartProps {
  incomeNodes: SankeyFlowItem[];
  outflowNodes: SankeyFlowItem[];
  totalInflowFormatted: string;
  height?: number;
}

/**
 * <CashflowSankeyChart /> — Container-responsive SVG Sankey flow diagram matching Sure's Dashboard
 * Cashflow card: proportional vertical bars, smooth cubic-bezier ribbons, and interactive hover focus.
 */
export const CashflowSankeyChart: React.FC<CashflowSankeyChartProps> = ({
  incomeNodes,
  outflowNodes,
  totalInflowFormatted,
  height = 290,
}) => {
  const [containerRef, width] = useContainerWidth(720);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const chartW = Math.max(320, width);
  const padY = 16;
  const usableH = height - padY * 2;
  const barW = chartW < 480 ? 8 : 11;

  const leftX = 8;
  const centerX = Math.round(chartW * 0.44);
  const rightX = chartW - barW - 8;

  const totalIncome = Math.max(
    incomeNodes.reduce((acc, n) => acc + Math.max(0, n.numericValue), 0),
    1
  );
  const totalOutflow = Math.max(
    outflowNodes.reduce((acc, n) => acc + Math.max(0, n.numericValue), 0),
    1
  );
  const baseTotal = Math.max(totalIncome, totalOutflow);

  const layoutColumn = (items: SankeyFlowItem[], prefix: string) => {
    const gap = items.length > 1 ? 8 : 0;
    const availH = Math.max(40, usableH - gap * Math.max(0, items.length - 1));
    let cursorY = padY;
    return items.map((item) => {
      const frac = Math.max(0, item.numericValue) / baseTotal;
      const nodeH = Math.max(10, Math.round(frac * availH));
      const node = {
        ...item,
        key: `${prefix}-${item.name}`,
        y: cursorY,
        h: nodeH,
        midY: cursorY + nodeH / 2,
      };
      cursorY += nodeH + gap;
      return node;
    });
  };

  const leftLayout = useMemo(
    () => layoutColumn(incomeNodes, 'in'),
    [incomeNodes, baseTotal, usableH]
  );
  const rightLayout = useMemo(
    () => layoutColumn(outflowNodes, 'out'),
    [outflowNodes, baseTotal, usableH]
  );

  const centerHeight = Math.max(
    40,
    leftLayout.reduce((s, n) => s + n.h, 0),
    rightLayout.reduce((s, n) => s + n.h, 0)
  );
  const centerTop = Math.max(padY, Math.round((height - centerHeight) / 2));

  let leftCenterOffset = centerTop;
  let rightCenterOffset = centerTop;

  const compact = chartW < 520;

  return (
    <div ref={containerRef} className="w-full relative select-none overflow-hidden">
      <svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`} className="block">
        {/* Left Income -> Center Hub Ribbons */}
        {leftLayout.map((node) => {
          const segH = Math.max(4, (Math.max(0, node.numericValue) / totalIncome) * centerHeight);
          const cY0 = leftCenterOffset;
          const cY1 = cY0 + segH;
          leftCenterOffset = cY1;

          const x0 = leftX + barW;
          const x1 = centerX;
          const cx0 = x0 + (x1 - x0) * 0.48;
          const cx1 = x0 + (x1 - x0) * 0.52;
          const d = `M ${x0},${node.y} C ${cx0},${node.y} ${cx1},${cY0} ${x1},${cY0} L ${x1},${cY1} C ${cx1},${cY1} ${cx0},${node.y + node.h} ${x0},${node.y + node.h} Z`;
          const dimmed = hoveredKey !== null && hoveredKey !== node.key;

          return (
            <path
              key={node.key}
              d={d}
              fill={node.color}
              fillOpacity={dimmed ? 0.08 : hoveredKey === node.key ? 0.34 : 0.16}
              className="transition-opacity cursor-pointer"
              onMouseEnter={() => setHoveredKey(node.key)}
              onMouseLeave={() => setHoveredKey(null)}
            />
          );
        })}

        {/* Center Hub -> Right Outflow/Surplus Ribbons */}
        {rightLayout.map((node) => {
          const segH = Math.max(
            4,
            (Math.max(0, node.numericValue) / Math.max(totalOutflow, totalIncome)) * centerHeight
          );
          const cY0 = rightCenterOffset;
          const cY1 = cY0 + segH;
          rightCenterOffset = cY1;

          const x0 = centerX + barW;
          const x1 = rightX;
          const cx0 = x0 + (x1 - x0) * 0.48;
          const cx1 = x0 + (x1 - x0) * 0.52;
          const d = `M ${x0},${cY0} C ${cx0},${cY0} ${cx1},${node.y} ${x1},${node.y} L ${x1},${node.y + node.h} C ${cx1},${node.y + node.h} ${cx0},${cY1} ${x0},${cY1} Z`;
          const dimmed = hoveredKey !== null && hoveredKey !== node.key;

          return (
            <path
              key={node.key}
              d={d}
              fill={node.color}
              fillOpacity={dimmed ? 0.08 : hoveredKey === node.key ? 0.34 : 0.16}
              className="transition-opacity cursor-pointer"
              onMouseEnter={() => setHoveredKey(node.key)}
              onMouseLeave={() => setHoveredKey(null)}
            />
          );
        })}

        {/* Left Income Bars & Labels */}
        {leftLayout.map((node) => (
          <g
            key={`${node.key}-bar`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredKey(node.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <rect
              x={leftX}
              y={node.y}
              width={barW}
              height={node.h}
              rx="4"
              fill={node.color}
            />
            <text
              x={leftX + barW + 8}
              y={node.midY - 2}
              fontSize={compact ? '10' : '11.5'}
              fontWeight="600"
              fill="var(--text-primary)"
            >
              {node.name}
            </text>
            <text
              x={leftX + barW + 8}
              y={node.midY + 11}
              fontSize={compact ? '9.5' : '10.5'}
              fontFamily="var(--font-mono)"
              fill="var(--text-secondary)"
            >
              {node.formattedAmount}
            </text>
          </g>
        ))}

        {/* Center Cash Flow Spine */}
        <rect
          x={centerX}
          y={centerTop}
          width={barW}
          height={centerHeight}
          rx="4"
          fill="#078C52"
        />
        <text
          x={centerX + barW + 8}
          y={centerTop + centerHeight / 2 - 2}
          fontSize={compact ? '10' : '11.5'}
          fontWeight="600"
          fill="var(--text-primary)"
        >
          Cash Flow
        </text>
        <text
          x={centerX + barW + 8}
          y={centerTop + centerHeight / 2 + 11}
          fontSize={compact ? '9.5' : '10.5'}
          fontFamily="var(--font-mono)"
          fill="var(--text-secondary)"
        >
          {totalInflowFormatted}
        </text>

        {/* Right Outflow/Surplus Bars & Labels */}
        {rightLayout.map((node) => (
          <g
            key={`${node.key}-bar`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredKey(node.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <rect
              x={rightX}
              y={node.y}
              width={barW}
              height={node.h}
              rx="4"
              fill={node.color}
            />
            <text
              x={rightX - 8}
              y={node.midY - 2}
              textAnchor="end"
              fontSize={compact ? '10' : '11.5'}
              fontWeight="600"
              fill="var(--text-primary)"
            >
              {node.name}
            </text>
            <text
              x={rightX - 8}
              y={node.midY + 11}
              textAnchor="end"
              fontSize={compact ? '9.5' : '10.5'}
              fontFamily="var(--font-mono)"
              fill="var(--text-secondary)"
            >
              {node.formattedAmount}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export interface DonutSlice {
  id: string;
  label: string;
  color: string;
  value: number;
  weightPercent: string;
}

export interface OutflowsDonutChartProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue: React.ReactNode;
  activeId?: string | null;
  onHoverChange?: (id: string | null) => void;
  size?: number;
}

/**
 * <OutflowsDonutChart /> — Interactive SVG ring donut matching Sure's Outflows widget.
 */
export const OutflowsDonutChart: React.FC<OutflowsDonutChartProps> = ({
  slices,
  centerLabel = 'Total Outflows',
  centerValue,
  activeId,
  onHoverChange,
  size = 216,
}) => {
  const strokeW = 10;
  const radius = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;

  let cumulativeOffset = 0;
  const gapPx = slices.length > 1 ? 4 : 0;

  return (
    <div
      className="relative inline-flex items-center justify-center mx-auto"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {slices.length === 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--border-primary)"
            strokeWidth={strokeW}
          />
        ) : (
          slices.map((slice) => {
            const rawLen = (Math.max(0, slice.value) / total) * circumference;
            const dashLen = Math.max(2, rawLen - gapPx);
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += rawLen;
            const isDimmed = Boolean(activeId && activeId !== slice.id);
            const isActive = activeId === slice.id;

            return (
              <circle
                key={slice.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isActive ? strokeW + 3 : strokeW}
                strokeDasharray={`${dashLen} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                opacity={isDimmed ? 0.35 : 1}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => onHoverChange?.(slice.id)}
                onMouseLeave={() => onHoverChange?.(null)}
              />
            );
          })
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {centerLabel}
        </span>
        <div className="mt-0.5 text-2xl font-medium tracking-tight text-[var(--text-primary)]">
          {centerValue}
        </div>
      </div>
    </div>
  );
};

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
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.income, d.expenses])
  );

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
