import React, { useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Button } from './Layout.js';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
    >
      <div
        className={`w-full ${maxWidthClass} rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] shadow-lg overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-primary)] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    maxWidthClass="max-w-md"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm text-[var(--text-secondary)]">{description}</p>
  </Dialog>
);

export interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * <SlideOverDrawer /> — Right-anchored drawer (`max-w-lg`) for inspecting and editing transaction details,
 * splits, attachments, and audit logs without losing scroll position in `<DataTable />`.
 */
export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg h-full bg-[var(--bg-surface)] border-l border-[var(--border-primary)] shadow-lg flex flex-col justify-between"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-5">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-primary)] flex items-center justify-between">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface AlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  action,
}) => {
  const styles = {
    info: {
      tint: 'rgba(59, 130, 246, 0.12)',
      color: 'var(--status-info)',
      icon: <Info className="w-3.5 h-3.5 shrink-0" />,
    },
    warning: {
      tint: 'rgba(245, 158, 11, 0.12)',
      color: 'var(--status-warning)',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    },
    error: {
      tint: 'rgba(226, 64, 86, 0.12)',
      color: 'var(--status-negative)',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    success: {
      tint: 'rgba(7, 140, 82, 0.12)',
      color: 'var(--status-positive)',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
  }[variant];

  return (
    <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)]">
      <div className="flex items-start gap-3">
        <span
          style={{ backgroundColor: styles.tint, color: styles.color }}
          className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5"
        >
          {styles.icon}
        </span>
        <div>
          {title && (
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {title}
            </div>
          )}
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
