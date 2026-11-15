import React, { useEffect, useMemo, useState } from 'react';
import { Button, CategoryIcon, Dialog, IconPicker, Pill } from '@sure/ui';
import { Info, MoreHorizontal, Plus, Store } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';

const TAG_COLOR_SWATCHES = [
  '#f59e0b',
  '#078C52',
  '#3b82f6',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#f97316',
  '#38bdf8',
  '#6366f1',
  '#10b981',
];

export const TaxonomiesSections: React.FC<{
  activeSection: 'categories' | 'tags' | 'merchants';
  actionTriggerCounter?: { section: string; tick: number } | null;
}> = ({ activeSection, actionTriggerCounter }) => {
  const {
    categories,
    tags,
    merchants,
    entries,
    createCategory,
    createTag,
    createMerchant,
  } = useLedger();

  // Category modal state
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catClass, setCatClass] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [catColor, setCatColor] = useState('#078C52');
  const [catIcon, setCatIcon] = useState('Tag');

  // Tag modal state
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#ef4444');

  // Merchant modal state
  const [newMerchantOpen, setNewMerchantOpen] = useState(false);
  const [merchantName, setMerchantName] = useState('');

  useEffect(() => {
    if (!actionTriggerCounter) return;
    if (actionTriggerCounter.section === 'categories') setNewCatOpen(true);
    if (actionTriggerCounter.section === 'tags') setNewTagOpen(true);
    if (actionTriggerCounter.section === 'merchants') setNewMerchantOpen(true);
  }, [actionTriggerCounter]);

  const categoryUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.categoryId) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const tagUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const tid of e.tagIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const merchantUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.merchantId) counts.set(e.merchantId, (counts.get(e.merchantId) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await createCategory(catName.trim(), catClass, catIcon, catColor);
    setCatName('');
    setNewCatOpen(false);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    await createTag(tagName.trim());
    setTagName('');
    setNewTagOpen(false);
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim()) return;
    await createMerchant(merchantName.trim());
    setMerchantName('');
    setNewMerchantOpen(false);
  };

  return (
    <>
      {activeSection === 'categories' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            CATEGORIES <span className="mx-1">•</span> {categories.length}
          </div>

          {categories.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">No categories created yet.</div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewCatOpen(true)}>
                New category
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)]/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Pill
                      label={cat.name}
                      color={cat.color}
                      icon={
                        <CategoryIcon
                          icon={cat.icon}
                          label={cat.name}
                          color={cat.color}
                          size="xs"
                        />
                      }
                      size="sm"
                    />
                    <span className="text-[11px] text-[var(--text-muted)] uppercase">
                      {cat.classification}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono-tabular">
                      {categoryUsage.get(cat.id) ?? 0} entries
                    </span>
                    <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'tags' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-4 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-primary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            TAGS <span className="mx-1">•</span> {tags.length}
          </div>

          {tags.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">No tags created yet.</div>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewTagOpen(true)}>
                New tag
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface-hover)]/50"
                >
                  <span
                    style={{
                      backgroundColor: `${tag.color || '#10b981'}1A`,
                      color: tag.color || '#10b981',
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tag.color || '#10b981' }}
                    />
                    <span>{tag.name}</span>
                  </span>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="font-mono-tabular">
                      {tagUsage.get(tag.id) ?? 0} entries
                    </span>
                    <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'merchants' && (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-4 space-y-6">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              FAMILY MERCHANTS <span className="mx-1">•</span> {merchants.length}
            </div>

            {merchants.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-sm text-[var(--text-secondary)]">No family merchants yet</div>
                <Button
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setNewMerchantOpen(true)}
                >
                  New merchant
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)] overflow-hidden">
                {merchants.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        icon="Store"
                        label={m.name}
                        color={m.color || '#6366f1'}
                        variant="circle"
                        size="sm"
                      />
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {m.name}
                      </span>
                    </div>
                    <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                      {merchantUsage.get(m.id) ?? 0} transactions
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-[var(--border-primary)]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              PROVIDER MERCHANTS
            </div>
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)]">
              <Info className="w-4 h-4 text-[var(--status-info)] shrink-0 mt-0.5" />
              <span>
                Merchants linked from bank connections or rules can be normalized here so reports and budgets group related charges consistently.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Category */}
      <Dialog
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        title="New category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="flex justify-center py-1">
            <CategoryIcon
              icon={catIcon}
              label={catName || 'Category'}
              color={catColor}
              variant="circle"
              size="md"
            />
          </div>

          <div className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 bg-[var(--bg-surface)]">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
              Name <span className="text-[var(--status-negative)]">*</span>
            </label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface)]">
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
              Classification
            </label>
            <select
              value={catClass}
              onChange={(e) => setCatClass(e.target.value as 'EXPENSE' | 'INCOME')}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>

          <IconPicker
            selectedColor={catColor}
            selectedIcon={catIcon}
            onChangeColor={setCatColor}
            onChangeIcon={setCatIcon}
          />

          <Button type="submit" className="w-full">
            Create Category
          </Button>
        </form>
      </Dialog>

      {/* MODAL: New Tag */}
      <Dialog open={newTagOpen} onClose={() => setNewTagOpen(false)} title="New tag">
        <form onSubmit={handleCreateTag} className="space-y-4">
          <div className="flex justify-center py-1">
            <span
              style={{ backgroundColor: `${tagColor}1A`, color: tagColor }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagColor }} />
              <span>{tagName.trim() || '?'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {TAG_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Select color ${swatch}`}
                onClick={() => setTagColor(swatch)}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  tagColor === swatch ? 'ring-2 ring-offset-2 ring-[var(--accent-primary)] scale-110' : ''
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>

          <input
            type="text"
            required
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />

          <Button type="submit" className="w-full">
            Create Tag
          </Button>
        </form>
      </Dialog>

      {/* MODAL: New Merchant */}
      <Dialog
        open={newMerchantOpen}
        onClose={() => setNewMerchantOpen(false)}
        title="New merchant"
      >
        <form onSubmit={handleCreateMerchant} className="space-y-4">
          <div className="flex justify-center py-1">
            <span className="w-11 h-11 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)]">
              <Store className="w-5 h-5" />
            </span>
          </div>
          <input
            type="text"
            required
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            placeholder="Merchant name (e.g., Whole Foods Market)"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]"
          />
          <Button type="submit" className="w-full">
            Create Merchant
          </Button>
        </form>
      </Dialog>
    </>
  );
};
