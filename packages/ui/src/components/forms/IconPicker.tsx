import React from 'react';

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
