import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dialog, Button } from '@sure/ui';
import { Check, Eye, EyeOff, Fingerprint, Github, Info, KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from './AuthContext.js';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import {
  getBrowserPasskeyAssertion,
  isWebAuthnSupported,
  ServerAuthenticationOptions,
} from '../../lib/webauthn.js';

interface AuthProvidersStatus {
  google: boolean;
  github: boolean;
  passkeys: boolean;
  passwordRecovery: boolean;
  googleRedirectUri: string;
  githubRedirectUri: string;
}

const GoogleMarkIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6.01-2.19-7-5.14H1.01v3.14C3.05 21.2 7.23 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5 14.03c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.17H1.01C.37 7.45 0 8.9 0 10.42v2.5c0 1.52.37 2.97 1.01 4.25l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.23 0 3.05 2.8 1.01 6.86l3.99 3.14c.99-2.95 3.75-5.25 7-5.25Z"
    />
  </svg>
);

function deriveDisplayName(email: string): string {
  const local = email.trim().split('@')[0] || 'User';
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return cleaned.slice(0, 60) || 'Sure User';
}

export const AuthPage: React.FC = () => {
  const { login, loginWithPasskey, register, refreshSession } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Sign-in state (pre-filled with seeded demo workspace credentials)
  const [loginEmail, setLoginEmail] = useState('alex@sterling.family');
  const [loginPassword, setLoginPassword] = useState('SureDemo2026!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [showMfaPrompt, setShowMfaPrompt] = useState(false);

  // Registration state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legalDialog, setLegalDialog] = useState<'privacy' | 'terms' | null>(null);
  const [providers, setProviders] = useState<AuthProvidersStatus | null>(null);

  // Password recovery dialog state
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('alex@sterling.family');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'confirm'>('request');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    void apiRequest<AuthProvidersStatus>('/api/v1/auth/providers')
      .then(setProviders)
      .catch(() => null);

    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get('oauth_error');
    const oauthOk = params.get('oauth');
    const resetTok = params.get('reset_token');

    if (oauthErr) {
      setError(oauthErr);
    } else if (oauthOk === 'success') {
      void refreshSession();
    }

    if (resetTok) {
      setRecoveryToken(resetTok);
      setRecoveryStep('confirm');
      setRecoveryOpen(true);
    }

    if (oauthErr || oauthOk || resetTok) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshSession]);

  const passwordChecks = useMemo(
    () => [
      { label: 'Minimum 8 characters', met: regPassword.length >= 8 },
      {
        label: 'Upper and lowercase letters',
        met: /[a-z]/.test(regPassword) && /[A-Z]/.test(regPassword),
      },
      { label: 'A number (0-9)', met: /\d/.test(regPassword) },
      {
        label: 'A special character (!, @, #, $, %, etc)',
        met: /[^A-Za-z0-9]/.test(regPassword),
      },
    ],
    [regPassword]
  );

  const passedRulesCount = passwordChecks.filter((r) => r.met).length;

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'register' && passedRulesCount < 4) {
      setError('Please satisfy all password requirements before creating your account.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({
          email: loginEmail.trim(),
          password: loginPassword,
          ...(totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
        });
      } else {
        const displayName = deriveDisplayName(regEmail);
        await register({
          email: regEmail.trim(),
          password: regPassword,
          name: displayName,
          familyName: `${displayName}'s Household`,
          baseCurrency: 'USD',
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const lowerMsg = err.message.toLowerCase();
        if (err.code === 'MFA_REQUIRED' || lowerMsg.includes('totp') || lowerMsg.includes('mfa')) {
          setShowMfaPrompt(true);
        }
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    setNotice(null);
    if (!isWebAuthnSupported()) {
      setError('This browser does not support WebAuthn Passkeys.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPasskey(loginEmail.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyMfaVerify = async () => {
    setError(null);
    setNotice(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError('Enter your email and password first, then verify with your passkey.');
      return;
    }
    setSubmitting(true);
    try {
      const opts = await apiRequest<{
        challengeToken: string;
        options: ServerAuthenticationOptions;
      }>('/api/v1/auth/passkeys/login/options', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const assertion = await getBrowserPasskeyAssertion(opts.options);
      await login({
        email: loginEmail.trim(),
        password: loginPassword,
        passkeyAssertion: assertion,
        challengeToken: opts.challengeToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey MFA verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    setError(null);
    setNotice(null);
    const enabled = provider === 'google' ? providers?.google : providers?.github;
    if (providers && !enabled) {
      const envKeys =
        provider === 'google'
          ? 'GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET'
          : 'GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET';
      const cbUri =
        provider === 'google' ? providers.googleRedirectUri : providers.githubRedirectUri;
      setNotice(
        `${provider === 'google' ? 'Google' : 'GitHub'} OAuth is ready once ${envKeys} are set in .env (Callback URI: ${cbUri}).`
      );
      return;
    }
    window.location.href = `/api/v1/auth/oauth/${provider}/start`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-10">
      <div className="w-full max-w-[380px] mx-auto space-y-6">
        {/* Centered Sure Brand Mark */}
        <div className="flex justify-center">
          <img src="/images/logomark-color.svg" alt="Sure" className="w-11 h-11" />
        </div>

        {/* Mode Switcher */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="grid grid-cols-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => switchMode('login')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => switchMode('register')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Demo Mode Callout on Sign In */}
        {mode === 'login' && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-50/75 dark:bg-[#0B172A] px-4 py-3.5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed">
              <div className="font-semibold text-[var(--text-primary)]">Demo Mode Active</div>
              <p className="text-[var(--text-secondary)]">
                This is a demonstration environment. Login credentials have been pre-filled for your
                convenience. Please do not enter real or sensitive information.
              </p>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="error" title="Authentication Error">
            {error}
          </Alert>
        )}

        {notice && (
          <Alert variant="info" title="Notice">
            {notice}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3.5 py-2.5 focus-within:border-[var(--border-strong)] transition-colors">
            <label
              htmlFor={mode === 'login' ? 'auth-login-email' : 'auth-register-email'}
              className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
            >
              {mode === 'login' ? 'Email address' : 'Email'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              id={mode === 'login' ? 'auth-login-email' : 'auth-register-email'}
              type="email"
              required
              autoComplete="email"
              value={mode === 'login' ? loginEmail : regEmail}
              onChange={(e) =>
                mode === 'login' ? setLoginEmail(e.target.value) : setRegEmail(e.target.value)
              }
              placeholder={mode === 'login' ? 'alex@sterling.family' : 'you@example.com'}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>

          {/* Password Field */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3.5 py-2.5 focus-within:border-[var(--border-strong)] transition-colors">
            <label
              htmlFor={mode === 'login' ? 'auth-login-password' : 'auth-register-password'}
              className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id={mode === 'login' ? 'auth-login-password' : 'auth-register-password'}
                type={
                  mode === 'login'
                    ? showLoginPassword
                      ? 'text'
                      : 'password'
                    : showRegPassword
                    ? 'text'
                    : 'password'
                }
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={mode === 'login' ? loginPassword : regPassword}
                onChange={(e) =>
                  mode === 'login'
                    ? setLoginPassword(e.target.value)
                    : setRegPassword(e.target.value)
                }
                placeholder="Enter your password"
                className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              <button
                type="button"
                aria-label={
                  (mode === 'login' ? showLoginPassword : showRegPassword)
                    ? 'Hide password'
                    : 'Show password'
                }
                onClick={() =>
                  mode === 'login'
                    ? setShowLoginPassword((v) => !v)
                    : setShowRegPassword((v) => !v)
                }
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              >
                {(mode === 'login' ? showLoginPassword : showRegPassword) ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* MFA Verification Section (TOTP + Passkey MFA) */}
          {mode === 'login' && showMfaPrompt && (
            <div className="space-y-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3.5 py-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-totp"
                  className="block text-[11px] font-medium text-[var(--text-secondary)]"
                >
                  Two-Factor Verification (TOTP or Passkey)
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-canvas)] px-2.5 py-2 focus-within:border-[var(--border-strong)]">
                <KeyRound className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  id="auth-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-digit authenticator code"
                  className="w-full bg-transparent text-sm font-mono-tabular text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handlePasskeyMfaVerify()}
                className="w-full rounded-lg py-2 px-3 text-xs font-medium border border-[var(--border-primary)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Verify MFA with Passkey</span>
              </button>
            </div>
          )}

          {/* 4-Segment Strength Bar & Checklist on Create Account */}
          {mode === 'register' && (
            <div className="space-y-3 pt-0.5">
              <div className="grid grid-cols-4 gap-2" aria-label="Password strength">
                {[0, 1, 2, 3].map((idx) => {
                  const active = idx < passedRulesCount;
                  const barTone =
                    passedRulesCount === 4
                      ? 'bg-emerald-500'
                      : passedRulesCount >= 2
                      ? 'bg-amber-500'
                      : 'bg-red-500';
                  return (
                    <span
                      key={idx}
                      className={`h-1 rounded-full transition-colors ${
                        active ? barTone : 'bg-[var(--border-primary)]'
                      }`}
                    />
                  );
                })}
              </div>

              <ul className="space-y-1.5 text-xs">
                {passwordChecks.map((rule) => (
                  <li key={rule.label} className="flex items-center gap-2">
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        rule.met ? 'text-emerald-500' : 'text-[var(--text-muted)]'
                      }`}
                    />
                    <span
                      className={
                        rule.met
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }
                    >
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? mode === 'login'
                ? 'Logging in...'
                : 'Creating account...'
              : mode === 'login'
              ? 'Log in'
              : 'Create account'}
          </button>
        </form>

        {/* Secondary Sign-In Actions */}
        {mode === 'login' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(loginEmail || '');
                  setRecoveryMsg(null);
                  setRecoveryStep('request');
                  setRecoveryOpen(true);
                }}
                className="text-xs font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
              >
                Forgot your password?
              </button>
              {!showMfaPrompt && (
                <button
                  type="button"
                  onClick={() => setShowMfaPrompt(true)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                >
                  Use MFA code
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePasskeySignIn()}
              className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Fingerprint className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Sign in with a passkey</span>
            </button>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleOAuthLogin('google')}
                className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <GoogleMarkIcon className="w-4 h-4" />
                <span>Sign in with Google</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleOAuthLogin('github')}
                className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Github className="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Sign in with GitHub</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Attribution & Legal Links */}
        <footer className="pt-2 text-center space-y-1.5 text-[11px] text-[var(--text-muted)]">
          <div>© 2026, FOSS Sure (community fork of Maybe Finance)</div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setLegalDialog('privacy')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalDialog('terms')}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </footer>
      </div>

      <Dialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        title="Password Recovery"
        description="Request a single-use HMAC recovery token (15-minute expiry) or enter your recovery token to set a new password."
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() =>
                setRecoveryStep((s) => (s === 'request' ? 'confirm' : 'request'))
              }
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
            >
              {recoveryStep === 'request' ? 'Already have a token?' : 'Back to request'}
            </button>
            <Button variant="secondary" onClick={() => setRecoveryOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {recoveryMsg && (
            <Alert
              variant={
                recoveryMsg.kind === 'error'
                  ? 'error'
                  : recoveryMsg.kind === 'success'
                  ? 'success'
                  : 'info'
              }
              title={
                recoveryMsg.kind === 'error'
                  ? 'Recovery Failed'
                  : recoveryMsg.kind === 'success'
                  ? 'Password Reset'
                  : 'Recovery Token Ready'
              }
            >
              {recoveryMsg.text}
            </Alert>
          )}

          {recoveryStep === 'request' ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setRecoveryMsg(null);
                setRecoveryBusy(true);
                try {
                  const res = await apiRequest<{
                    sent: boolean;
                    message: string;
                    devResetToken?: string;
                  }>('/api/v1/auth/password/forgot', {
                    method: 'POST',
                    body: JSON.stringify({ email: recoveryEmail.trim() }),
                  });
                  if (res.devResetToken) {
                    setRecoveryToken(res.devResetToken);
                    setRecoveryStep('confirm');
                    setRecoveryMsg({
                      kind: 'info',
                      text: 'Development recovery token generated and pre-filled below (valid for 15 minutes).',
                    });
                  } else {
                    setRecoveryMsg({ kind: 'success', text: res.message });
                  }
                } catch (err) {
                  setRecoveryMsg({
                    kind: 'error',
                    text: err instanceof Error ? err.message : 'Failed to initiate recovery',
                  });
                } finally {
                  setRecoveryBusy(false);
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="alex@sterling.family"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
              <Button
                type="submit"
                disabled={recoveryBusy}
                icon={<MailCheck className="w-4 h-4" />}
              >
                {recoveryBusy ? 'Generating...' : 'Send Recovery Link'}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setRecoveryMsg(null);
                setRecoveryBusy(true);
                try {
                  await apiRequest('/api/v1/auth/password/reset', {
                    method: 'POST',
                    body: JSON.stringify({
                      token: recoveryToken.trim(),
                      newPassword: recoveryNewPassword,
                    }),
                  });
                  setRecoveryMsg({
                    kind: 'success',
                    text: 'Your password has been updated. You can now sign in with your new password.',
                  });
                  setLoginPassword('');
                  setRecoveryNewPassword('');
                } catch (err) {
                  setRecoveryMsg({
                    kind: 'error',
                    text: err instanceof Error ? err.message : 'Failed to reset password',
                  });
                } finally {
                  setRecoveryBusy(false);
                }
              }}
            >
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Recovery Token
                </label>
                <input
                  type="text"
                  required
                  value={recoveryToken}
                  onChange={(e) => setRecoveryToken(e.target.value)}
                  placeholder="Paste token from email or dev preview"
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)]"
                />
              </div>
              <Button type="submit" disabled={recoveryBusy}>
                {recoveryBusy ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </div>
      </Dialog>

      <Dialog
        open={legalDialog !== null}
        onClose={() => setLegalDialog(null)}
        title={legalDialog === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
        footer={
          <Button variant="secondary" onClick={() => setLegalDialog(null)}>
            Close
          </Button>
        }
      >
        {legalDialog === 'privacy' ? (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Your household financial ledger is strictly isolated by Family tenant and stored in your
            configured PostgreSQL database. AI features never transmit financial records unless
            explicitly enabled for your family under Settings → AI Prompts.
          </p>
        ) : (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            This software is licensed under the MIT License for personal financial management and
            bookkeeping tracking. Verify balances and tax figures with your official financial
            institutions before filing or making investment decisions.
          </p>
        )}
      </Dialog>
    </div>
  );
};
