import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { AgentUpdateOutcome } from 'domain/probe-agents';
import { AgentUpdateFailedEvent } from 'domain/probe-agents/events';
import {
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  AGENT_HEALTH_SOURCE,
  AGENT_UPDATE_ALERT_TYPE
} from './agentHealthAlert';

// AGT-084: the vendor's to fix, with a newer release; the customer's
// monitoring carries on with the version that still runs.
export class AgentUpdateFailedNotificationHandler
  implements IHandle<AgentUpdateFailedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: AgentUpdateFailedEvent): Promise<void> {
    const running = event.runningVersion ?? 'desconocida';
    const where =
      event.outcome === AgentUpdateOutcome.ROLLED_BACK
        ? `volvió a la ${running}`
        : `sigue en la ${running}`;
    try {
      const result = await this.alertPublisher.publish({
        deviceId: null,
        severity: AlertSeverity.WARNING,
        source: AGENT_HEALTH_SOURCE,
        subject: 'Actualización del agente fallida',
        detail:
          `El agente "${event.agentName}" no pudo actualizarse a la ` +
          `versión ${event.targetVersion} y ${where}. Motivo: ${event.reason}`,
        occurredAt: event.dateTimeOccurred,
        resolved: false,
        type: AGENT_UPDATE_ALERT_TYPE
      });
      if (result.isFailure && !isSuppressedPublish(result.error)) {
        this.logger.error(
          'AgentUpdateFailedNotificationHandler: publish failed',
          undefined,
          {
            agentId: event.aggregateId.toString(),
            error: result.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'AgentUpdateFailedNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
