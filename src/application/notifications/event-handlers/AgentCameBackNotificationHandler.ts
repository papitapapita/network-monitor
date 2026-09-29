import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { AgentCameBackEvent } from 'domain/probe-agents/events';
import {
  IAlertPublisher,
  ILogger
} from 'application/shared/interfaces';
import { TelegramFormatting } from '../shared';
import {
  AGENT_HEALTH_SOURCE,
  AGENT_OFFLINE_ALERT_TYPE
} from './agentHealthAlert';

// R6: the one recovery message that follows an offline alert. Only an agent
// that was marked offline raises the event, so a short blip sends nothing.
export class AgentCameBackNotificationHandler
  implements IHandle<AgentCameBackEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: AgentCameBackEvent): Promise<void> {
    try {
      const offlineSince = TelegramFormatting.formatLocalTime(
        event.offlineSince
      );
      const result = await this.alertPublisher.publish({
        deviceId: null,
        severity: AlertSeverity.CRITICAL,
        source: AGENT_HEALTH_SOURCE,
        subject: 'Agente reconectado',
        detail: `El agente "${event.agentName}" volvió a reportar. Estaba sin conexión desde ${offlineSince}.`,
        occurredAt: event.dateTimeOccurred,
        resolved: true,
        type: AGENT_OFFLINE_ALERT_TYPE
      });
      if (result.isFailure) {
        this.logger.error(
          'AgentCameBackNotificationHandler: publish failed',
          undefined,
          {
            agentId: event.aggregateId.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'AgentCameBackNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
