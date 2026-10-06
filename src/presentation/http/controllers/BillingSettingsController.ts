import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import {
  GetBillingSettingsUseCase,
  UpdateBillingSettingsUseCase
} from 'application/billing/use-cases';

export class BillingSettingsController {
  constructor(
    private readonly getUseCase: GetBillingSettingsUseCase,
    private readonly updateUseCase: UpdateBillingSettingsUseCase,
    private readonly logger: ILogger
  ) {}

  public get = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.getUseCase.execute({}));

  public update = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.updateUseCase.execute({
        automaticBillingEnabled: req.body.automaticBillingEnabled,
        billingMode: req.body.billingMode,
        issueLeadDays: req.body.issueLeadDays,
        graceDays: req.body.graceDays
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
    if (errorMessage.includes('must be')) return 400;
    return 500;
  }

  private handleUnexpectedError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      'Unexpected error in BillingSettingsController',
      error as Error,
      { error: errorMessage }
    );

    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
