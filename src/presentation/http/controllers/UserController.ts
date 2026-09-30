import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  ListUsersUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  ChangeOwnPasswordUseCase,
  OWN_ACCOUNT_REFUSED,
  VENDOR_ACCOUNT_PROTECTED,
  WRONG_CURRENT_PASSWORD
} from 'application/identity';

export class UserController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly changeOwnPasswordUseCase: ChangeOwnPasswordUseCase,
    private readonly logger: ILogger
  ) {}

  public list = (req: Request, res: Response): Promise<void> =>
    this.run(res, 200, () =>
      this.listUsersUseCase.execute({ callerRole: req.user!.role })
    );

  public create = (req: Request, res: Response): Promise<void> =>
    this.run(res, 201, () =>
      this.createUserUseCase.execute({
        email: req.body.email,
        password: req.body.password,
        role: req.body.role
      })
    );

  public update = (req: Request, res: Response): Promise<void> =>
    this.run(res, 200, () =>
      this.updateUserUseCase.execute({
        id: req.params.id,
        callerId: req.user!.userId,
        role: req.body.role,
        disabled: req.body.disabled,
        password: req.body.password
      })
    );

  public changeOwnPassword = (
    req: Request,
    res: Response
  ): Promise<void> =>
    this.run(res, 200, () =>
      this.changeOwnPasswordUseCase.execute({
        userId: req.user!.userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword
      })
    );

  private async run<T>(
    res: Response,
    status: number,
    action: () => Promise<Result<T>>
  ): Promise<void> {
    try {
      const result = await action();
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ success: false, error: result.error });
        return;
      }
      res.status(status).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage === VENDOR_ACCOUNT_PROTECTED ||
      errorMessage === OWN_ACCOUNT_REFUSED
    ) {
      return 403;
    }
    if (errorMessage.includes('not found')) return 404;
    if (errorMessage.includes('already exists')) return 409;
    if (
      errorMessage === WRONG_CURRENT_PASSWORD ||
      errorMessage === 'Nothing to update' ||
      errorMessage.includes('Invalid') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('cannot be assigned') ||
      errorMessage.includes('not valid') ||
      errorMessage.includes('must not exceed')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    this.logger.error(
      'Unexpected error in UserController',
      error as Error,
      {
        error: errorMessage
      }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
