import React, { useState, useEffect } from 'react';
import {
  CURRENCY_SYMBOL_MAP,
  evaluateAmountExpression,
  toFixedDecimalString,
} from '@sure/shared';
import { Calculator } from 'lucide-react';

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

  const code = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOL_MAP[code] ?? code;

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
            code
          )}
        </span>
      </div>
      {error && <p className="text-xs text-[var(--status-negative)]">{error}</p>}
    </div>
  );
};
