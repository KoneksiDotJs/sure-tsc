import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Alert, Button, Dialog } from '@sure/ui';
import { apiRequest } from '../../../lib/api-client.js';

interface PasswordRecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  recoveryEmail: string;
  onChangeRecoveryEmail: (val: string) => void;
  recoveryStep: 'request' | 'confirm';
  onChangeRecoveryStep: (step: 'request' | 'confirm') => void;
  recoveryToken: string;
  onChangeRecoveryToken: (token: string) => void;
  recoveryMsg: { kind: 'info' | 'error' | 'success'; text: string } | null;
  onChangeRecoveryMsg: (
    msg: { kind: 'info' | 'error' | 'success'; text: string } | null
  ) => void;
  onPasswordResetSuccess: () => void;
}

export const PasswordRecoveryDialog: React.FC<PasswordRecoveryDialogProps> = ({
  open,
  onClose,
  recoveryEmail,
  onChangeRecoveryEmail,
  recoveryStep,
  onChangeRecoveryStep,
  recoveryToken,
  onChangeRecoveryToken,
  recoveryMsg,
  onChangeRecoveryMsg,
  onPasswordResetSuccess,
}) => {
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Password Recovery"
      description="Request a single-use HMAC recovery token (15-minute expiry) or enter your recovery token to set a new password."
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={() =>
              onChangeRecoveryStep(recoveryStep === 'request' ? 'confirm' : 'request')
            }
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
          >
            {recoveryStep === 'request' ? 'Already have a token?' : 'Back to request'}
          </button>
          <Button variant="secondary" onClick={onClose}>
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
              onChangeRecoveryMsg(null);
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
                  onChangeRecoveryToken(res.devResetToken);
                  onChangeRecoveryStep('confirm');
                  onChangeRecoveryMsg({
                    kind: 'info',
                    text: 'Development recovery token generated and pre-filled below (valid for 15 minutes).',
                  });
                } else {
                  onChangeRecoveryMsg({ kind: 'success', text: res.message });
                }
              } catch (err) {
                onChangeRecoveryMsg({
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
                onChange={(e) => onChangeRecoveryEmail(e.target.value)}
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
              onChangeRecoveryMsg(null);
              setRecoveryBusy(true);
              try {
                await apiRequest('/api/v1/auth/password/reset', {
                  method: 'POST',
                  body: JSON.stringify({
                    token: recoveryToken.trim(),
                    newPassword: recoveryNewPassword,
                  }),
                });
                onChangeRecoveryMsg({
                  kind: 'success',
                  text: 'Your password has been updated. You can now sign in with your new password.',
                });
                setRecoveryNewPassword('');
                onPasswordResetSuccess();
              } catch (err) {
                onChangeRecoveryMsg({
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
                onChange={(e) => onChangeRecoveryToken(e.target.value)}
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
  );
};

interface AuthLegalDialogProps {
  legalDialog: 'privacy' | 'terms' | null;
  onClose: () => void;
}

export const AuthLegalDialog: React.FC<AuthLegalDialogProps> = ({ legalDialog, onClose }) => (
  <Dialog
    open={legalDialog !== null}
    onClose={onClose}
    title={legalDialog === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
    footer={
      <Button variant="secondary" onClick={onClose}>
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
);
