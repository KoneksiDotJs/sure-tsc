import { randomBytes } from 'node:crypto';
import { FamilyRole } from '@sure/shared';
import {
  createPkcePair,
  signEphemeralToken,
  signSessionToken,
  verifyEphemeralToken,
} from '../../config/crypto.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middleware/pipeline.js';
import { provisionUserWithFamily } from './auth.shared.js';

export class AuthOAuthService {
  private getRedirectUri(provider: 'google' | 'github', requestOrigin?: string): string {
    const base = (
      env.OAUTH_REDIRECT_BASE_URL ||
      requestOrigin ||
      env.CORS_ORIGIN ||
      'http://localhost:5173'
    ).replace(/\/$/, '');
    return `${base}/api/v1/auth/oauth/${provider}/callback`;
  }

  public getAuthProviders(requestOrigin?: string) {
    return {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      passkeys: true,
      passwordRecovery: true,
      googleRedirectUri: this.getRedirectUri('google', requestOrigin),
      githubRedirectUri: this.getRedirectUri('github', requestOrigin),
    };
  }

  public startOAuth(provider: 'google' | 'github', requestOrigin?: string): { authorizeUrl: string } {
    const redirectUri = this.getRedirectUri(provider, requestOrigin);
    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = signEphemeralToken(
      'oauth_state',
      { provider, codeVerifier, redirectUri },
      10 * 60 * 1000
    );

    if (provider === 'google') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
        );
      }
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'online',
        prompt: 'select_account',
      });
      return { authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new AppError(
        'VALIDATION_ERROR',
        'GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.'
      );
    }
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    return { authorizeUrl: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  private async exchangeGoogleProfile(code: string, codeVerifier: string, redirectUri: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError('VALIDATION_ERROR', 'Google OAuth credentials missing');
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      throw new AppError('UNAUTHORIZED', 'Google OAuth token exchange failed');
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new AppError('UNAUTHORIZED', 'Missing Google access token');
    }
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!profileRes.ok) {
      throw new AppError('UNAUTHORIZED', 'Failed to fetch Google user profile');
    }
    const profile = (await profileRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.email || profile.email_verified === false) {
      throw new AppError('UNAUTHORIZED', 'Verified Google email address is required');
    }
    const email = profile.email.trim().toLowerCase();
    return {
      email,
      name: profile.name?.trim() || email.split('@')[0] || 'Sure User',
    };
  }

  private async exchangeGitHubProfile(code: string, codeVerifier: string, redirectUri: string) {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new AppError('VALIDATION_ERROR', 'GitHub OAuth credentials missing');
    }
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      throw new AppError('UNAUTHORIZED', 'GitHub OAuth token exchange failed');
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new AppError('UNAUTHORIZED', 'Missing GitHub access token');
    }
    const ghHeaders = {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: 'application/vnd.github+json',
    };
    const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    const ghUser = (await userRes.json()) as { email?: string; name?: string; login?: string };
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
    const ghEmails = emailsRes.ok
      ? ((await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>)
      : [];
    const primaryVerified =
      ghEmails.find((e) => e.primary && e.verified) ?? ghEmails.find((e) => e.verified);
    const email = (primaryVerified?.email || ghUser.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError('UNAUTHORIZED', 'GitHub account does not expose a verified email');
    }
    return {
      email,
      name: ghUser.name?.trim() || ghUser.login || email.split('@')[0] || 'Sure User',
    };
  }

  public async completeOAuthCallback(
    provider: 'google' | 'github',
    code: string,
    stateToken: string
  ) {
    const state = verifyEphemeralToken<{
      provider: string;
      codeVerifier: string;
      redirectUri: string;
    }>('oauth_state', stateToken);

    if (!state || state.provider !== provider) {
      throw new AppError('UNAUTHORIZED', 'OAuth state expired or invalid');
    }

    const { email, name } =
      provider === 'google'
        ? await this.exchangeGoogleProfile(code, state.codeVerifier, state.redirectUri)
        : await this.exchangeGitHubProfile(code, state.codeVerifier, state.redirectUri);

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { family: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!existingUser) {
      const created = await provisionUserWithFamily({
        email,
        password: randomBytes(32).toString('hex'),
        name,
        familyName: `${name}'s Household`,
        baseCurrency: 'IDR',
      });
      return {
        token: signSessionToken({
          userId: created.user.id,
          familyId: created.family.id,
          role: 'OWNER',
        }),
      };
    }

    const membership = existingUser.memberships[0];
    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of any family workspace');
    }

    return {
      token: signSessionToken({
        userId: existingUser.id,
        familyId: membership.familyId,
        role: membership.role as FamilyRole,
      }),
    };
  }
}

export const authOAuthService = new AuthOAuthService();
