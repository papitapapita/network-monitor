import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  ListSpeedTestsUseCase,
  RunSpeedTestUseCase,
  SPEED_TEST_NEEDS_SERVER_ON_SITE,
  SPEED_TEST_RUNNING
} from 'application/device-monitoring/use-cases';
import {
  SPEED_TEST_DONE_EVENT,
  SPEED_TEST_PROGRESS_EVENT,
  SPEED_TEST_START_EVENT
} from 'application/device-monitoring/channels';

export class SpeedTestController {
  constructor(
    private readonly runSpeedTestUseCase: RunSpeedTestUseCase,
    private readonly listSpeedTestsUseCase: ListSpeedTestsUseCase,
    private readonly logger: ILogger
  ) {}

  // The stream opens on the test's first frame, so a refusal (409) can still
  // answer as JSON with its own status code.
  public stream = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    try {
      const result = await this.runSpeedTestUseCase.execute({
        startedBy: {
          userId: req.user!.userId,
          email: req.user!.email
        },
        signal: abort.signal,
        onStart: (start) => {
          this.openStream(res);
          this.send(res, SPEED_TEST_START_EVENT, start);
        },
        onProgress: (progress) =>
          this.send(res, SPEED_TEST_PROGRESS_EVENT, progress)
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

      if (result.value.result) {
        this.send(res, SPEED_TEST_DONE_EVENT, result.value.result);
      }
      res.end();
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public list = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await this.listSpeedTestsUseCase.execute({
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined
      });
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
    if (
      errorMessage === SPEED_TEST_RUNNING ||
      errorMessage === SPEED_TEST_NEEDS_SERVER_ON_SITE
    ) {
      return 409;
    }
    if (errorMessage.includes('must be')) return 400;
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
