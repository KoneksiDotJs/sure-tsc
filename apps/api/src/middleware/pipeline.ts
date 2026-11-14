import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError, ZodSchema } from 'zod';
import { ApiErrorCode, FamilyRole } from '@sure/shared';
import { logger } from '../config/logger.js';
import { prisma } from '../config/prisma.js';
import { hashApiKey, verifySessionToken } from '../config/crypto.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth: {
        userId: string;
        familyId: string;
        role: FamilyRole;
        authType?: 'session' | 'api_key';
        scopes?: string[];
      };
    }
  }
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    code: ApiErrorCode,
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.statusCode = {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL_ERROR: 500,
    }[code];
  }
}

/**
 * 1. requestIdMiddleware — Attaches X-Request-Id for structured logging.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('X-Request-Id');
  const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export const SESSION_COOKIE_NAME = 'sure_session';

/**
 * 2. authenticateMiddleware — Verifies HTTP-only session cookie, signed Bearer session token,
 * or scoped personal ApiKey and populates `req.auth`.
 * Never trusts client-supplied familyId in request payloads; derives strictly from authenticated session/token.
 */
export async function authenticateMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.header('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const cookieToken =
      typeof req.cookies?.[SESSION_COOKIE_NAME] === 'string'
        ? req.cookies[SESSION_COOKIE_NAME]
        : undefined;

    const rawToken = bearerToken || cookieToken;
    if (!rawToken) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }

    // 1. Scoped API Key (`sure_live_...`)
    if (rawToken.startsWith('sure_live_')) {
      const keyHash = hashApiKey(rawToken);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          user: {
            include: { memberships: true },
          },
        },
      });

      if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
        throw new AppError('UNAUTHORIZED', 'Invalid or expired API key');
      }

      const membership = apiKey.user.memberships.find(
        (m) => m.familyId === apiKey.familyId
      );
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      req.auth = {
        userId: apiKey.userId,
        familyId: apiKey.familyId,
        role: (membership?.role ?? 'MEMBER') as FamilyRole,
        authType: 'api_key',
        scopes: apiKey.scopes,
      };
      next();
      return;
    }

    // 2. Signed Session Token (cookie or Bearer)
    const session = verifySessionToken(rawToken);
    if (session) {
      req.auth = {
        userId: session.userId,
        familyId: session.familyId,
        role: session.role,
        authType: 'session',
      };
      next();
      return;
    }

    throw new AppError('UNAUTHORIZED', 'Invalid authentication token');
  } catch (err) {
    next(err);
  }
}

/**
 * 3. validateRequest(zodSchema) — Validates req.body, req.query, and req.params before controller.
 */
export function validateRequest(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.') || 'root',
          message: issue.message,
        }));
        next(new AppError('VALIDATION_ERROR', 'Request validation failed', details));
        return;
      }
      next(err);
    }
  };
}

/**
 * Extracts a single route parameter as a string, normalizing Express v5 `string | string[]` param types.
 */
export function getRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }
  throw new AppError('VALIDATION_ERROR', `Missing or invalid route parameter: ${key}`);
}

/**
 * 4. asyncHandler(controllerFn) — Forwards thrown AppError instances to centralized errorHandlerMiddleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Centralized errorHandlerMiddleware returning Standard REST API v1 Error Envelope.
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error('Unhandled API error', {
    requestId: req.requestId,
    error: err instanceof Error ? err.message : String(err),
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred',
    },
  });
}
