import React, { useId, useMemo, useState } from 'react';
import { useContainerWidth } from './useContainerWidth.js';

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
