import { ForgotPasswordInput, ResetPasswordInput } from '@sure/shared';
import {
  hashPassword,
  passwordHashFingerprint,
  signEphemeralToken,
  verifyEphemeralToken,
} from '../../config/crypto.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';

export class AuthRecoveryService {
  public async forgotPassword(input: ForgotPasswordInput) {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return {
        sent: true,
        delivery: env.RESEND_API_KEY ? 'email' : 'local',
        message: 'If an account with that email exists, recovery instructions have been sent.',
      };
    }

    const resetToken = signEphemeralToken(
      'password_reset',
      {
        userId: user.id,
        email: user.email,
        fp: passwordHashFingerprint(user.passwordHash),
      },
      15 * 60 * 1000
    );

    const resetUrl = `${env.CORS_ORIGIN}/?reset_token=${encodeURIComponent(resetToken)}`;

    if (env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [user.email],
            subject: 'Sure Password Recovery',
            html: `<p>Use this link within 15 minutes to reset your Sure password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Or paste this token: <code>${resetToken}</code></p>`,
          }),
        });
      } catch {
        // Do not leak delivery errors externally
      }
    }

    return {
      sent: true,
      delivery: env.RESEND_API_KEY ? 'email' : 'local',
      message: env.RESEND_API_KEY
        ? 'Recovery link sent to your email address.'
        : 'Recovery token generated (15-minute expiry). Use the token below to reset your password.',
      ...(env.NODE_ENV !== 'production' && !env.RESEND_API_KEY ? { devResetToken: resetToken } : {}),
    };
  }

  public async resetPassword(input: ResetPasswordInput) {
    const payload = verifyEphemeralToken<{ userId: string; email: string; fp: string }>(
      'password_reset',
      input.token.trim()
    );
    if (!payload) {
      throw new AppError('UNAUTHORIZED', 'Password recovery token is invalid or expired');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || passwordHashFingerprint(user.passwordHash) !== payload.fp) {
      throw new AppError('UNAUTHORIZED', 'Password recovery token has already been used');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    });

    return { reset: true };
  }
}

export const authRecoveryService = new AuthRecoveryService();
