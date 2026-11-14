import React, { useState, useRef, useEffect } from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => (
  <div className="flex items-center gap-1 border-b border-[var(--border-primary)]">
    {tabs.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            isActive
              ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] font-mono-tabular">
              {tab.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-[var(--segmented-track)] border border-[var(--border-primary)]"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } font-medium rounded-md whitespace-nowrap transition-colors duration-200 cursor-pointer ${
              active
                ? 'bg-[var(--segmented-active)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--segmented-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs font-medium rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] whitespace-nowrap shadow-lg z-50 pointer-events-none"
        >
          {content}
        </div>
      )}
    </div>
  );
};

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={`absolute mt-1.5 z-50 min-w-[220px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-3 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}

export interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export const Menu: React.FC<MenuProps> = ({ trigger, items, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', onEsc);
      window.addEventListener('mousedown', onOutside);
    }
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('mousedown', onOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`absolute mt-1.5 z-50 min-w-[180px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg p-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors cursor-pointer ${
                item.destructive
                  ? 'text-[var(--status-negative)] hover:bg-[var(--status-negative-bg)]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
