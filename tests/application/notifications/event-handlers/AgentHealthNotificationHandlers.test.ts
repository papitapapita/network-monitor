import {
  AgentCameBackNotificationHandler,
  AgentWentOfflineNotificationHandler
} from '../../../../src/application/notifications/event-handlers';
import {
  AgentCameBackEvent,
  AgentWentOfflineEvent
} from '../../../../src/domain/probe-agents/events';
import { AgentId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const AGENT_ID = AgentId.create();
const OCCURRED = new Date('2026-09-28T17:05:00.000Z');
const SINCE = new Date('2026-09-28T17:00:00.000Z');

function makePublisher(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

describe('AgentWentOfflineNotificationHandler', () => {
  const event = new AgentWentOfflineEvent({
    aggregateId: AGENT_ID,
    agentName: 'Torre Norte',
    silentSince: SINCE,
    dateTimeOccurred: OCCURRED
  });

  it('[AGT-023] publishes a critical alert with no device', async () => {
    const publisher = makePublisher();

    await new AgentWentOfflineNotificationHandler(
      publisher,
      makeLogger()
    ).handle(event);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: null,
        severity: AlertSeverity.CRITICAL,
        resolved: false,
        type: 'agent_offline',
        occurredAt: OCCURRED,
        summary: expect.stringContaining('"Torre Norte" no reporta')
      })
    );
  });

  it('logs a failed delivery without throwing', async () => {
    const publisher = makePublisher();
    publisher.publish.mockResolvedValue(Result.fail('telegram down'));
    const logger = makeLogger();

    await new AgentWentOfflineNotificationHandler(
      publisher,
      logger
    ).handle(event);

    expect(logger.error).toHaveBeenCalled();
  });

  it('swallows an unexpected error', async () => {
    const publisher = makePublisher();
    publisher.publish.mockRejectedValue(new Error('boom'));
    const logger = makeLogger();

    await expect(
      new AgentWentOfflineNotificationHandler(
        publisher,
        logger
      ).handle(event)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('AgentCameBackNotificationHandler', () => {
  it('[AGT-023] publishes the resolution with no device', async () => {
    const publisher = makePublisher();

    await new AgentCameBackNotificationHandler(
      publisher,
      makeLogger()
    ).handle(
      new AgentCameBackEvent({
        aggregateId: AGENT_ID,
        agentName: 'Torre Norte',
        offlineSince: SINCE,
        dateTimeOccurred: OCCURRED
      })
    );

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: null,
        resolved: true,
        type: 'agent_offline',
        occurredAt: OCCURRED,
        summary: 'El agente "Torre Norte" volvió a reportar',
        detail: expect.stringContaining('Estaba sin conexión desde')
      })
    );
  });
});
