import React from 'react';
import { Search, X } from 'lucide-react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
}) => (
  <label className="inline-flex items-center justify-between gap-3 cursor-pointer select-none">
    {(label || description) && (
      <div>
        {label && <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>}
        {description && (
          <div className="text-xs text-[var(--text-secondary)]">{description}</div>
        )}
      </div>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
        checked ? 'bg-[var(--status-positive)]' : 'bg-[var(--border-strong)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </label>
);

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcutHint?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search transactions, merchants, notes...',
  shortcutHint = '⌘K',
  className = '',
}) => (
  <div
    className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent-primary)] ${className}`}
  >
    <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 pointer-events-none" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
    />
    {value ? (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange('')}
        className="p-0.5 rounded hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    ) : (
      shortcutHint && (
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono-tabular rounded bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-primary)] shrink-0">
          {shortcutHint}
        </kbd>
      )
    )}
  </div>
);
