import { Router } from 'express';
import { z } from 'zod';
import {
  ChangePasswordSchema,
  CreateApiKeySchema,
  EnableMfaSchema,
  ForgotPasswordSchema,
  LoginSchema,
  PasskeyLoginOptionsSchema,
  PasskeyLoginVerifySchema,
  PasskeyRegisterVerifySchema,
  RegisterSchema,
  ResetPasswordSchema,
} from '@sure/shared';
import {
  asyncHandler,
  authenticateMiddleware,
  validateRequest,
} from '../../middleware/pipeline.js';
import { authController } from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post(
  '/register',
  validateRequest({ body: RegisterSchema }),
  asyncHandler(authController.register.bind(authController))
);

authRouter.post(
  '/login',
  validateRequest({ body: LoginSchema }),
  asyncHandler(authController.login.bind(authController))
);

authRouter.post(
  '/logout',
  asyncHandler(authController.logout.bind(authController))
);

authRouter.get(
  '/me',
  authenticateMiddleware,
  asyncHandler(authController.me.bind(authController))
);

authRouter.post(
  '/mfa/setup',
  authenticateMiddleware,
  asyncHandler(authController.setupMfa.bind(authController))
);

authRouter.post(
  '/mfa/enable',
  authenticateMiddleware,
  validateRequest({ body: EnableMfaSchema }),
  asyncHandler(authController.enableMfa.bind(authController))
);

authRouter.post(
  '/mfa/disable',
  authenticateMiddleware,
  asyncHandler(authController.disableMfa.bind(authController))
);

authRouter.get(
  '/api-keys',
  authenticateMiddleware,
  asyncHandler(authController.listApiKeys.bind(authController))
);

authRouter.post(
  '/api-keys',
  authenticateMiddleware,
  validateRequest({ body: CreateApiKeySchema }),
  asyncHandler(authController.createApiKey.bind(authController))
);

authRouter.delete(
  '/api-keys/:id',
  authenticateMiddleware,
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(authController.deleteApiKey.bind(authController))
);

authRouter.patch(
  '/password',
  authenticateMiddleware,
  validateRequest({ body: ChangePasswordSchema }),
  asyncHandler(authController.changePassword.bind(authController))
);

authRouter.get(
  '/providers',
  asyncHandler(authController.providers.bind(authController))
);

authRouter.get(
  '/oauth/:provider/start',
  asyncHandler(authController.oauthStart.bind(authController))
);

authRouter.get(
  '/oauth/:provider/callback',
  asyncHandler(authController.oauthCallback.bind(authController))
);

authRouter.post(
  '/password/forgot',
  validateRequest({ body: ForgotPasswordSchema }),
  asyncHandler(authController.forgotPassword.bind(authController))
);

authRouter.post(
  '/password/reset',
  validateRequest({ body: ResetPasswordSchema }),
  asyncHandler(authController.resetPassword.bind(authController))
);

authRouter.post(
  '/mfa/enable-passkey',
  authenticateMiddleware,
  asyncHandler(authController.enablePasskeyMfa.bind(authController))
);

authRouter.get(
  '/passkeys',
  authenticateMiddleware,
  asyncHandler(authController.listPasskeys.bind(authController))
);

authRouter.post(
  '/passkeys/register/options',
  authenticateMiddleware,
  asyncHandler(authController.passkeyRegisterOptions.bind(authController))
);

authRouter.post(
  '/passkeys/register/verify',
  authenticateMiddleware,
  validateRequest({ body: PasskeyRegisterVerifySchema }),
  asyncHandler(authController.passkeyRegisterVerify.bind(authController))
);

authRouter.delete(
  '/passkeys/:id',
  authenticateMiddleware,
  asyncHandler(authController.deletePasskey.bind(authController))
);

authRouter.post(
  '/passkeys/login/options',
  validateRequest({ body: PasskeyLoginOptionsSchema }),
  asyncHandler(authController.passkeyLoginOptions.bind(authController))
);

authRouter.post(
  '/passkeys/login/verify',
  validateRequest({ body: PasskeyLoginVerifySchema }),
  asyncHandler(authController.passkeyLoginVerify.bind(authController))
);

