import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  ListInboxNotificationsUseCase,
  GetUnreadInboxCountUseCase,
  MarkInboxNotificationReadUseCase,
  MarkAllInboxNotificationsReadUseCase,
  INBOX_NOTIFICATION_NOT_FOUND
} from 'application/notifications/use-cases';

// Every action is on the signed-in user's own inbox (NOT-260).
export class InboxNotificationController {
  constructor(
    private readonly listUseCase: ListInboxNotificationsUseCase,
    private readonly unreadCountUseCase: GetUnreadInboxCountUseCase,
    private readonly markReadUseCase: MarkInboxNotificationReadUseCase,
    private readonly markAllReadUseCase: MarkAllInboxNotificationsReadUseCase,
    private readonly logger: ILogger
  ) {}

  public list = (req: Request, res: Response): Promise<void> => {
    const q = req.query as Record<string, string | undefined>;
    return this.run(res, () =>
      this.listUseCase.execute({
        userId: req.user!.userId,
        unreadOnly: q.unread === 'true',
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined
      })
    );
  };

  public unreadCount = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.unreadCountUseCase.execute({ userId: req.user!.userId })
    );

  public markRead = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.markReadUseCase.execute({
        userId: req.user!.userId,
        id: req.params.id
      })
    );

  public markAllRead = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.markAllReadUseCase.execute({ userId: req.user!.userId })
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
    if (errorMessage === INBOX_NOTIFICATION_NOT_FOUND) return 404;
    if (
      errorMessage.startsWith('Invalid') ||
      errorMessage.includes('must be')
    ) {
      return 400;
    }
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in InboxNotificationController',
      error as Error,
      { error: errorMessage }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
