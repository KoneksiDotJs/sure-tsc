import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Pill } from '@sure/ui';
import {
  Download,
  Fingerprint,
  Lock,
  Plus,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext.js';
import { apiRequest } from '../../../lib/api-client.js';
import { useLedger } from '../../../lib/ledger-context.js';
import {
  createBrowserPasskey,
  isWebAuthnSupported,
  ServerRegistrationOptions,
} from '../../../lib/webauthn.js';

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export const ProfileSection: React.FC<{ onSignOut?: () => void }> = ({ onSignOut }) => {
  const { session } = useAuth();
  const { family, updateFamilySettings, inviteFamilyMember, downloadFamilyBackup } = useLedger();

  const fullName = session?.user.name || 'Sure User';
  const [firstName, lastName] = useMemo(() => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return [parts[0] ?? '', ''];
    return [parts[0]!, parts.slice(1).join(' ')];
  }, [fullName]);

  const [familyNameDraft, setFamilyNameDraft] = useState(family.name);
  const [showAddMember, setShowAddMember] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    setFamilyNameDraft(family.name);
  }, [family.name]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    await inviteFamilyMember({
      email: inviteEmail.trim(),
      name: inviteName.trim(),
      role: inviteRole,
    });
    setInviteEmail('');
    setInviteName('');
    setShowAddMember(false);
  };

  return (
    <div className="space-y-5">
      <Card title="Personal" subtitle="Customize how you appear on Sure">
        <div className="space-y-4">
          <div className="flex flex-col items-center py-2">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-lg font-semibold text-[var(--text-secondary)]">
              {getInitials(fullName)}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-2">
              Signed in as <strong className="text-[var(--text-primary)]">{session?.role ?? 'MEMBER'}</strong>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
            <div className="text-[11px] font-medium text-[var(--text-secondary)]">Email</div>
            <div className="text-sm text-[var(--text-primary)] mt-0.5">
              {session?.user.email ?? '—'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">First Name</div>
              <div className="text-sm text-[var(--text-primary)] mt-0.5">{firstName || '—'}</div>
            </div>
            <div className="rounded-lg border border-[var(--border-primary)] px-3.5 py-2 bg-[var(--bg-surface-subtle)]">
              <div className="text-[11px] font-medium text-[var(--text-secondary)]">Last Name</div>
              <div className="text-sm text-[var(--text-primary)] mt-0.5">{lastName || '—'}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Household" subtitle="Invitees can login to your family account and access shared resources.">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-[var(--border-strong)] px-3.5 py-1.5 bg-[var(--bg-surface)]">
              <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                Household name
              </label>
              <input
                type="text"
                value={familyNameDraft}
                onChange={(e) => setFamilyNameDraft(e.target.value)}
                className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <Button
              disabled={!familyNameDraft.trim() || familyNameDraft === family.name}
              onClick={() => void updateFamilySettings({ name: familyNameDraft.trim() })}
            >
              Save
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)] overflow-hidden">
            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-primary)]">
              {family.name.toUpperCase()} <span className="mx-1">•</span> {family.members.length}
            </div>
            <div className="divide-y divide-[var(--border-primary)] bg-[var(--bg-surface)]">
              {family.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-primary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                      {getInitials(m.name)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {m.name}
                        </span>
                        <Pill
                          label={m.role}
                          color={m.role === 'OWNER' ? '#078C52' : m.role === 'ADMIN' ? '#3b82f6' : '#64748b'}
                          size="xs"
                        />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">{m.email}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showAddMember ? (
              <form
                onSubmit={handleInviteMember}
                className="p-3 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-primary)] flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Member name"
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@family.com"
                  className="flex-1 min-w-[150px] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <Button type="submit" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />}>
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddMember(false)}
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="w-full py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border-t border-[var(--border-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add member</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Data & Session" subtitle="Export household snapshot or end active session">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                Download full family backup
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Exports accounts, holdings, entries, categories, tags, budgets, goals, and rules as JSON.
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="w-3.5 h-3.5" />}
              disabled={backupBusy}
              onClick={async () => {
                setBackupBusy(true);
                try {
                  await downloadFamilyBackup();
                } finally {
                  setBackupBusy(false);
                }
              }}
            >
              {backupBusy ? 'Exporting...' : 'Export JSON'}
            </Button>
          </div>

          {onSignOut && (
            <div className="pt-3 border-t border-[var(--border-primary)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Sign out of session
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Ends your authenticated session on this browser.
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={onSignOut}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export const SecuritySection: React.FC = () => {
  const { session, refreshSession } = useAuth();
  const { family, updateFamilySettings, setupMfa, enableMfa, changePassword } = useLedger();

  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [passkeyNameDraft, setPasskeyNameDraft] = useState('MacBook / Windows Hello');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{
    google: boolean;
    github: boolean;
    googleRedirectUri: string;
    githubRedirectUri: string;
  } | null>(null);

  useEffect(() => {
    void apiRequest<{
      google: boolean;
      github: boolean;
      googleRedirectUri: string;
      githubRedirectUri: string;
    }>('/api/v1/auth/providers')
      .then(setOauthProviders)
      .catch(() => null);
  }, []);

  const handleToggleMfa = async (next: boolean) => {
    if (!next) {
      await updateFamilySettings({ mfaEnabled: false });
      setMfaSetupData(null);
      return;
    }
    const setup = await setupMfa();
    setMfaSetupData(setup);
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    await enableMfa(totpCode.trim());
    setMfaSetupData(null);
    setTotpCode('');
  };

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasskeyStatus(null);
    if (!isWebAuthnSupported()) {
      setPasskeyStatus({ kind: 'error', text: 'This browser does not support WebAuthn Passkeys.' });
      return;
    }
    setPasskeyBusy(true);
    try {
      const opts = await apiRequest<{
        challengeToken: string;
        options: ServerRegistrationOptions;
      }>('/api/v1/auth/passkeys/register/options', { method: 'POST' });

      const attestation = await createBrowserPasskey(opts.options);
      await apiRequest('/api/v1/auth/passkeys/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          ...attestation,
          name: passkeyNameDraft.trim() || 'Passkey',
          challengeToken: opts.challengeToken,
        }),
      });
      await refreshSession();
      setPasskeyStatus({
        kind: 'success',
        text: 'Passkey registered! You can now use it for passwordless sign-in or as MFA.',
      });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to register passkey',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setPasskeyStatus(null);
    setPasskeyBusy(true);
    try {
      await apiRequest(`/api/v1/auth/passkeys/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await refreshSession();
      setPasskeyStatus({ kind: 'success', text: 'Passkey removed.' });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove passkey',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleEnablePasskeyMfa = async () => {
    setPasskeyStatus(null);
    setPasskeyBusy(true);
    try {
      await apiRequest('/api/v1/auth/mfa/enable-passkey', { method: 'POST' });
      await refreshSession();
      setPasskeyStatus({
        kind: 'success',
        text: 'MFA enabled using your registered Passkey.',
      });
    } catch (err) {
      setPasskeyStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not enable Passkey MFA',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card
        title="Two-Factor Authentication"
        subtitle="Add an extra layer of security to your account by requiring a code from your authenticator app when signing in"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                <Shield className="w-4 h-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Two-factor authentication is{' '}
                  <span
                    className={
                      family.mfaEnabled
                        ? 'text-[var(--status-positive)] font-semibold'
                        : 'text-[var(--status-negative)] font-semibold'
                    }
                  >
                    {family.mfaEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {family.mfaEnabled
                    ? 'Your account requires an RFC 6238 authenticator code on sign-in.'
                    : 'Enable 2FA to add an extra layer of security to your account.'}
                </div>
              </div>
            </div>

            {family.mfaEnabled ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleToggleMfa(false)}
              >
                Disable 2FA
              </Button>
            ) : (
              <Button size="sm" onClick={() => void handleToggleMfa(true)}>
                Enable 2FA
              </Button>
            )}
          </div>

          {mfaSetupData && (
            <Alert variant="info" title="Verify Authenticator Setup">
              <div className="space-y-2 mt-1">
                <p className="text-xs">
                  Add this secret key to your authenticator app:{' '}
                  <code className="font-mono-tabular font-bold">{mfaSetupData.secret}</code>
                </p>
                <form onSubmit={handleConfirmMfa} className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-36 px-2.5 py-1.5 text-xs font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                  <Button type="submit" size="sm">
                    Verify & Enable
                  </Button>
                </form>
              </div>
            </Alert>
          )}
        </div>
      </Card>

      <Card title="Password" subtitle="Update your account sign-in password">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwStatus(null);
            if (!currentPassword || newPassword.length < 8) {
              setPwStatus({
                kind: 'error',
                text: 'New password must be at least 8 characters.',
              });
              return;
            }
            setPwBusy(true);
            try {
              await changePassword(currentPassword, newPassword);
              setCurrentPassword('');
              setNewPassword('');
              setPwStatus({ kind: 'success', text: 'Password updated successfully.' });
            } catch (err) {
              setPwStatus({
                kind: 'error',
                text: err instanceof Error ? err.message : 'Failed to update password',
              });
            } finally {
              setPwBusy(false);
            }
          }}
        >
          {pwStatus && (
            <Alert
              variant={pwStatus.kind === 'success' ? 'success' : 'error'}
              title={pwStatus.kind === 'success' ? 'Password Updated' : 'Update Failed'}
            >
              {pwStatus.text}
            </Alert>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            icon={<Lock className="w-3.5 h-3.5" />}
            disabled={pwBusy}
          >
            {pwBusy ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>

      <Card
        title="Passkeys (WebAuthn)"
        subtitle="Use Touch ID, Face ID, Windows Hello, or a hardware security key for passwordless sign-in and two-factor authentication"
      >
        <div className="space-y-3.5">
          {passkeyStatus && (
            <Alert
              variant={passkeyStatus.kind === 'success' ? 'success' : 'error'}
              title={passkeyStatus.kind === 'success' ? 'Passkey Updated' : 'Passkey Error'}
            >
              {passkeyStatus.text}
            </Alert>
          )}

          {(session?.user.passkeys?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {session!.user.passkeys!.map((pk) => (
                <div
                  key={pk.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Fingerprint className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {pk.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular">
                        Registered {pk.createdAt.slice(0, 10)} • Sign-ins: {pk.counter}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={passkeyBusy}
                    onClick={() => void handleDeletePasskey(pk.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[var(--status-negative)]" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleRegisterPasskey} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={passkeyNameDraft}
              onChange={(e) => setPasskeyNameDraft(e.target.value)}
              placeholder="Device name (e.g. Windows Hello, YubiKey)"
              className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={passkeyBusy}
              icon={<Fingerprint className="w-3.5 h-3.5" />}
            >
              {passkeyBusy ? 'Waiting for prompt...' : 'Add Passkey'}
            </Button>
            {(session?.user.passkeys?.length ?? 0) > 0 && !session?.user.mfaEnabled && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={passkeyBusy}
                onClick={() => void handleEnablePasskeyMfa()}
              >
                Enable Passkey MFA
              </Button>
            )}
          </form>
        </div>
      </Card>

      <Card
        title="Connected Accounts (OAuth 2.0)"
        subtitle="Single sign-on status and PKCE callback URIs for external identity providers"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Google OAuth</div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular break-all">
                Callback: {oauthProviders?.googleRedirectUri || '/api/v1/auth/oauth/google/callback'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill
                size="xs"
                color={oauthProviders?.google ? '#078C52' : '#64748b'}
                label={oauthProviders?.google ? 'Configured' : 'Set GOOGLE_CLIENT_ID in .env'}
              />
              {oauthProviders?.google && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = '/api/v1/auth/oauth/google/start';
                  }}
                >
                  Link / Test
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface-subtle)]">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">GitHub OAuth</div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono-tabular break-all">
                Callback: {oauthProviders?.githubRedirectUri || '/api/v1/auth/oauth/github/callback'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill
                size="xs"
                color={oauthProviders?.github ? '#078C52' : '#64748b'}
                label={oauthProviders?.github ? 'Configured' : 'Set GITHUB_CLIENT_ID in .env'}
              />
              {oauthProviders?.github && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = '/api/v1/auth/oauth/github/start';
                  }}
                >
                  Link / Test
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
