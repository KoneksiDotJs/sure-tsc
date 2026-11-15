import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { CategoryIcon } from '../CategoryIcon.js';

export interface SelectOptionItem {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface ComboboxSelectProps {
  label?: string;
  options: SelectOptionItem[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  onCreateNew?: (name: string) => void;
  placeholder?: string;
  defaultIcon?: string;
}

export const CategorySelect: React.FC<ComboboxSelectProps> = ({
  label,
  options,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Select category...',
  defaultIcon,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === query.trim().toLowerCase()
  );

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative space-y-1">
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] text-left cursor-pointer"
      >
        {selected ? (
          <span className="inline-flex items-center gap-2">
            <CategoryIcon
              icon={selected.icon ?? defaultIcon}
              label={selected.name}
              color={selected.color ?? '#3b82f6'}
              variant="circle"
              size="xs"
            />
            <span className="text-[var(--text-primary)]">{selected.name}</span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-2 space-y-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create..."
            className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-primary)] focus:outline-none"
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-md hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon
                    icon={opt.icon ?? defaultIcon}
                    label={opt.name}
                    color={opt.color ?? '#3b82f6'}
                    variant="circle"
                    size="xs"
                  />
                  <span>{opt.name}</span>
                </span>
                {opt.id === value && <Check className="w-3.5 h-3.5 text-[var(--status-positive)]" />}
              </button>
            ))}
            {onCreateNew && query.trim().length > 0 && !exactMatch && (
              <button
                type="button"
                onClick={() => {
                  onCreateNew(query.trim());
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--status-info)] hover:bg-[var(--bg-surface-hover)] rounded-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create &ldquo;{query.trim()}&rdquo;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const MerchantSelect: React.FC<ComboboxSelectProps> = (props) => (
  <CategorySelect
    {...props}
    defaultIcon={props.defaultIcon ?? 'Store'}
    placeholder={props.placeholder ?? 'Select merchant...'}
  />
);

export interface TagSelectProps {
  label?: string;
  options: SelectOptionItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateNew?: (name: string) => void;
}

export const TagSelect: React.FC<TagSelectProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  onCreateNew,
}) => {
  const [query, setQuery] = useState('');

  const toggleTag = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => {
          const active = selectedIds.includes(tag.id);
          const color = tag.color ?? '#10b981';
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              style={{
                backgroundColor: active ? `${color}26` : 'transparent',
                color: active ? color : 'var(--text-secondary)',
                borderColor: active ? color : 'var(--border-primary)',
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer"
            >
              #{tag.name}
            </button>
          );
        })}
      </div>
      {onCreateNew && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="New tag name..."
            className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-primary)]"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(query.trim());
                setQuery('');
              }}
              className="px-2 py-1 text-xs font-medium rounded-md bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
            >
              + Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
};
