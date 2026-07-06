import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { ScanNetworkSegmentInput } from '../validation/scan.schemas';
import { ScanNetworkSegmentUseCase } from 'application/device-inventory/use-cases';

export class ScanController {
  constructor(
    private readonly scanUseCase: ScanNetworkSegmentUseCase,
    private readonly logger: ILogger
  ) {}

  public scan = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const body = req.body as ScanNetworkSegmentInput;

      const result = await this.scanUseCase.execute({
        segment: body.segment
      });

      if (result.isFailure) {
        const statusCode = this.getErrorStatusCode(result.error!);
        res
          .status(statusCode)
          .json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('not found')) {
      return 404;
    }

    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('cannot be empty') ||
      errorMessage.includes('must be') ||
      errorMessage.includes('must not exceed') ||
      errorMessage.includes('already assigned') ||
      errorMessage.includes('too large') ||
      errorMessage.includes('range')
    ) {
      return 400;
    }

    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in ScanController',
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
