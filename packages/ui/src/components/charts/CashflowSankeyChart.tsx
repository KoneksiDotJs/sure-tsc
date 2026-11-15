import React, { useMemo, useState } from 'react';
import { useContainerWidth } from './useContainerWidth.js';

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

        {leftLayout.map((node) => (
          <g
            key={`${node.key}-bar`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredKey(node.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <rect x={leftX} y={node.y} width={barW} height={node.h} rx="4" fill={node.color} />
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

        <rect x={centerX} y={centerTop} width={barW} height={centerHeight} rx="4" fill="#078C52" />
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

        {rightLayout.map((node) => (
          <g
            key={`${node.key}-bar`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredKey(node.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <rect x={rightX} y={node.y} width={barW} height={node.h} rx="4" fill={node.color} />
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
