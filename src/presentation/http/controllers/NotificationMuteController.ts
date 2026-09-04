import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  GetMutedAlertTypesUseCase,
  SetMutedAlertTypesUseCase
} from 'application/notifications/use-cases';

export class NotificationMuteController {
  constructor(
    private readonly getMutedAlertTypesUseCase: GetMutedAlertTypesUseCase,
    private readonly setMutedAlertTypesUseCase: SetMutedAlertTypesUseCase,
    private readonly logger: ILogger
  ) {}

  public get = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.getMutedAlertTypesUseCase.execute(
        {}
      );

      if (result.isFailure) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public replace = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.setMutedAlertTypesUseCase.execute({
        metrics: req.body?.metrics ?? []
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
      'Unexpected error in NotificationMuteController',
      error as Error,
      { error: errorMessage }
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}
