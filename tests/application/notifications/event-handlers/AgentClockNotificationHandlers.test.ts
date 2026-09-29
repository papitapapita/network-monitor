import {
  AgentClockCorrectedNotificationHandler,
  AgentClockDriftedNotificationHandler
} from '../../../../src/application/notifications/event-handlers';
import {
  AgentClockCorrectedEvent,
  AgentClockDriftedEvent
} from '../../../../src/domain/probe-agents/events';
import { AgentId } from '../../../../src/domain/shared/ids';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  IAlertPublisher,
  QUIET_HOURS_SUPPRESSED
} from '../../../../src/application/shared/interfaces/IAlertPublisher';
import { makeLogger } from '../../probe-agents/fixtures';

const props = (clockOffsetMs: number) => ({
  aggregateId: AgentId.create(),
  agentName: 'Torre Norte',
  clockOffsetMs,
  dateTimeOccurred: new Date('2026-09-29T17:00:00.000Z')
});

function makePublisher(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

describe('Agent clock notification handlers', () => {
  it.each([
    [90_000, 'adelantado 90 segundos'],
    [-600_000, 'atrasado 10 minutos'],
    [-3 * 3_600_000, 'atrasado 3 horas']
  ])(
    '[AGT-025] warns with no device for an offset of %i ms',
    async (offset, phrase) => {
      const publisher = makePublisher();

      await new AgentClockDriftedNotificationHandler(
        publisher,
        makeLogger()
      ).handle(new AgentClockDriftedEvent(props(offset)));

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: null,
          severity: AlertSeverity.WARNING,
          type: 'agent_clock',
          resolved: false,
          detail: expect.stringContaining(phrase)
        })
      );
    }
  );

  it('[AGT-025] sends the all-clear as a resolution', async () => {
    const publisher = makePublisher();

    await new AgentClockCorrectedNotificationHandler(
      publisher,
      makeLogger()
    ).handle(new AgentClockCorrectedEvent(props(1_000)));

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'agent_clock', resolved: true })
    );
  });

  it('logs a failed delivery, but not a deliberate suppression', async () => {
    const publisher = makePublisher();
    const logger = makeLogger();
    const handler = new AgentClockDriftedNotificationHandler(
      publisher,
      logger
    );

    publisher.publish.mockResolvedValueOnce(
      Result.fail(QUIET_HOURS_SUPPRESSED)
    );
    await handler.handle(new AgentClockDriftedEvent(props(90_000)));
    expect(logger.error).not.toHaveBeenCalled();

    publisher.publish.mockResolvedValueOnce(
      Result.fail('telegram down')
    );
    await handler.handle(new AgentClockDriftedEvent(props(90_000)));
    expect(logger.error).toHaveBeenCalled();
  });
});
