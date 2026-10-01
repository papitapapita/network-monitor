import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  ListSuspensionEnforcementsUseCase,
  GetServiceEnforcementStatusUseCase
} from 'application/service-enforcement/use-cases';

// With no router set yet the use cases fail with "Enforcement router is not
// configured", which answers 503 like every other router problem.
export class EnforcementController {
  constructor(
    private readonly listSuspensionEnforcementsUseCase: ListSuspensionEnforcementsUseCase,
    private readonly getServiceEnforcementStatusUseCase: GetServiceEnforcementStatusUseCase,
    private readonly logger: ILogger
  ) {}

  public listSuspensions = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.listSuspensionEnforcementsUseCase.execute({});
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

  public getServiceEnforcement = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result =
        await this.getServiceEnforcementStatusUseCase.execute({
          contractedServiceId: req.params.id
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

  private getErrorStatusCode(errorMessage: string): number {
    if (
      errorMessage.includes('RouterOS API error') ||
      errorMessage.includes('router device not found') ||
      errorMessage.includes('Enforcement router')
    ) {
      return 503;
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
      'Unexpected error in EnforcementController',
      error as Error,
      { error: errorMessage }
    );
    res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
