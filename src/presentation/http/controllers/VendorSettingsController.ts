import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import { GetVendorSettingsUseCase } from 'application/shared/use-cases/GetVendorSettingsUseCase';
import { UpdateVendorSettingsUseCase } from 'application/shared/use-cases/UpdateVendorSettingsUseCase';

export class VendorSettingsController {
  constructor(
    private readonly getUseCase: GetVendorSettingsUseCase,
    private readonly updateUseCase: UpdateVendorSettingsUseCase,
    private readonly logger: ILogger
  ) {}

  public get = (_req: Request, res: Response): Promise<void> =>
    this.run(res, () => this.getUseCase.execute({}));

  public update = (req: Request, res: Response): Promise<void> =>
    this.run(res, () =>
      this.updateUseCase.execute({
        vendorTelegramChatId: req.body.vendorTelegramChatId,
        subscriptionPaidUntil: req.body.subscriptionPaidUntil,
        subscriptionGraceDays: req.body.subscriptionGraceDays,
        subscriptionReadOnlyDays: req.body.subscriptionReadOnlyDays,
        pingResultRetentionDays: req.body.pingResultRetentionDays,
        alertRetentionDays: req.body.alertRetentionDays,
        wirelessSnapshotRetentionDays:
          req.body.wirelessSnapshotRetentionDays,
        wirelessAlertRecordRetentionDays:
          req.body.wirelessAlertRecordRetentionDays
      })
    );

  private async run<T>(
    res: Response,
    action: () => Promise<Result<T>>
  ): Promise<void> {
    try {
      const result = await action();
      if (result.isFailure) {
        const status = result.error!.startsWith('Failed to')
          ? 500
          : 400;
        res
          .status(status)
          .json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      this.logger.error(
        'Unexpected error in VendorSettingsController',
        error as Error
      );
      res
        .status(500)
        .json({ success: false, error: 'Internal server error' });
    }
  }
}
