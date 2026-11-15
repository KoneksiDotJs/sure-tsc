import React from 'react';
import { Check, Eye, EyeOff, Fingerprint, Github, KeyRound } from 'lucide-react';

interface PasswordRuleCheck {
  label: string;
  met: boolean;
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

interface AuthCredentialsFormProps {
  mode: 'login' | 'register';
  loginEmail: string;
  onChangeLoginEmail: (val: string) => void;
  loginPassword: string;
  onChangeLoginPassword: (val: string) => void;
  showLoginPassword: boolean;
  onToggleLoginPassword: () => void;
  regEmail: string;
  onChangeRegEmail: (val: string) => void;
  regPassword: string;
  onChangeRegPassword: (val: string) => void;
  showRegPassword: boolean;
  onToggleRegPassword: () => void;
  totpCode: string;
  onChangeTotpCode: (val: string) => void;
  showMfaPrompt: boolean;
  passwordChecks: PasswordRuleCheck[];
  passedRulesCount: number;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  onPasskeyMfaVerify: () => Promise<void> | void;
}

export const AuthCredentialsForm: React.FC<AuthCredentialsFormProps> = ({
  mode,
  loginEmail,
  onChangeLoginEmail,
  loginPassword,
  onChangeLoginPassword,
  showLoginPassword,
  onToggleLoginPassword,
  regEmail,
  onChangeRegEmail,
  regPassword,
  onChangeRegPassword,
  showRegPassword,
  onToggleRegPassword,
  totpCode,
  onChangeTotpCode,
  showMfaPrompt,
  passwordChecks,
  passedRulesCount,
  submitting,
  onSubmit,
  onPasskeyMfaVerify,
}) => (
  <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-surface)] px-3.5 py-2.5 focus-within:border-[var(--border-strong)] transition-colors">
      <label
        htmlFor={mode === 'login' ? 'auth-login-email' : 'auth-register-email'}
        className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
      >
        {mode === 'login' ? 'Email address' : 'Email'} <span className="text-red-500">*</span>
      </label>
      <input
        id={mode === 'login' ? 'auth-login-email' : 'auth-register-email'}
        type="email"
        required
        autoComplete="email"
        value={mode === 'login' ? loginEmail : regEmail}
        onChange={(e) =>
          mode === 'login' ? onChangeLoginEmail(e.target.value) : onChangeRegEmail(e.target.value)
        }
        placeholder={mode === 'login' ? 'alex@sterling.family' : 'you@example.com'}
        className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
      />
    </div>

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
              ? onChangeLoginPassword(e.target.value)
              : onChangeRegPassword(e.target.value)
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
          onClick={mode === 'login' ? onToggleLoginPassword : onToggleRegPassword}
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
            onChange={(e) => onChangeTotpCode(e.target.value)}
            placeholder="6-digit authenticator code"
            className="w-full bg-transparent text-sm font-mono-tabular text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void onPasskeyMfaVerify()}
          className="w-full rounded-lg py-2 px-3 text-xs font-medium border border-[var(--border-primary)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Fingerprint className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span>Verify MFA with Passkey</span>
        </button>
      </div>
    )}

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
                  rule.met ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }
              >
                {rule.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}

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
);

interface SecondarySignInActionsProps {
  submitting: boolean;
  showMfaPrompt: boolean;
  onShowRecovery: () => void;
  onShowMfaPrompt: () => void;
  onPasskeySignIn: () => Promise<void> | void;
  onOAuthLogin: (provider: 'google' | 'github') => void;
}

export const SecondarySignInActions: React.FC<SecondarySignInActionsProps> = ({
  submitting,
  showMfaPrompt,
  onShowRecovery,
  onShowMfaPrompt,
  onPasskeySignIn,
  onOAuthLogin,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onShowRecovery}
        className="text-xs font-semibold text-[var(--text-primary)] hover:underline cursor-pointer"
      >
        Forgot your password?
      </button>
      {!showMfaPrompt && (
        <button
          type="button"
          onClick={onShowMfaPrompt}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
        >
          Use MFA code
        </button>
      )}
    </div>

    <button
      type="button"
      disabled={submitting}
      onClick={() => void onPasskeySignIn()}
      className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
    >
      <Fingerprint className="w-4 h-4 text-[var(--text-secondary)]" />
      <span>Sign in with a passkey</span>
    </button>

    <div className="grid grid-cols-1 gap-2">
      <button
        type="button"
        disabled={submitting}
        onClick={() => onOAuthLogin('google')}
        className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <GoogleMarkIcon className="w-4 h-4" />
        <span>Sign in with Google</span>
      </button>

      <button
        type="button"
        disabled={submitting}
        onClick={() => onOAuthLogin('github')}
        className="w-full rounded-xl py-2.5 px-4 text-sm font-medium border border-[var(--border-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <Github className="w-4 h-4 text-[var(--text-secondary)]" />
        <span>Sign in with GitHub</span>
      </button>
    </div>
  </div>
);
