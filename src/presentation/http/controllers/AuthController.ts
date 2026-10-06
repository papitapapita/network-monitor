import { Request, Response } from 'express';
import { Result } from 'domain/shared/core';
import {
  SIGN_IN_PAUSED,
  TWO_FACTOR_ALREADY_ON,
  TWO_FACTOR_NOT_STARTED
} from 'domain/identity';
import { ILogger } from 'application/shared/interfaces';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { StartTwoFactorSetupUseCase } from 'application/identity/use-cases/StartTwoFactorSetupUseCase';
import { ConfirmTwoFactorSetupUseCase } from 'application/identity/use-cases/ConfirmTwoFactorSetupUseCase';
import { VerifyTwoFactorUseCase } from 'application/identity/use-cases/VerifyTwoFactorUseCase';
import { RequestPasswordResetUseCase } from 'application/identity/use-cases/RequestPasswordResetUseCase';
import {
  RESET_LINK_EXPIRED,
  ResetPasswordUseCase
} from 'application/identity/use-cases/ResetPasswordUseCase';
import { PASSWORD_TOO_SHORT } from 'application/identity/services/userAccountPolicy';
import {
  INVALID_CODE,
  SIGN_IN_STEP_EXPIRED
} from 'application/identity/services/SignInSteps';
import {
  ConfirmTwoFactorSetupInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  VerifyTwoFactorInput
} from '../validation/auth.schemas';
import {
  clearSessionCookie,
  readCookie,
  setSessionCookies,
  TRUSTED_BROWSER_COOKIE
} from '../middleware/sessionCookies';

const FAILURES: Record<string, { status: number; error: string }> = {
  [SIGN_IN_PAUSED]: {
    status: 429,
    error: 'Too many failed sign-in attempts. Try again later.'
  },
  [SIGN_IN_STEP_EXPIRED]: {
    status: 401,
    error: 'Sign-in step expired. Sign in again.'
  },
  [INVALID_CODE]: { status: 401, error: INVALID_CODE },
  [TWO_FACTOR_ALREADY_ON]: {
    status: 409,
    error: TWO_FACTOR_ALREADY_ON
  },
  [TWO_FACTOR_NOT_STARTED]: {
    status: 409,
    error: TWO_FACTOR_NOT_STARTED
  },
  [RESET_LINK_EXPIRED]: { status: 400, error: RESET_LINK_EXPIRED },
  [PASSWORD_TOO_SHORT]: { status: 400, error: PASSWORD_TOO_SHORT }
};

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly startTwoFactorSetupUseCase: StartTwoFactorSetupUseCase,
    private readonly confirmTwoFactorSetupUseCase: ConfirmTwoFactorSetupUseCase,
    private readonly verifyTwoFactorUseCase: VerifyTwoFactorUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly logger: ILogger
  ) {}

  public login = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body as LoginInput;
    await this.answer(res, () =>
      this.loginUseCase.execute({
        email: body.email,
        password: body.password,
        trustedBrowserToken:
          body.trustedBrowserToken ??
          readCookie(req, TRUSTED_BROWSER_COOKIE),
        sourceIp: req.ip ?? null
      })
    );
  };

  public startTwoFactorSetup = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    await this.answer(res, () =>
      this.startTwoFactorSetupUseCase.execute({
        challengeToken: challengeToken(req)
      })
    );
  };

  public confirmTwoFactorSetup = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body as ConfirmTwoFactorSetupInput;
    await this.answer(res, () =>
      this.confirmTwoFactorSetupUseCase.execute({
        challengeToken: challengeToken(req),
        code: body.code,
        rememberBrowser: body.rememberBrowser ?? false,
        sourceIp: req.ip ?? null
      })
    );
  };

  public verifyTwoFactor = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body as VerifyTwoFactorInput;
    await this.answer(res, () =>
      this.verifyTwoFactorUseCase.execute({
        challengeToken: challengeToken(req),
        code: body.code ?? null,
        recoveryCode: body.recoveryCode ?? null,
        rememberBrowser: body.rememberBrowser ?? false,
        sourceIp: req.ip ?? null
      })
    );
  };

  // The same answer whether or not the address has an account (IDN-182).
  public forgotPassword = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body as ForgotPasswordInput;
    await this.answer(res, () =>
      this.requestPasswordResetUseCase.execute({ email: body.email })
    );
  };

  public resetPassword = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const body = req.body as ResetPasswordInput;
    await this.answer(res, () =>
      this.resetPasswordUseCase.execute({
        token: body.token,
        password: body.password
      })
    );
  };

  // Forgets the session in this browser only; the remembered browser stays
  // (IDN-062).
  public logout = (_req: Request, res: Response): void => {
    clearSessionCookie(res);
    res.status(200).json({ success: true, data: null });
  };

  private async answer<T>(
    res: Response,
    run: () => Promise<Result<T>>
  ): Promise<void> {
    try {
      const result = await run();
      if (result.isSuccess) {
        const data = result.value ?? null;
        if (data !== null) setSessionCookies(res, data as object);
        res.status(200).json({ success: true, data });
        return;
      }
      const known = FAILURES[result.error];
      if (known) {
        res
          .status(known.status)
          .json({ success: false, error: known.error });
        return;
      }
      // Wrong email, wrong password and disabled account read the same
      // (IDN-040); anything else is a fault on our side.
      if (result.error === 'Invalid credentials') {
        res
          .status(401)
          .json({ success: false, error: 'Invalid credentials' });
        return;
      }
      this.logger.error(
        'AuthController: sign-in step failed',
        undefined,
        {
          error: result.error
        }
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    } catch (error) {
      this.logger.error(
        'Unexpected error in AuthController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  }
}

function challengeToken(req: Request): string {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : '';
}
