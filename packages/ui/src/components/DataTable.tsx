import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  bulkActionsBar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}

/**
 * <DataTable /> — Maps to `DS::Table` + `bulk_select_controller.js` + `list_keyboard_navigation_controller.js`
 * Supports sticky headers, sortable columns, row selection checkboxes with floating bulk-action bar,
 * and `j`/`k` + `Enter` keyboard navigation.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActionsBar,
  onRowClick,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return data;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, columns, sortKey, sortDir]);

  // Keyboard navigation: j / k / ArrowDown / ArrowUp / Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        if (sortedData.length > 0) {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.min(sortedData.length - 1, prev + 1));
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (sortedData.length > 0) {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === 'Enter' && focusedRowIndex >= 0 && focusedRowIndex < sortedData.length) {
        const row = sortedData[focusedRowIndex];
        if (row && onRowClick) {
          e.preventDefault();
          onRowClick(row);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedData, focusedRowIndex, onRowClick]);

  const allSelected =
    sortedData.length > 0 && sortedData.every((r) => selectedIds.includes(getRowId(r)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedData.map((r) => getRowId(r)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (sortedData.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="relative rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] shadow-[var(--shadow-border-xs)] overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)]">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-[var(--border-strong)] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={col.key}
                    className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] ${alignClass}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSorted) {
                            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortKey(col.key);
                            setSortDir('desc');
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-primary)]">
            {sortedData.map((row, idx) => {
              const id = getRowId(row);
              const isSelected = selectedIds.includes(id);
              const isFocused = idx === focusedRowIndex;

              return (
                <tr
                  key={id}
                  onClick={() => {
                    setFocusedRowIndex(idx);
                    onRowClick?.(row);
                  }}
                  className={`text-sm transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected || isFocused
                      ? 'bg-[var(--bg-surface-hover)]'
                      : 'hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  {selectable && (
                    <td
                      className="px-4 py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${id}`}
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                        className="rounded border-[var(--border-strong)] cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                    return (
                      <td key={col.key} className={`px-4 py-3 ${alignClass}`}>
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectable && selectedIds.length > 0 && bulkActionsBar && (
        <div className="sticky bottom-3 mx-auto w-fit z-20 my-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] shadow-lg flex items-center gap-4">
          <span className="text-xs font-mono-tabular font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">{bulkActionsBar}</div>
        </div>
      )}
    </div>
  );
}
