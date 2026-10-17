import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  NETWORK_SWEEP_RUNNING,
  RunNetworkSweepUseCase
} from 'application/device-monitoring/use-cases';
import {
  NETWORK_SWEEP_DONE_EVENT,
  NETWORK_SWEEP_RESULT_EVENT,
  NETWORK_SWEEP_START_EVENT
} from 'application/device-monitoring/channels';

export class NetworkSweepController {
  constructor(
    private readonly runNetworkSweepUseCase: RunNetworkSweepUseCase,
    private readonly logger: ILogger
  ) {}

  // The stream opens on the sweep's first frame, so a refusal (409, a
  // database error) can still answer as JSON with its own status code.
  public stream = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    try {
      const { locationId, category } = req.query as {
        locationId?: string;
        category?: string;
      };
      const result = await this.runNetworkSweepUseCase.execute({
        filters: {
          ...(locationId && { locationId }),
          ...(category && { category })
        },
        signal: abort.signal,
        onStart: (start) => {
          this.openStream(res);
          this.send(res, NETWORK_SWEEP_START_EVENT, start);
        },
        onResult: (sweepResult) =>
          this.send(res, NETWORK_SWEEP_RESULT_EVENT, sweepResult)
      });

      if (result.isFailure) {
        if (res.headersSent) {
          res.end();
          return;
        }
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      if (!result.value.cancelled) {
        this.send(res, NETWORK_SWEEP_DONE_EVENT, result.value);
      }
      res.end();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private openStream(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
  }

  private send(res: Response, event: string, payload: unknown): void {
    if (res.writableEnded) return;
    res.write(
      `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    );
  }

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage === NETWORK_SWEEP_RUNNING) return 409;
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
