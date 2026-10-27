import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  PING_TOOL_AGENT_NOT_FOUND,
  PING_TOOL_BUSY,
  PING_TOOL_NEEDS_AGENT,
  RunPingToolUseCase
} from 'application/device-monitoring/use-cases';
import {
  PING_TOOL_DONE_EVENT,
  PING_TOOL_REPLY_EVENT,
  PING_TOOL_START_EVENT
} from 'application/device-monitoring/channels';

export class PingToolController {
  constructor(
    private readonly runPingToolUseCase: RunPingToolUseCase,
    private readonly logger: ILogger
  ) {}

  // The stream opens on the first frame, so a refusal (404, 409) can still
  // answer as JSON with its own status code.
  public stream = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const abort = new AbortController();
    res.on('close', () => abort.abort());

    try {
      const { ip, agentId, count } = req.query as {
        ip: string;
        agentId?: string;
        count?: string;
      };
      const result = await this.runPingToolUseCase.execute({
        ipAddress: ip,
        ...(agentId && { agentId }),
        ...(count && { count: Number(count) }),
        signal: abort.signal,
        onStart: (start) => {
          this.openStream(res);
          this.send(res, PING_TOOL_START_EVENT, start);
        },
        onReply: (reply) =>
          this.send(res, PING_TOOL_REPLY_EVENT, reply)
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
        this.send(res, PING_TOOL_DONE_EVENT, result.value);
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
    if (errorMessage === PING_TOOL_AGENT_NOT_FOUND) return 404;
    if (
      errorMessage === PING_TOOL_NEEDS_AGENT ||
      errorMessage === PING_TOOL_BUSY
    ) {
      return 409;
    }
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
