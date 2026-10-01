import { AgentUpdateFailedNotificationHandler } from '../../../../src/application/notifications/event-handlers';
import { AgentUpdateOutcome } from '../../../../src/domain/probe-agents';
import { AgentUpdateFailedEvent } from '../../../../src/domain/probe-agents/events';
import { AgentId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { IAlertPublisher } from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const event = (outcome: AgentUpdateOutcome) =>
  new AgentUpdateFailedEvent({
    aggregateId: AgentId.create(),
    agentName: 'Torre Norte',
    runningVersion: '0.2.0',
    targetVersion: '0.2.1',
    outcome,
    reason: 'No connection within 2 minutes',
    dateTimeOccurred: new Date('2026-10-01T17:00:00.000Z')
  });

describe('AgentUpdateFailedNotificationHandler', () => {
  it.each([
    [AgentUpdateOutcome.ROLLED_BACK, 'volvió a la 0.2.0'],
    [AgentUpdateOutcome.REJECTED, 'sigue en la 0.2.0']
  ])(
    '[AGT-084] warns with no device, naming the versions and the reason (%s)',
    async (outcome, phrase) => {
      const publisher: jest.Mocked<IAlertPublisher> = {
        publish: jest.fn().mockResolvedValue(Result.ok())
      };

      await new AgentUpdateFailedNotificationHandler(
        publisher,
        makeLogger()
      ).handle(event(outcome));

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: null,
          severity: AlertSeverity.WARNING,
          type: 'agent_update',
          resolved: false,
          detail: expect.stringMatching(
            new RegExp(
              `"Torre Norte".*0\\.2\\.1.*${phrase}.*No connection within 2 minutes`
            )
          )
        })
      );
    }
  );

  it('logs instead of throwing when the publisher fails', async () => {
    const logger = makeLogger();
    const publisher: jest.Mocked<IAlertPublisher> = {
      publish: jest
        .fn()
        .mockResolvedValue(Result.fail('Telegram down'))
    };

    await new AgentUpdateFailedNotificationHandler(
      publisher,
      logger
    ).handle(event(AgentUpdateOutcome.REJECTED));

    expect(logger.error).toHaveBeenCalled();
  });
});
