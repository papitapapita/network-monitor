import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { AgentWentOfflineEvent } from 'domain/probe-agents/events';
import {
  IAlertPublisher,
  ILogger
} from 'application/shared/interfaces';
import { TelegramFormatting } from '../shared';
import {
  AGENT_HEALTH_SOURCE,
  AGENT_OFFLINE_ALERT_TYPE
} from './agentHealthAlert';

// R6. Not about a device, so no quiet hours or mute applies: while the agent
// is gone every device behind it is unmeasured.
export class AgentWentOfflineNotificationHandler
  implements IHandle<AgentWentOfflineEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: AgentWentOfflineEvent): Promise<void> {
    try {
      const silentSince = TelegramFormatting.formatLocalTime(
        event.silentSince
      );
      const result = await this.alertPublisher.publish({
        deviceId: null,
        severity: AlertSeverity.CRITICAL,
        source: AGENT_HEALTH_SOURCE,
        subject: 'Agente sin conexión',
        detail:
          `El agente "${event.agentName}" no reporta desde ${silentSince}. ` +
          'Los dispositivos que monitorea quedan sin medición hasta que vuelva.',
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: AGENT_OFFLINE_ALERT_TYPE
      });
      if (result.isFailure) {
        this.logger.error(
          'AgentWentOfflineNotificationHandler: publish failed',
          undefined,
          {
            agentId: event.aggregateId.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'AgentWentOfflineNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
