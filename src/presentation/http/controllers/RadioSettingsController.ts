import { Request, Response } from 'express';
import { ILogger } from 'application/shared/interfaces';
import {
  OUT_OF_SERVER_REACH,
  RADIO_SETTINGS_FAILURES
} from 'application/wireless-monitoring/interfaces';
import {
  RenameRadioUseCase,
  RevealWirelessKeyUseCase
} from 'application/wireless-monitoring/use-cases';

export class RadioSettingsController {
  constructor(
    private readonly revealWirelessKey: RevealWirelessKeyUseCase,
    private readonly renameRadio: RenameRadioUseCase,
    private readonly logger: ILogger
  ) {}

  public revealKey = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.revealWirelessKey.execute({
        deviceId: req.params.id,
        revealedBy: req.user!.userId
      });

      // A plaintext key must not linger in a browser or proxy cache.
      res.set('Cache-Control', 'no-store');
      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  public rename = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const result = await this.renameRadio.execute({
        deviceId: req.params.id,
        hostname: req.body.hostname,
        renamedBy: req.user!.userId
      });

      if (result.isFailure) {
        res
          .status(this.getErrorStatusCode(result.error!))
          .json({ error: result.error });
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      this.handleUnexpectedError(error, res);
    }
  };

  private getErrorStatusCode(message: string): number {
    if (message.includes(RADIO_SETTINGS_FAILURES.TIMEOUT)) return 504;
    if (
      message.includes(RADIO_SETTINGS_FAILURES.AGENT_ERROR) ||
      message.includes(RADIO_SETTINGS_FAILURES.RADIO)
    )
      return 502;
    if (
      message.includes(OUT_OF_SERVER_REACH) ||
      message.includes(RADIO_SETTINGS_FAILURES.AGENT_OFFLINE) ||
      message.includes(RADIO_SETTINGS_FAILURES.PROBE_UNSUPPORTED)
    )
      return 409;
    if (message.includes('No wireless polling configuration found'))
      return 404;
    if (
      message.includes('Invalid') ||
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('not configured') ||
      message.includes(RADIO_SETTINGS_FAILURES.UNSUPPORTED_VENDOR)
    )
      return 400;
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
