import { Request, Response } from 'express';
import {
  ILogger,
  IEventStreamHub
} from 'application/shared/interfaces';
import {
  GetWirelessThroughputUseCase,
  GetFleetWirelessThroughputUseCase
} from 'application/wireless-monitoring/use-cases';
import {
  THROUGHPUT_EVENT,
  THROUGHPUT_SNAPSHOT_EVENT,
  THROUGHPUT_FLEET_CHANNEL,
  throughputDeviceChannel
} from 'application/wireless-monitoring/channels';

// Streams are long-lived, so the shared rate limiter cannot bound them —
// these caps do. Sockets, not requests per minute, are the scarce resource.
const MAX_PER_USER = Number(
  process.env.SSE_MAX_CONNECTIONS_PER_USER ?? 5
);
const MAX_TOTAL = Number(process.env.SSE_MAX_CONNECTIONS ?? 200);

// long enough to survive a poll cycle hiccup, short enough to feel instant
const RETRY_MS = 5000;

export class WirelessStreamController {
  private readonly connectionsPerUser = new Map<string, number>();

  constructor(
    private readonly getWirelessThroughputUseCase: GetWirelessThroughputUseCase,
    private readonly getFleetWirelessThroughputUseCase: GetFleetWirelessThroughputUseCase,
    private readonly hub: IEventStreamHub,
    private readonly logger: ILogger
  ) {}

  public streamDeviceThroughput = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.reserveSlot(req, res)) return;

      const deviceId = req.params.id;
      const result = await this.getWirelessThroughputUseCase.execute({
        deviceId
      });

      // the error path has to run before any SSE header is written —
      // once the stream opens the status code can no longer be changed
      if (result.isFailure) {
        this.releaseSlot(req);
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      this.openStream(
        req,
        res,
        throughputDeviceChannel(deviceId),
        THROUGHPUT_EVENT,
        result.value
      );
    } catch (error) {
      this.releaseSlot(req);
      this.handleUnexpectedError(error, res);
    }
  };

  public streamFleetThroughput = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      if (!this.reserveSlot(req, res)) return;

      const result =
        await this.getFleetWirelessThroughputUseCase.execute();

      if (result.isFailure) {
        this.releaseSlot(req);
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      // the opening frame is the whole fleet; everything after it is a
      // single-device delta on the same channel
      this.openStream(
        req,
        res,
        THROUGHPUT_FLEET_CHANNEL,
        THROUGHPUT_SNAPSHOT_EVENT,
        result.value
      );
    } catch (error) {
      this.releaseSlot(req);
      this.handleUnexpectedError(error, res);
    }
  };

  private openStream(
    req: Request,
    res: Response,
    channel: string,
    initialEvent: string,
    initialPayload: unknown
  ): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform also stops any intermediary from buffering to compress
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    res.write(`retry: ${RETRY_MS}\n\n`);
    res.write(
      `event: ${initialEvent}\ndata: ${JSON.stringify(initialPayload)}\n\n`
    );

    const unsubscribe = this.hub.subscribe(channel, res);

    req.on('close', () => {
      unsubscribe();
      this.releaseSlot(req);
    });
  }

  private reserveSlot(req: Request, res: Response): boolean {
    const userId = req.user?.userId ?? 'anonymous';
    const forUser = this.connectionsPerUser.get(userId) ?? 0;

    if (
      forUser >= MAX_PER_USER ||
      this.hub.clientCount() >= MAX_TOTAL
    ) {
      this.logger.warn(
        '[WirelessStreamController] Stream connection cap reached',
        { userId, forUser, total: this.hub.clientCount() }
      );
      res.status(429).json({ error: 'Too many streams' });
      return false;
    }

    this.connectionsPerUser.set(userId, forUser + 1);
    return true;
  }

  private releaseSlot(req: Request): void {
    const userId = req.user?.userId ?? 'anonymous';
    const forUser = this.connectionsPerUser.get(userId) ?? 0;

    if (forUser <= 1) {
      this.connectionsPerUser.delete(userId);
      return;
    }
    this.connectionsPerUser.set(userId, forUser - 1);
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('No wireless data found')) {
      return 404;
    }
    if (
      errorMessage.includes('Invalid') ||
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
      `Unexpected error in ${this.constructor.name}`,
      error as Error,
      { error: errorMessage }
    );

    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
