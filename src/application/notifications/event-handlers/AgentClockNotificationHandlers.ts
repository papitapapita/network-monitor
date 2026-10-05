import { IHandle } from 'domain/shared/interfaces';
import { AlertSeverity } from 'domain/shared/enums';
import { formatDuration } from 'domain/shared/utils';
import {
  AgentClockCorrectedEvent,
  AgentClockDriftedEvent
} from 'domain/probe-agents/events';
import {
  AlertNotification,
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  AGENT_CLOCK_ALERT_TYPE,
  AGENT_HEALTH_SOURCE
} from './agentHealthAlert';

// R12. Results are corrected for the offset either way; the warning is so
// someone fixes the PC's clock before it matters elsewhere (logs, a clock
// that keeps drifting, one that jumps back).
export class AgentClockDriftedNotificationHandler
  implements IHandle<AgentClockDriftedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: AgentClockDriftedEvent): Promise<void> {
    const direction =
      event.clockOffsetMs > 0 ? 'adelantado' : 'atrasado';
    await publish(this.alertPublisher, this.logger, event, {
      severity: AlertSeverity.WARNING,
      summary: `El reloj del PC del agente "${event.agentName}" está ${direction} ${formatDuration(event.clockOffsetMs / 1000)}`,
      detail:
        'Las mediciones se corrigen, pero ajusta la hora del PC ' +
        '(sincronización automática de Windows).',
      resolved: false
    });
  }
}

export class AgentClockCorrectedNotificationHandler
  implements IHandle<AgentClockCorrectedEvent>
{
  constructor(
    private readonly alertPublisher: IAlertPublisher,
    private readonly logger: ILogger
  ) {}

  async handle(event: AgentClockCorrectedEvent): Promise<void> {
    await publish(this.alertPublisher, this.logger, event, {
      severity: AlertSeverity.WARNING,
      summary: `El reloj del PC del agente "${event.agentName}" vuelve a estar en hora`,
      detail: null,
      resolved: true
    });
  }
}

async function publish(
  publisher: IAlertPublisher,
  logger: ILogger,
  event: AgentClockDriftedEvent | AgentClockCorrectedEvent,
  content: Pick<
    AlertNotification,
    'severity' | 'summary' | 'detail' | 'resolved'
  >
): Promise<void> {
  try {
    const result = await publisher.publish({
      deviceId: null,
      source: AGENT_HEALTH_SOURCE,
      occurredAt: event.dateTimeOccurred,
      type: AGENT_CLOCK_ALERT_TYPE,
      ...content
    });
    if (result.isFailure && !isSuppressedPublish(result.error)) {
      logger.error('Agent clock notification failed', undefined, {
        agentId: event.aggregateId.toString(),
        error: result.error
      });
    }
  } catch (error) {
    logger.error(
      'Agent clock notification: unexpected error',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
