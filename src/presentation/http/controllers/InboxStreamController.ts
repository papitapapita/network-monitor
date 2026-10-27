import { Request, Response } from 'express';
import {
  ILogger,
  IEventStreamHub
} from 'application/shared/interfaces';
import { GetUnreadInboxCountUseCase } from 'application/notifications/use-cases';
import {
  INBOX_UNREAD_EVENT,
  inboxUserChannel
} from 'application/notifications/channels';

// Every open tab holds one of these for as long as it is open, so it gets a
// per-user cap of its own instead of sharing the wireless streams' five.
// The install-wide cap is still the one every stream counts against.
const MAX_PER_USER = Number(
  process.env.SSE_MAX_INBOX_CONNECTIONS_PER_USER ?? 10
);
const MAX_TOTAL = Number(process.env.SSE_MAX_CONNECTIONS ?? 200);

const RETRY_MS = 5000;

// NOT-265: the signed-in user's own inbox, live.
export class InboxStreamController {
  private readonly connectionsPerUser = new Map<string, number>();

  constructor(
    private readonly unreadCountUseCase: GetUnreadInboxCountUseCase,
    private readonly hub: IEventStreamHub,
    private readonly logger: ILogger
  ) {}

  public stream = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const userId = req.user!.userId;
    try {
      if (!this.reserveSlot(userId, res)) return;

      const result = await this.unreadCountUseCase.execute({
        userId
      });

      // must run before any SSE header — the status is fixed once it opens
      if (result.isFailure) {
        this.releaseSlot(userId);
        res.status(500).json({ success: false, error: result.error });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.flushHeaders();

      res.write(`retry: ${RETRY_MS}\n\n`);
      res.write(
        `event: ${INBOX_UNREAD_EVENT}\ndata: ${JSON.stringify(result.value)}\n\n`
      );

      const unsubscribe = this.hub.subscribe(
        inboxUserChannel(userId),
        res
      );
      req.on('close', () => {
        unsubscribe();
        this.releaseSlot(userId);
      });
    } catch (error) {
      this.releaseSlot(userId);
      this.handleUnexpectedError(error, res);
    }
  };

  private reserveSlot(userId: string, res: Response): boolean {
    const forUser = this.connectionsPerUser.get(userId) ?? 0;

    if (
      forUser >= MAX_PER_USER ||
      this.hub.clientCount() >= MAX_TOTAL
    ) {
      this.logger.warn(
        '[InboxStreamController] Stream connection cap reached',
        { userId, forUser, total: this.hub.clientCount() }
      );
      res
        .status(429)
        .json({ success: false, error: 'Too many streams' });
      return false;
    }

    this.connectionsPerUser.set(userId, forUser + 1);
    return true;
  }

  private releaseSlot(userId: string): void {
    const forUser = this.connectionsPerUser.get(userId) ?? 0;
    if (forUser <= 1) {
      this.connectionsPerUser.delete(userId);
      return;
    }
    this.connectionsPerUser.set(userId, forUser - 1);
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in InboxStreamController',
      error as Error,
      { error: errorMessage }
    );

    if (res.headersSent) {
      res.end();
      return;
    }
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
