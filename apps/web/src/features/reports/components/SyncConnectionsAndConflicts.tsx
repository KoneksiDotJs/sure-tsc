import React from 'react';
import { Check, Plug, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  DetailRow,
  Dialog,
  MoneyAmount,
  Pill,
  Section,
} from '@sure/ui';

export interface StagingConflictItem {
  id: string;
  conflictType: string;
  resolved: boolean;
  resolution?: string;
  providerName: string;
  amount: string;
  name: string;
  accountName: string;
  date: string;
}

export interface SyncConnectionItem {
  id: string;
  institutionName: string;
  providerName: string;
  lastSyncedAt?: string | null;
  status: string;
}

export interface SyncAdapterItem {
  key: string;
  name: string;
  category: string;
}

interface SyncConnectionsAndConflictsProps {
  baseCurrency: string;
  syncBanner: string | null;
  onDismissBanner: () => void;
  conflicts: StagingConflictItem[];
  onResolveConflict: (
    id: string,
    resolution: 'MERGE_INTO_EXISTING' | 'KEEP_BOTH' | 'DISCARD_INCOMING',
  ) => Promise<void> | void;
  syncConnections: SyncConnectionItem[];
  adapterCategories: Record<string, SyncAdapterItem[]>;
  syncAdapters: SyncAdapterItem[];
  connectOpen: boolean;
  onOpenConnect: () => void;
  onCloseConnect: () => void;
  onSyncAll: () => Promise<void> | void;
  onDeleteConnection: (connectionId: string) => Promise<void> | void;
  selectedAdapterKey: string;
  onChangeAdapterKey: (key: string) => void;
  institutionName: string;
  onChangeInstitutionName: (name: string) => void;
  onConnectSubmit: (e: React.FormEvent) => Promise<void> | void;
}

export const SyncConnectionsAndConflicts: React.FC<SyncConnectionsAndConflictsProps> = ({
  baseCurrency,
  syncBanner,
  onDismissBanner,
  conflicts,
  onResolveConflict,
  syncConnections,
  adapterCategories,
  syncAdapters,
  connectOpen,
  onOpenConnect,
  onCloseConnect,
  onSyncAll,
  onDeleteConnection,
  selectedAdapterKey,
  onChangeAdapterKey,
  institutionName,
  onChangeInstitutionName,
  onConnectSubmit,
}) => (
  <>
    <Section
      title="External Provider Adapters & FinanceKit Staging (FR-6.1 & FR-6.2)"
      description="Connect banking/crypto/brokerage adapters, run syncs, and resolve duplicate or unmapped staging conflicts"
    >
      {syncBanner && (
        <Alert
          variant="success"
          title="Sync Complete"
          action={
            <Button size="sm" variant="secondary" onClick={onDismissBanner}>
              Dismiss
            </Button>
          }
        >
          {syncBanner}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`FinanceKit Conflict Queue (${conflicts.length})`}>
          {conflicts.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
              No unresolved FinanceKit staging conflicts.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-primary)]">
              {conflicts.map((conf) => (
                <div key={conf.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill
                        label={conf.conflictType}
                        color={conf.resolved ? '#10b981' : '#f59e0b'}
                      />
                      <span className="text-xs text-[var(--text-secondary)]">
                        {conf.providerName}
                      </span>
                    </div>
                    <MoneyAmount
                      value={conf.amount}
                      currency={baseCurrency}
                      className="text-sm font-bold"
                    />
                  </div>
                  <div className="text-sm font-medium">
                    {conf.name} ({conf.accountName} • {conf.date})
                  </div>
                  {conf.resolved ? (
                    <div className="text-xs text-[var(--status-positive)] flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5" /> Resolved ({conf.resolution})
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void onResolveConflict(conf.id, 'MERGE_INTO_EXISTING')}
                      >
                        Merge Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void onResolveConflict(conf.id, 'KEEP_BOTH')}
                      >
                        Keep Both
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onResolveConflict(conf.id, 'DISCARD_INCOMING')}
                      >
                        Discard
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={`Provider Connections (${syncConnections.length}) & Catalog`}
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={onOpenConnect}
              >
                Connect
              </Button>
              <Button
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => void onSyncAll()}
              >
                Sync All
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {syncConnections.length > 0 && (
              <div className="divide-y divide-[var(--border-primary)] rounded-lg border border-[var(--border-primary)] px-3">
                {syncConnections.map((conn) => (
                  <DetailRow
                    key={conn.id}
                    icon={<Plug className="w-4 h-4 text-[var(--status-positive)]" />}
                    label={conn.institutionName}
                    description={`Adapter: ${conn.providerName} • Last sync: ${
                      conn.lastSyncedAt ? conn.lastSyncedAt.slice(0, 16).replace('T', ' ') : 'Pending'
                    }`}
                    value={
                      <div className="flex items-center gap-2">
                        <Pill label={conn.status} color="#10b981" />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${conn.institutionName}`}
                          onClick={() => void onDeleteConnection(conn.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />
                        </Button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}

            {Object.entries(adapterCategories).map(([cat, list]) => (
              <div key={cat}>
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  {cat.replace('_', ' ')} ({list.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((a) => (
                    <Pill
                      key={a.key}
                      label={a.name}
                      color={
                        cat === 'BANKING'
                          ? '#10b981'
                          : cat === 'CRYPTO'
                          ? '#f59e0b'
                          : '#3b82f6'
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>

    <Dialog
      open={connectOpen}
      onClose={onCloseConnect}
      title="Connect External Financial Provider"
      description="Register a FinanceKit provider connection for scheduled or manual sync."
      footer={
        <>
          <Button variant="secondary" onClick={onCloseConnect}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void onConnectSubmit({ preventDefault: () => {} } as React.FormEvent)
            }
          >
            Save Connection
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void onConnectSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Provider Adapter
          </label>
          <select
            value={selectedAdapterKey}
            onChange={(e) => onChangeAdapterKey(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
          >
            {syncAdapters.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} ({a.category})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Institution Label
          </label>
          <input
            type="text"
            value={institutionName}
            onChange={(e) => onChangeInstitutionName(e.target.value)}
            placeholder="e.g., Chase Private Client, Coinbase Prime"
            className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
          />
        </div>
      </form>
    </Dialog>
  </>
);
