import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Alert } from '@sure/ui';
import { useAuth } from './AuthContext.js';
import { apiRequest, ApiError } from '../../lib/api-client.js';
import {
  getBrowserPasskeyAssertion,
  isWebAuthnSupported,
  ServerAuthenticationOptions,
} from '../../lib/webauthn.js';
import { AuthCredentialsForm, SecondarySignInActions } from './components/AuthForms.js';
import { AuthLegalDialog, PasswordRecoveryDialog } from './components/MfaAndRecoveryPanels.js';

interface AuthProvidersStatus {
  google: boolean;
  github: boolean;
  passkeys: boolean;
  passwordRecovery: boolean;
  googleRedirectUri: string;
  githubRedirectUri: string;
}

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

  const [loginEmail, setLoginEmail] = useState('alex@sterling.family');
  const [loginPassword, setLoginPassword] = useState('SureDemo2026!');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [showMfaPrompt, setShowMfaPrompt] = useState(false);

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legalDialog, setLegalDialog] = useState<'privacy' | 'terms' | null>(null);
  const [providers, setProviders] = useState<AuthProvidersStatus | null>(null);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('alex@sterling.family');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'confirm'>('request');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState<{
    kind: 'info' | 'error' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    void apiRequest<AuthProvidersStatus>('/api/v1/auth/providers')
      .then(setProviders)
      .catch(() => null);

    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get('oauth_error');
    const oauthOk = params.get('oauth');
    const resetTok = params.get('reset_token');

    if (oauthErr) setError(oauthErr);
    else if (oauthOk === 'success') void refreshSession();

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
        <div className="flex justify-center">
          <img src="/images/logomark-color.svg" alt="Sure" className="w-11 h-11" />
        </div>

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

        <AuthCredentialsForm
          mode={mode}
          loginEmail={loginEmail}
          onChangeLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          onChangeLoginPassword={setLoginPassword}
          showLoginPassword={showLoginPassword}
          onToggleLoginPassword={() => setShowLoginPassword((v) => !v)}
          regEmail={regEmail}
          onChangeRegEmail={setRegEmail}
          regPassword={regPassword}
          onChangeRegPassword={setRegPassword}
          showRegPassword={showRegPassword}
          onToggleRegPassword={() => setShowRegPassword((v) => !v)}
          totpCode={totpCode}
          onChangeTotpCode={setTotpCode}
          showMfaPrompt={showMfaPrompt}
          passwordChecks={passwordChecks}
          passedRulesCount={passedRulesCount}
          submitting={submitting}
          onSubmit={handleSubmit}
          onPasskeyMfaVerify={handlePasskeyMfaVerify}
        />

        {mode === 'login' && (
          <SecondarySignInActions
            submitting={submitting}
            showMfaPrompt={showMfaPrompt}
            onShowRecovery={() => {
              setRecoveryEmail(loginEmail || '');
              setRecoveryMsg(null);
              setRecoveryStep('request');
              setRecoveryOpen(true);
            }}
            onShowMfaPrompt={() => setShowMfaPrompt(true)}
            onPasskeySignIn={handlePasskeySignIn}
            onOAuthLogin={handleOAuthLogin}
          />
        )}

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

      <PasswordRecoveryDialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        recoveryEmail={recoveryEmail}
        onChangeRecoveryEmail={setRecoveryEmail}
        recoveryStep={recoveryStep}
        onChangeRecoveryStep={setRecoveryStep}
        recoveryToken={recoveryToken}
        onChangeRecoveryToken={setRecoveryToken}
        recoveryMsg={recoveryMsg}
        onChangeRecoveryMsg={setRecoveryMsg}
        onPasswordResetSuccess={() => setLoginPassword('')}
      />

      <AuthLegalDialog legalDialog={legalDialog} onClose={() => setLegalDialog(null)} />
    </div>
  );
};
