import React, { useState } from 'react';
import { Card, Button, Alert, Pill, SegmentedControl } from '@sure/ui';
import { Lock, Mail, UserPlus, LogIn, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from './AuthContext.js';
import { ApiError } from '../../lib/api-client.js';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('alex@sterling.family');
  const [password, setPassword] = useState('SureDemo2026!');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);

  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login({
          email: email.trim(),
          password,
          ...(totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
        });
      } else {
        await register({
          email: email.trim(),
          password,
          name: name.trim(),
          familyName: familyName.trim(),
          baseCurrency,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'MFA_REQUIRED' || err.message.toLowerCase().includes('totp')) {
          setShowTotp(true);
        }
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setMode('login');
    setEmail('alex@sterling.family');
    setPassword('SureDemo2026!');
    setTotpCode('');
    setShowTotp(false);
    setError(null);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)] p-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35 dark:opacity-15"
        style={{ backgroundImage: "url('/images/bg-grid.png')", backgroundSize: '360px' }}
      />
      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center space-y-2.5">
          <img
            src="/images/logomark-color.svg"
            alt="Sure"
            className="w-11 h-11 mx-auto"
          />
          <h1 className="text-2xl font-bold tracking-tight">Sure Wealth & Ledger OS</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Multi-tenant PostgreSQL ledger with decimal arithmetic & family isolation
          </p>
        </div>

        <Card>
          <div className="space-y-5">
            <SegmentedControl<'login' | 'register'>
              options={[
                { value: 'login', label: 'Sign In' },
                { value: 'register', label: 'Create Family Workspace' },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
              }}
            />

            {error && (
              <Alert variant="error" title="Authentication Error">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jordan Sterling"
                      className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Family Workspace Name
                      </label>
                      <input
                        type="text"
                        required
                        value={familyName}
                        onChange={(e) => setFamilyName(e.target.value)}
                        placeholder="Sterling Household"
                        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Currency
                      </label>
                      <select
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="CAD">CAD</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@sterling.family"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                  />
                </div>
              </div>

              {mode === 'login' && (showTotp ? (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Authenticator Code (6-digit TOTP)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono-tabular rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTotp(true)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                >
                  Have TOTP MFA enabled? Enter 6-digit code
                </button>
              ))}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full justify-center"
                icon={
                  mode === 'login' ? (
                    <LogIn className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )
                }
              >
                {submitting
                  ? 'Authenticating...'
                  : mode === 'login'
                  ? 'Sign In to Workspace'
                  : 'Create Family & Sign In'}
              </Button>
            </form>

            <div className="pt-4 border-t border-[var(--border-primary)] flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Seeded Demo Workspace</span>
                </div>
                <div className="font-mono-tabular text-[11px]">
                  alex@sterling.family / SureDemo2026!
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={fillDemoCredentials}>
                Fill Demo
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <Pill label="HTTP-Only Signed Cookies" color="#10b981" />
          <Pill label="PostgreSQL 16" color="#3b82f6" />
        </div>
      </div>
    </div>
  );
};
