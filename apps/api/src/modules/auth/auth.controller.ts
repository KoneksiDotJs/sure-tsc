import { Request, Response } from 'express';
import { getRouteParam, SESSION_COOKIE_NAME } from '../../middleware/pipeline.js';
import { authService } from './auth.service.js';

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
    const result = await authService.login(req.body);
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
}

export const authController = new AuthController();
