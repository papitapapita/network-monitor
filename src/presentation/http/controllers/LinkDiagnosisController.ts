import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  StartLinkDiagnosisUseCase,
  GetLinkDiagnosisUseCase,
  StopLinkDiagnosisUseCase
} from 'application/wireless-monitoring/use-cases';
import { TOO_MANY_DIAGNOSES } from 'application/wireless-monitoring/interfaces';

export class LinkDiagnosisController {
  constructor(
    private readonly startLinkDiagnosisUseCase: StartLinkDiagnosisUseCase,
    private readonly getLinkDiagnosisUseCase: GetLinkDiagnosisUseCase,
    private readonly stopLinkDiagnosisUseCase: StopLinkDiagnosisUseCase,
    private readonly logger: ILogger
  ) {}

  // 201 when a session starts, 200 when the request joins one already running
  public start = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = (req.body ?? {}) as { durationSeconds?: number };
      const result = await this.startLinkDiagnosisUseCase.execute({
        deviceId: req.params.id,
        durationSeconds: body.durationSeconds
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(result.value.started ? 201 : 200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getLinkDiagnosisUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public stop = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.stopLinkDiagnosisUseCase.execute({
        deviceId: req.params.id
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res.status(statusCode).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage === TOO_MANY_DIAGNOSES) {
      return 429;
    }

    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('No wireless polling configuration found') ||
      errorMessage.includes('no longer exists')
    ) {
      return 404;
    }

    if (errorMessage.startsWith('Cannot diagnose device')) {
      return 409;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('must not exceed') ||
      errorMessage.includes('not configured') ||
      errorMessage.includes('no IP address configured') ||
      errorMessage.includes('no vendor to choose a collector') ||
      errorMessage.includes('is not supported for vendor')
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

    res.status(500).json({ error: 'Internal server error' });
  }
}
