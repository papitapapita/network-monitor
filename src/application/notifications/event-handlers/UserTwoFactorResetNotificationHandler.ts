import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { UserTwoFactorResetEvent } from 'domain/identity/events';
import {
  IAlertPublisher,
  ILogger
} from 'application/shared/interfaces';
import { SIGN_IN_SOURCE } from './UserSignInPausedNotificationHandler';

export const TWO_FACTOR_RESET_ALERT_TYPE = 'two_factor_reset';

// IDN-173. A reset is how someone with an administrator's session would take
// over an account, so the install's chat hears of every one.
export class UserTwoFactorResetNotificationHandler
  implements IHandle<UserTwoFactorResetEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: UserTwoFactorResetEvent): Promise<void> {
    try {
      const result = await this.alertPublisher.publish({
        deviceId: null,
        severity: AlertSeverity.WARNING,
        source: SIGN_IN_SOURCE,
        summary: `${event.resetBy} reinició la verificación en dos pasos de la cuenta ${event.email}`,
        detail:
          'La cuenta cerró todas sus sesiones y olvidó sus navegadores recordados. Configurará la app de nuevo en su próximo inicio de sesión. Si nadie lo pidió, revise quién tiene acceso de administrador.',
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: TWO_FACTOR_RESET_ALERT_TYPE
      });
      if (result.isFailure) {
        this.logger.error(
          'UserTwoFactorResetNotificationHandler: publish failed',
          undefined,
          {
            userId: event.aggregateId.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'UserTwoFactorResetNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
