import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  GetNotificationSettingsUseCase,
  UpdateNotificationSettingsUseCase,
  SendTestNotificationUseCase,
  NO_TELEGRAM_CHAT,
  TEST_MESSAGE_NOT_DELIVERED
} from 'application/notifications/use-cases';

export class NotificationSettingsController {
  constructor(
    private readonly getUseCase: GetNotificationSettingsUseCase,
    private readonly updateUseCase: UpdateNotificationSettingsUseCase,
    private readonly sendTestUseCase: SendTestNotificationUseCase,
    private readonly logger: ILogger
  ) {}

  public get = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.getUseCase.execute({}));

  public update = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.updateUseCase.execute({
        telegramChatId: req.body.telegramChatId,
        downAlertDelayMinutes: req.body.downAlertDelayMinutes,
        wirelessAlertsEnabled: req.body.wirelessAlertsEnabled
      })
    );

  public sendTest = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.sendTestUseCase.execute({
        telegramChatId: req.body?.telegramChatId
      })
    );

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
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.startsWith(TEST_MESSAGE_NOT_DELIVERED))
      return 502;
    if (errorMessage === NO_TELEGRAM_CHAT) return 409;
    if (errorMessage.includes('must be')) return 400;
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in NotificationSettingsController',
      error as Error,
      { error: errorMessage }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
