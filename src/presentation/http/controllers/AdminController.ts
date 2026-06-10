import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { TriggerDataRetentionUseCase } from 'application/shared/use-cases/TriggerDataRetentionUseCase';

export class AdminController {
  constructor(
    private readonly triggerDataRetentionUseCase: TriggerDataRetentionUseCase,
    private readonly logger: ILogger
  ) {}

  public purgeStaleData = async (
    _req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.triggerDataRetentionUseCase.execute();

      if (result.isFailure) {
        this.logger.error(
          '[AdminController] Data retention purge failed',
          new Error(result.error)
        );
        res.status(500).json({ success: false, error: result.error });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        '[AdminController] Unexpected error during data retention purge',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  };
}
