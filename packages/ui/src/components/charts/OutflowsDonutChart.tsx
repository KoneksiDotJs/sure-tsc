import React from 'react';

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
