import { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { AppError, getRouteParam, SESSION_COOKIE_NAME } from '../../middleware/pipeline.js';
import { authService } from './auth.service.js';

function getRequestOrigin(req: Request): string {
  const originHeader = req.get('origin');
  if (originHeader) return originHeader;
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  if (host) return `${proto}://${host}`;
  return env.CORS_ORIGIN;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
}

export class AuthController {
  public async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    setSessionCookie(res, result.token);
    res.status(201).json({ data: result });
  }

  public async login(req: Request, res: Response) {
    const result = await authService.login(req.body, getRequestOrigin(req));
    setSessionCookie(res, result.token);
    res.json({ data: result });
  }

  public async logout(_req: Request, res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ data: { loggedOut: true } });
  }

  public async me(req: Request, res: Response) {
    const data = await authService.getMe(
      req.auth.userId,
      req.auth.familyId,
      req.auth.role
    );
    res.json({ data });
  }

  public async setupMfa(req: Request, res: Response) {
    const data = await authService.setupMfa(req.auth.userId);
    res.json({ data });
  }

  public async enableMfa(req: Request, res: Response) {
    const data = await authService.enableMfa(req.auth.userId, req.body.totpCode);
    res.json({ data });
  }

  public async disableMfa(req: Request, res: Response) {
    const data = await authService.disableMfa(req.auth.userId);
    res.json({ data });
  }

  public async listApiKeys(req: Request, res: Response) {
    const keys = await authService.listApiKeys(req.auth.familyId);
    res.json({ data: keys });
  }

  public async createApiKey(req: Request, res: Response) {
    const created = await authService.createApiKey(
      req.auth.familyId,
      req.auth.userId,
      req.body
    );
    res.status(201).json({ data: created });
  }

  public async deleteApiKey(req: Request, res: Response) {
    await authService.deleteApiKey(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  }

  public async changePassword(req: Request, res: Response) {
    const result = await authService.changePassword(
      req.auth.userId,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.json({ data: result });
  }

  public async enablePasskeyMfa(req: Request, res: Response) {
    const data = await authService.enablePasskeyMfa(req.auth.userId);
    res.json({ data });
  }

  public async listPasskeys(req: Request, res: Response) {
    const data = await authService.listPasskeys(req.auth.userId);
    res.json({ data });
  }

  public async passkeyRegisterOptions(req: Request, res: Response) {
    const data = await authService.getPasskeyRegisterOptions(
      req.auth.userId,
      getRequestOrigin(req)
    );
    res.json({ data });
  }

  public async passkeyRegisterVerify(req: Request, res: Response) {
    const data = await authService.verifyPasskeyRegister(
      req.auth.userId,
      req.body,
      getRequestOrigin(req)
    );
    res.status(201).json({ data });
  }

  public async deletePasskey(req: Request, res: Response) {
    const data = await authService.deletePasskey(
      req.auth.userId,
      getRouteParam(req, 'id')
    );
    res.json({ data });
  }

  public async passkeyLoginOptions(req: Request, res: Response) {
    const data = await authService.getPasskeyLoginOptions(
      req.body?.email,
      getRequestOrigin(req)
    );
    res.json({ data });
  }

  public async passkeyLoginVerify(req: Request, res: Response) {
    const result = await authService.verifyPasskeyLogin(
      req.body,
      getRequestOrigin(req)
    );
    setSessionCookie(res, result.token);
    res.json({ data: result });
  }

  public async forgotPassword(req: Request, res: Response) {
    const data = await authService.forgotPassword(req.body);
    res.json({ data });
  }

  public async resetPassword(req: Request, res: Response) {
    const data = await authService.resetPassword(req.body);
    res.json({ data });
  }

  public async providers(req: Request, res: Response) {
    const data = authService.getAuthProviders(getRequestOrigin(req));
    res.json({ data });
  }

  public async oauthStart(req: Request, res: Response) {
    const provider = getRouteParam(req, 'provider');
    if (provider !== 'google' && provider !== 'github') {
      throw new AppError('VALIDATION_ERROR', `Unsupported OAuth provider: ${provider}`);
    }
    try {
      const { authorizeUrl } = authService.startOAuth(provider, getRequestOrigin(req));
      res.redirect(authorizeUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth provider is not configured';
      res.redirect(`${env.CORS_ORIGIN}/?oauth_error=${encodeURIComponent(msg)}`);
    }
  }

  public async oauthCallback(req: Request, res: Response) {
    const provider = getRouteParam(req, 'provider');
    if (provider !== 'google' && provider !== 'github') {
      res.redirect(`${env.CORS_ORIGIN}/?oauth_error=${encodeURIComponent('Unsupported OAuth provider')}`);
      return;
    }

    const oauthErr = typeof req.query.error === 'string' ? req.query.error : undefined;
    if (oauthErr) {
      res.redirect(`${env.CORS_ORIGIN}/?oauth_error=${encodeURIComponent(oauthErr)}`);
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      res.redirect(`${env.CORS_ORIGIN}/?oauth_error=${encodeURIComponent('Missing OAuth code or state')}`);
      return;
    }

    try {
      const result = await authService.completeOAuthCallback(provider, code, state);
      setSessionCookie(res, result.token);
      res.redirect(`${env.CORS_ORIGIN}/?oauth=success`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth login failed';
      res.redirect(`${env.CORS_ORIGIN}/?oauth_error=${encodeURIComponent(msg)}`);
    }
  }
}

export const authController = new AuthController();
