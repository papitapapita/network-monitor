// Source: src/infrastructure/notifications/WhenConfiguredAlertPublisher.ts

import { WhenConfiguredAlertPublisher } from '../../../src/infrastructure/notifications/WhenConfiguredAlertPublisher';
import {
  IAlertPublisher,
  AlertNotification
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../src/domain/shared/core/Result';

const NOTIFICATION: AlertNotification = {
  deviceId: null,
  severity: AlertSeverity.CRITICAL,
  source: 'Agente',
  subject: 'Oficina',
  detail: 'Sin conexión',
  occurredAt: new Date('2026-09-30T20:00:00Z'),
  resolved: false,
  type: 'agent_offline'
};

describe('[AGT-023] WhenConfiguredAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;

  beforeEach(() => {
    inner = {
      publish: jest
        .fn()
        .mockResolvedValue(Result.fail('Telegram down'))
    };
  });

  it('forwards, and passes on the result, once the channel is configured', async () => {
    const publisher = new WhenConfiguredAlertPublisher(
      inner,
      async () => true
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(inner.publish).toHaveBeenCalledWith(NOTIFICATION);
    expect(result.error).toBe('Telegram down');
  });

  it('skips as a success while it is not', async () => {
    const publisher = new WhenConfiguredAlertPublisher(
      inner,
      async () => false
    );

    const result = await publisher.publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(inner.publish).not.toHaveBeenCalled();
  });
});
