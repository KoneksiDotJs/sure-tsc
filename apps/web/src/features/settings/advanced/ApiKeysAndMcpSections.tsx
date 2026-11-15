import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Dialog, Pill } from '@sure/ui';
import { Check, Copy, Key, Plus, Shield, Terminal } from 'lucide-react';
import { useLedger } from '../../../lib/ledger-context.js';

export const ApiKeysAndMcpSections: React.FC<{
  activeSection: 'api_keys' | 'mcp';
  actionTriggerCounter?: { section: string; tick: number } | null;
}> = ({ activeSection, actionTriggerCounter }) => {
  const { family, createApiKey, deleteApiKey } = useLedger();

  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [keyScopePreset, setKeyScopePreset] = useState<'READ_ONLY' | 'FULL_MCP'>('FULL_MCP');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedMcp, setCopiedMcp] = useState(false);

  useEffect(() => {
    if (actionTriggerCounter?.section === 'api_keys') {
      setNewKeyOpen(true);
    }
  }, [actionTriggerCounter]);

  const handleCreateApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const scopes =
      keyScopePreset === 'READ_ONLY'
        ? ['accounts:read', 'transactions:read']
        : ['accounts:read', 'transactions:read', 'transactions:write', 'mcp:tools'];
    const secret = await createApiKey(newKeyName.trim(), scopes);
    setGeneratedSecret(secret);
    setNewKeyName('');
    setNewKeyOpen(false);
  };

  const mcpUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
    return `${origin}/mcp`;
  }, []);

  return (
    <>
      {activeSection === 'api_keys' && (
        <div className="space-y-4">
          {generatedSecret && (
            <Alert variant="success" title="New Scoped API Key Generated">
              Copy your secret token now (it will not be shown again):{' '}
              <code className="font-mono-tabular font-bold select-all">{generatedSecret}</code>
            </Alert>
          )}

          {family.apiKeys.length === 0 ? (
            <Card>
              <div className="py-10 text-center space-y-3">
                <Key className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                <div className="text-sm font-medium text-[var(--text-primary)]">No API keys created yet</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Create scoped keys to authorize external scripts, CLI tools, or MCP AI clients.
                </div>
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewKeyOpen(true)}>
                  New API Key
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {family.apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Key className="w-4 h-4" />
                    </span>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{k.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        Prefix: <span className="font-mono-tabular">{k.prefix}</span> • Created {k.createdAt.slice(0, 10)}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium"
                          >
                            <Shield className="w-3 h-3" />
                            <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Pill label="• Active" color="#078C52" size="xs" />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void deleteApiKey(k.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'mcp' && (
        <div className="space-y-5">
          <Card
            title="Connect an AI assistant"
            subtitle="Paste this URL into Claude.ai (or any MCP-compatible client) to connect it to your Sure account."
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
                <code className="text-xs font-mono-tabular text-[var(--text-primary)] truncate">
                  {mcpUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(mcpUrl);
                    }
                    setCopiedMcp(true);
                    setTimeout(() => setCopiedMcp(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:opacity-80 cursor-pointer shrink-0"
                >
                  {copiedMcp ? (
                    <Check className="w-3.5 h-3.5 text-[var(--status-positive)]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedMcp ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  How to connect Claude
                </div>
                <ol className="space-y-2 text-xs text-[var(--text-secondary)]">
                  {[
                    'Open Claude.ai and go to Settings → Customize → Connectors.',
                    'Click "Add custom connector" and paste the MCP server URL above.',
                    'Include an API Key (from Advanced → API Keys) in the Authorization Bearer header.',
                    'Once authorized, your AI client can query accounts, transactions, budgets, and goals.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-primary)] shrink-0">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>

          <Card title="Streamable JSON-RPC 2.0 Configuration">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Terminal className="w-4 h-4 text-[var(--status-info)]" />
                <span>Endpoints:</span>
                <Pill label="POST /mcp" color="#3b82f6" size="xs" />
                <Pill label="POST /api/v1/mcp" color="#078C52" size="xs" />
              </div>
              <pre className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] text-xs font-mono-tabular overflow-x-auto">
                {`{
  "mcpServers": {
    "sure-finance": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${generatedSecret ?? 'sure_live_<your_mcp_key>'}"
      }
    }
  }
}`}
              </pre>
            </div>
          </Card>
        </div>
      )}

      <Dialog
        open={newKeyOpen}
        onClose={() => setNewKeyOpen(false)}
        title="New API Key"
        description="Generate a bearer token scoped to this family ledger."
      >
        <form onSubmit={handleCreateApiKeySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Key Name
            </label>
            <input
              type="text"
              required
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Claude Desktop MCP, Analytics Script"
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Permission Scope
            </label>
            <select
              value={keyScopePreset}
              onChange={(e) => setKeyScopePreset(e.target.value as 'READ_ONLY' | 'FULL_MCP')}
              className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            >
              <option value="FULL_MCP">Full Read/Write + MCP Tools</option>
              <option value="READ_ONLY">Read Only (Accounts & Transactions)</option>
            </select>
          </div>

          <Button type="submit" className="w-full">
            Generate API Key
          </Button>
        </form>
      </Dialog>
    </>
  );
};
