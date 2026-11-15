import React from 'react';
import { Dialog } from '@sure/ui';
import { Settings } from 'lucide-react';
import { NAV_ITEMS, type NavTabId } from './navigation.js';

interface QuickJumpModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTabId) => void;
  onTogglePrivacy: () => void;
}

export const QuickJumpModal: React.FC<QuickJumpModalProps> = ({
  open,
  onClose,
  onNavigate,
  onTogglePrivacy,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Command Palette (⌘K)"
    description="Jump to any financial module or toggle global controls"
  >
    <div className="space-y-1.5">
      {[...NAV_ITEMS, { id: 'settings' as const, label: 'Family & Security', icon: Settings }].map(
        (item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
            >
              <span className="flex items-center gap-2.5 font-medium">
                <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Go to {item.label}</span>
              </span>
              <span className="text-xs font-mono-tabular text-[var(--text-muted)]">Enter</span>
            </button>
          );
        }
      )}
      <button
        type="button"
        onClick={() => {
          onTogglePrivacy();
          onClose();
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-[var(--bg-surface-hover)] text-left cursor-pointer"
      >
        <span className="font-medium">Toggle Global Privacy Mode Blur</span>
        <kbd className="text-xs font-mono-tabular text-[var(--text-muted)]">Shift + P</kbd>
      </button>
    </div>
  </Dialog>
);
