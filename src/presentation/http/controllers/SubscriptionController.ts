import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';

export class SubscriptionController {
  constructor(
    private readonly getStatusUseCase: GetSubscriptionStatusUseCase,
    private readonly logger: ILogger
  ) {}

  public getStatus = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.getStatusUseCase.execute();
      if (result.isFailure) {
        res.status(500).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        'Unexpected error in SubscriptionController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };
}
