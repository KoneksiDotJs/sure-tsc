import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  const base =
    'focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] hover:opacity-90 border border-transparent',
    secondary:
      'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent',
    destructive:
      'bg-[var(--status-negative)] text-white hover:opacity-90 border border-transparent',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'text-xs px-2.5 py-1.5 h-7',
    md: 'text-sm px-3.5 py-2 h-9',
    lg: 'text-base px-4 py-2.5 h-11',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  padding = 'md',
  className = '',
  children,
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
  };

  return (
    <div
      className={`rounded-xl bg-[var(--bg-surface)] shadow-[var(--shadow-border-xs)] ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-[var(--text-primary)] leading-7">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={paddings[padding]}>{children}</div>
    </div>
  );
};

export interface SectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  action,
  collapsible = false,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? 'Collapse section' : 'Expand section'}
              className="p-1 rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]"
            >
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
            {description && (
              <p className="text-sm text-[var(--text-secondary)]">{description}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {(!collapsible || open) && <div>{children}</div>}
    </section>
  );
};

export interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
}

export const DetailRow: React.FC<DetailRowProps> = ({
  label,
  value,
  icon,
  description,
}) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-primary)] last:border-b-0">
    <div className="flex items-center gap-2.5">
      {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
      <div>
        <div className="text-sm font-medium text-[var(--text-secondary)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--text-muted)]">{description}</div>
        )}
      </div>
    </div>
    <div className="text-sm font-medium text-[var(--text-primary)]">{value}</div>
  </div>
);

export interface ActionRowProps {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export const ActionRow: React.FC<ActionRowProps> = ({
  label,
  description,
  icon,
  trailing,
  onClick,
}) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(e) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    }}
    className={`flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface)] ${
      onClick ? 'hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors' : ''
    }`}
  >
    <div className="flex items-center gap-3">
      {icon && <span className="text-[var(--text-secondary)]">{icon}</span>}
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--text-secondary)]">{description}</div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      {trailing ?? (onClick && <ChevronRight className="w-4 h-4" />)}
    </div>
  </div>
);

export interface DisclosureProps {
  title: React.ReactNode;
  persistKey?: string;
  defaultOpen?: boolean;
  rightElement?: React.ReactNode;
  children: React.ReactNode;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  persistKey,
  defaultOpen = true,
  rightElement,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(() => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(`sure:disclosure:${persistKey}`);
        if (stored !== null) return stored === 'true';
      } catch {
        // Ignore
      }
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`sure:disclosure:${persistKey}`, String(open));
      } catch {
        // Ignore
      }
    }
  }, [open, persistKey]);

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-hover)] cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title}
        </div>
        {rightElement && <div>{rightElement}</div>}
      </div>
      {open && <div className="p-4 border-t border-[var(--border-primary)]">{children}</div>}
    </div>
  );
};
