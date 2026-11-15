import React from 'react';
import { Split, Trash2 } from 'lucide-react';
import {
  Button,
  CategorySelect,
  MerchantSelect,
  MoneyAmount,
  MoneyField,
  SlideOverDrawer,
  TagSelect,
  Toggle,
} from '@sure/ui';
import type { WebCategory, WebEntry, WebMerchant, WebTag } from '../../../lib/ledger-context.js';

interface EntryInspectorDrawerProps {
  activeEntry: WebEntry | null;
  categories: WebCategory[];
  merchants: WebMerchant[];
  tags: WebTag[];
  onClose: () => void;
  onUpdateEntry: (id: string, patch: Partial<WebEntry>) => Promise<void> | void;
  onDeleteEntry: (id: string) => Promise<void> | void;
  onCreateCategory: (name: string) => Promise<WebCategory>;
  onCreateMerchant: (name: string) => Promise<WebMerchant>;
  onCreateTag: (name: string) => Promise<WebTag>;
  onOpenSplits: (entry: WebEntry) => void;
}

export const EntryInspectorDrawer: React.FC<EntryInspectorDrawerProps> = ({
  activeEntry,
  categories,
  merchants,
  tags,
  onClose,
  onUpdateEntry,
  onDeleteEntry,
  onCreateCategory,
  onCreateMerchant,
  onCreateTag,
  onOpenSplits,
}) => (
  <SlideOverDrawer
    open={Boolean(activeEntry)}
    onClose={onClose}
    title={activeEntry?.name ?? 'Inspect Entry'}
    subtitle={
      activeEntry
        ? `${activeEntry.entryType} • ${activeEntry.date} • ID: ${activeEntry.id}`
        : ''
    }
    footer={
      activeEntry && (
        <>
          <Button
            variant="destructive"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => {
              void onDeleteEntry(activeEntry.id);
              onClose();
            }}
          >
            Delete Entry
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      )
    }
  >
    {activeEntry && (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Payee / Entry Name
          </label>
          <input
            type="text"
            value={activeEntry.name}
            onChange={(e) => void onUpdateEntry(activeEntry.id, { name: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>

        <MoneyField
          label="Amount (Inline arithmetic supported, e.g. -120.50 - 30.25)"
          value={activeEntry.amount}
          onChange={(val) => void onUpdateEntry(activeEntry.id, { amount: val })}
          currency={activeEntry.currency}
        />

        {activeEntry.entryType === 'TRANSACTION' && (
          <>
            <CategorySelect
              label="Category"
              options={categories}
              value={activeEntry.categoryId}
              onChange={(categoryId) => void onUpdateEntry(activeEntry.id, { categoryId })}
              onCreateNew={async (name) => {
                const created = await onCreateCategory(name);
                await onUpdateEntry(activeEntry.id, { categoryId: created.id });
              }}
            />

            <MerchantSelect
              label="Merchant"
              options={merchants}
              value={activeEntry.merchantId}
              onChange={(merchantId) => void onUpdateEntry(activeEntry.id, { merchantId })}
              onCreateNew={async (name) => {
                const created = await onCreateMerchant(name);
                await onUpdateEntry(activeEntry.id, { merchantId: created.id });
              }}
            />

            <TagSelect
              label="Tags"
              options={tags}
              selectedIds={activeEntry.tagIds}
              onChange={(tagIds) => void onUpdateEntry(activeEntry.id, { tagIds })}
              onCreateNew={async (name) => {
                const created = await onCreateTag(name);
                await onUpdateEntry(activeEntry.id, {
                  tagIds: [...activeEntry.tagIds, created.id],
                });
              }}
            />

            <div className="pt-2 border-t border-[var(--border-primary)]">
              <Toggle
                checked={activeEntry.excluded}
                onChange={(excluded) => void onUpdateEntry(activeEntry.id, { excluded })}
                label="Exclude from Budgets & Income Reports"
                description="Internal transfers or one-off pass-through items"
              />
            </div>

            <div className="pt-2 border-t border-[var(--border-primary)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Split Transaction ({activeEntry.splits.length})
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Split className="w-3.5 h-3.5" />}
                  onClick={() => onOpenSplits(activeEntry)}
                >
                  Configure Splits
                </Button>
              </div>
              {activeEntry.splits.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-xs rounded-md bg-[var(--bg-surface-subtle)]"
                >
                  <span>{s.name}</span>
                  <MoneyAmount value={s.amount} currency={activeEntry.currency} />
                </div>
              ))}
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Notes & Audit Memo
          </label>
          <textarea
            rows={3}
            value={activeEntry.notes}
            onChange={(e) => void onUpdateEntry(activeEntry.id, { notes: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
        </div>
      </div>
    )}
  </SlideOverDrawer>
);
