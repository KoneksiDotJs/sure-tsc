import React, { useState, useRef, useEffect } from 'react';
import { evaluateAmountExpression, toFixedDecimalString } from '@sure/shared';
import { Search, X, Plus, Check, Calculator } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon.js';

/**
 * <MoneyField /> — Maps to Sure's `money_field_controller.js` + `evaluate_amount_expression.js`
 * Displays currency symbol/code, locale-aware formatting, and inline arithmetic evaluation on blur or Enter.
 * E.g., entering `125000 + 15000 * 2` evaluates to `155000.00` (and emits `"155000.0000"`).
 */
export interface MoneyFieldProps {
  value: string;
  onChange: (decimalString: string) => void;
  currency?: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
}

export const MoneyField: React.FC<MoneyFieldProps> = ({
  value,
  onChange,
  currency = 'USD',
  label,
  placeholder = '0.00',
  error,
  disabled = false,
  id,
}) => {
  const [inputValue, setInputValue] = useState<string>(() => {
    const evaluated = evaluateAmountExpression(value, 2);
    return evaluated ?? value;
  });
  const [previewEval, setPreviewEval] = useState<string | null>(null);

  useEffect(() => {
    const evaluated = evaluateAmountExpression(value, 2);
    if (evaluated !== null) {
      setInputValue(evaluated);
    }
  }, [value]);

  const commitExpression = () => {
    const result2 = evaluateAmountExpression(inputValue, 2);
    const result4 = evaluateAmountExpression(inputValue, 4);
    if (result2 !== null && result4 !== null) {
      setInputValue(result2);
      setPreviewEval(null);
      onChange(toFixedDecimalString(result4, 4));
    }
  };

  const handleInputChange = (raw: string) => {
    setInputValue(raw);
    const hasMathOperator = /[+\-*/()]/.test(raw.replace(/^-/, ''));
    if (hasMathOperator) {
      const preview = evaluateAmountExpression(raw, 2);
      setPreviewEval(preview);
    } else {
      setPreviewEval(null);
      const direct = evaluateAmountExpression(raw, 4);
      if (direct !== null) {
        onChange(direct);
      }
    }
  };

  const symbols: Record<string, string> = {
    USD: '$',
    IDR: 'Rp',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: 'CN¥',
    SGD: 'S$',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF',
  };
  const symbol = symbols[currency.toUpperCase()] ?? currency.toUpperCase();

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-surface)] border ${
          error ? 'border-[var(--status-negative)]' : 'border-[var(--border-strong)]'
        } focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent-primary)]`}
      >
        <span className="text-sm font-mono-tabular text-[var(--text-secondary)] select-none shrink-0">
          {symbol}
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={commitExpression}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitExpression();
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-mono-tabular text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <span className="flex items-center gap-1 text-xs font-mono-tabular text-[var(--text-muted)] shrink-0">
          {previewEval ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-positive)] font-semibold">
              <Calculator className="w-3 h-3" />={previewEval}
            </span>
          ) : (
            currency.toUpperCase()
          )}
        </span>
      </div>
      {error && <p className="text-xs text-[var(--status-negative)]">{error}</p>}
    </div>
  );
};

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

export const SURE_COLOR_SWATCHES = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#6366f1',
  '#14b8a6',
  '#84cc16',
];

export const SURE_ICON_NAMES = [
  'Wallet',
  'CreditCard',
  'TrendingUp',
  'Coins',
  'Home',
  'Car',
  'Landmark',
  'ShoppingBag',
  'Utensils',
  'Plane',
  'Zap',
  'HeartPulse',
  'Briefcase',
  'Target',
];

export interface IconPickerProps {
  selectedColor: string;
  selectedIcon: string;
  onChangeColor: (color: string) => void;
  onChangeIcon: (icon: string) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedColor,
  selectedIcon,
  onChangeColor,
  onChangeIcon,
}) => (
  <div className="space-y-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
    <div>
      <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        Color Swatch
      </div>
      <div className="flex flex-wrap gap-2">
        {SURE_COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`Select color ${hex}`}
            onClick={() => onChangeColor(hex)}
            style={{ backgroundColor: hex }}
            className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
              selectedColor === hex ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] scale-110' : ''
            }`}
          />
        ))}
      </div>
    </div>
    <div>
      <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        Icon Identifier
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SURE_ICON_NAMES.map((iconName) => (
          <button
            key={iconName}
            type="button"
            onClick={() => onChangeIcon(iconName)}
            className={`px-2 py-1 text-xs rounded-md border cursor-pointer ${
              selectedIcon === iconName
                ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] border-transparent'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-primary)]'
            }`}
          >
            {iconName}
          </button>
        ))}
      </div>
    </div>
  </div>
);

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
