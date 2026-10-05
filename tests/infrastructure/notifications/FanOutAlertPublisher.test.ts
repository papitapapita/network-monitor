import { FanOutAlertPublisher } from '../../../src/infrastructure/notifications/FanOutAlertPublisher';
import { InstallLabelAlertPublisher } from '../../../src/infrastructure/notifications/InstallLabelAlertPublisher';
import {
  AlertNotification,
  IAlertPublisher
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../src/domain/shared/core/Result';

const NOTIFICATION: AlertNotification = {
  deviceId: null,
  severity: AlertSeverity.CRITICAL,
  source: 'Agente de sondeo',
  summary: 'Agente sin conexión',
  detail: 'El agente "Torre Norte" no reporta',
  occurredAt: new Date('2026-09-28T17:05:00.000Z'),
  resolved: false,
  type: 'agent_offline'
};

function makePublisher(
  result: Result<void> = Result.ok()
): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(result) };
}

describe('FanOutAlertPublisher', () => {
  it('[AGT-023] delivers to every publisher', async () => {
    const install = makePublisher();
    const vendor = makePublisher();

    const result = await new FanOutAlertPublisher([
      install,
      vendor
    ]).publish(NOTIFICATION);

    expect(result.isSuccess).toBe(true);
    expect(install.publish).toHaveBeenCalledWith(NOTIFICATION);
    expect(vendor.publish).toHaveBeenCalledWith(NOTIFICATION);
  });

  it('[AGT-023] still delivers to the rest when one fails, and reports it', async () => {
    const install = makePublisher(Result.fail('install chat down'));
    const vendor = makePublisher();

    const result = await new FanOutAlertPublisher([
      install,
      vendor
    ]).publish(NOTIFICATION);

    expect(vendor.publish).toHaveBeenCalled();
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('install chat down');
  });
});

describe('InstallLabelAlertPublisher', () => {
  it('[AGT-023] names the install in the source', async () => {
    const inner = makePublisher();

    await new InstallLabelAlertPublisher(
      inner,
      'api.cliente.com'
    ).publish(NOTIFICATION);

    expect(inner.publish).toHaveBeenCalledWith({
      ...NOTIFICATION,
      source: 'Agente de sondeo · api.cliente.com'
    });
  });
});
