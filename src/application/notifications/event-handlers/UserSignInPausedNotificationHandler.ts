import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { UserSignInPausedEvent } from 'domain/identity/events';
import {
  IAlertPublisher,
  ILogger
} from 'application/shared/interfaces';

export const SIGN_IN_SOURCE = 'Inicio de sesión';
export const SIGN_IN_PAUSED_ALERT_TYPE = 'sign_in_paused';

// IDN-045. Sent to the install's own chat: whoever runs it is who must
// decide whether the failures were a forgotten password or someone guessing.
export class UserSignInPausedNotificationHandler
  implements IHandle<UserSignInPausedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: UserSignInPausedEvent): Promise<void> {
    try {
      const minutes = Math.round(
        (event.pausedUntil.getTime() -
          event.dateTimeOccurred.getTime()) /
          60_000
      );
      const from = event.sourceIp ? `Desde ${event.sourceIp}. ` : '';
      const result = await this.alertPublisher.publish({
        deviceId: null,
        severity: AlertSeverity.WARNING,
        source: SIGN_IN_SOURCE,
        summary: `${event.failedSignIns} contraseñas incorrectas seguidas en la cuenta ${event.email}`,
        detail: `${from}La cuenta espera ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} antes de aceptar otro intento, y cada nuevo fallo duplica la espera hasta 15 minutos.`,
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: SIGN_IN_PAUSED_ALERT_TYPE
      });
      if (result.isFailure) {
        this.logger.error(
          'UserSignInPausedNotificationHandler: publish failed',
          undefined,
          {
            userId: event.aggregateId.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'UserSignInPausedNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
