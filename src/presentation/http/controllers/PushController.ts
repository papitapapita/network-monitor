import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  SubscribePushUseCase,
  UnsubscribePushUseCase,
  SendTestPushUseCase,
  NO_PUSH_SUBSCRIPTION,
  TEST_PUSH_NOT_DELIVERED
} from 'application/notifications/use-cases';

export const PUSH_NOT_CONFIGURED =
  'Phone notifications are not configured on this server';

// Every action is on the signed-in user's own phones (NOT-225).
export class PushController {
  constructor(
    private readonly publicKey: string | null,
    private readonly subscribeUseCase: SubscribePushUseCase,
    private readonly unsubscribeUseCase: UnsubscribePushUseCase,
    private readonly sendTestUseCase: SendTestPushUseCase,
    private readonly logger: ILogger
  ) {}

  public getPublicKey = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    res.status(200).json({
      success: true,
      data: {
        enabled: this.publicKey !== null,
        publicKey: this.publicKey
      }
    });
  };

  public subscribe = (req: Request, res: Response): Promise<void> =>
    this.whenConfigured(res, () =>
      this.subscribeUseCase.execute({
        userId: req.user!.userId,
        endpoint: req.body.endpoint,
        keys: req.body.keys,
        userAgent: req.get('user-agent') ?? null
      })
    );

  public unsubscribe = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.unsubscribeUseCase.execute({
        userId: req.user!.userId,
        endpoint: req.body.endpoint
      })
    );

  public sendTest = (req: Request, res: Response): Promise<void> =>
    this.whenConfigured(res, () =>
      this.sendTestUseCase.execute({ userId: req.user!.userId })
    );

  private whenConfigured<T>(
    res: Response,
    action: () => Promise<Result<T>>
  ): Promise<void> {
    if (this.publicKey === null) {
      res
        .status(503)
        .json({ success: false, error: PUSH_NOT_CONFIGURED });
      return Promise.resolve();
    }
    return this.run(res, action);
  }

  private async run<T>(
    res: Response,
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
      res
        .status(200)
        .json({ success: true, data: result.value ?? null });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage === NO_PUSH_SUBSCRIPTION) return 409;
    if (errorMessage === TEST_PUSH_NOT_DELIVERED) return 502;
    if (
      errorMessage.includes('must be') ||
      errorMessage.includes('required')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in PushController',
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
