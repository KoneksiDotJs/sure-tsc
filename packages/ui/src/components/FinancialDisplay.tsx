import React, { useId, useState } from 'react';
import { formatCurrency, isPositiveMoney, isNegativeMoney } from '@sure/shared';
import { usePrivacyMode } from '../context/PrivacyModeContext.js';
import { useLocale } from '../context/LocaleContext.js';

export interface MoneyAmountProps {
  value: string;
  currency?: string;
  locale?: string;
  colorize?: boolean;
  showSign?: boolean;
  className?: string;
}

/**
 * <MoneyAmount /> — Renders currency values in Geist Mono (`tabular-nums`) with optional sign coloring
 * and automatic Privacy Mode blurring (`blur-sm select-none` / `.privacy-blur`).
 */
export const MoneyAmount: React.FC<MoneyAmountProps> = ({
  value,
  currency = 'USD',
  locale,
  colorize = false,
  showSign = false,
  className = '',
}) => {
  const { enabled: privacyEnabled } = usePrivacyMode();
  const { bcp47 } = useLocale();

  let colorClass = 'text-[var(--text-primary)]';
  if (colorize) {
    if (isPositiveMoney(value)) {
      colorClass = 'text-[var(--status-positive)]';
    } else if (isNegativeMoney(value)) {
      colorClass = 'text-[var(--status-negative)]';
    }
  }

  const formatted = formatCurrency(value, currency, {
    showSign,
    locale: locale ?? bcp47,
  });

  return (
    <span
      className={`font-mono-tabular privacy-sensitive ${colorClass} ${
        privacyEnabled ? 'privacy-blur blur-sm select-none' : ''
      } ${className}`}
    >
      {formatted}
    </span>
  );
};

export interface PillProps {
  label: string;
  color?: string;
  icon?: React.ReactNode;
  size?: 'xs' | 'sm';
}

/**
 * <Pill /> — Rounded status/category badge using a 10% tinted background derived from its assigned hex color
 * (`backgroundColor: ${color}1A`, `color`).
 */
export const Pill: React.FC<PillProps> = ({
  label,
  color = '#3b82f6',
  icon,
  size = 'xs',
}) => {
  const isHex = color.startsWith('#') && (color.length === 7 || color.length === 4);
  const bg = isHex ? `${color}1A` : 'var(--bg-surface-subtle)';

  return (
    <span
      style={{
        backgroundColor: bg,
        color,
      }}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap shrink-0 ${
        size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  interactive?: boolean;
  onHoverPoint?: (point: { index: number; value: number } | null) => void;
}

/**
 * <Sparkline /> — Lightweight SVG polyline with gradient area fill for inline 30-day account balance trends.
 * Supports optional interactive hover scrubbing with active point marker.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 36,
  color,
  interactive = false,
  onHoverPoint,
}) => {
  const sparkId = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data.length) return null;

  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;
  const strokeColor =
    color ?? (last >= first ? 'var(--status-positive)' : 'var(--status-negative)');

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coords = data.map((val, idx) => {
    const x = (idx / Math.max(1, data.length - 1)) * width;
    const y = height - 3 - ((val - min) / range) * Math.max(2, height - 6);
    return { x, y, val };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `0,${height} ${polylinePoints} ${width},${height}`;
  const gradId = `spark-grad-${sparkId}`;
  const activeCoord = interactive && hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${interactive ? 'cursor-crosshair' : ''}`}
      onMouseMove={
        interactive
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
              const idx = Math.round((relX / Math.max(1, rect.width)) * (coords.length - 1));
              const safeIdx = Math.max(0, Math.min(coords.length - 1, idx));
              setHoverIdx(safeIdx);
              onHoverPoint?.({ index: safeIdx, value: coords[safeIdx]?.val ?? 0 });
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? () => {
              setHoverIdx(null);
              onHoverPoint?.(null);
            }
          : undefined
      }
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={interactive ? '1.75' : '2'}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {activeCoord && (
        <>
          <line
            x1={activeCoord.x}
            x2={activeCoord.x}
            y1={0}
            y2={height}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle
            cx={activeCoord.x}
            cy={activeCoord.y}
            r="2.75"
            fill={strokeColor}
            stroke="var(--bg-surface)"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
};

export interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

/**
 * <ProgressRing /> — Circular SVG progress indicator used in Goal cards and Budget category rows.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 40,
  strokeWidth = 4,
  color = 'var(--status-positive)',
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border-primary)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-[10px] font-mono-tabular font-semibold text-[var(--text-primary)]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]">
    {icon && (
      <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
        {icon}
      </div>
    )}
    <h4 className="text-base font-semibold text-[var(--text-primary)]">{title}</h4>
    <p className="text-sm text-[var(--text-secondary)] max-w-md mt-1 mb-4">
      {description}
    </p>
    {action && <div>{action}</div>}
  </div>
);
