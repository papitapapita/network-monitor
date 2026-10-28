// Source: src/application/device-monitoring/services/RouterSystemNotifier.ts

import { RouterSystemNotifier } from '../../../../src/application/device-monitoring/services/RouterSystemNotifier';
import {
  IReportedOutageQuery,
  PortSpeedRouterCandidate
} from '../../../../src/application/device-monitoring/interfaces';
import { RouterSystemState } from '../../../../src/domain/device-monitoring/aggregates';
import { RouterSystemReadingProps } from '../../../../src/domain/device-monitoring/props';
import { RouterHealthThresholds } from '../../../../src/domain/device-monitoring/value-objects';
import {
  IAlertPublisher,
  ILogger,
  TYPE_MUTED_SUPPRESSED
} from '../../../../src/application/shared/interfaces';
import { DeviceId } from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

const ROUTER_ID = '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60';
const NOW = new Date('2026-10-28T15:00:00Z');

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

const CANDIDATE: PortSpeedRouterCandidate = {
  deviceId: ROUTER_ID,
  deviceName: 'Core',
  ipAddress: '10.0.0.1',
  reach: { by: 'server' },
  login: { username: 'admin', password: 'secret', apiPort: 8728 }
};

function makeState(overrides: Partial<RouterSystemReadingProps>) {
  const state = RouterSystemState.createInitial(
    DeviceId.parse(ROUTER_ID).value,
    NOW
  );
  state.recordReading(
    {
      identity: 'Core',
      model: null,
      serialNumber: null,
      macAddress: null,
      boardName: null,
      routerOsVersion: null,
      currentFirmware: null,
      upgradeFirmware: null,
      uptimeSeconds: 600,
      cpuLoadPercent: 97,
      freeMemoryBytes: 60,
      totalMemoryBytes: 1000,
      freeHddBytes: 900,
      totalHddBytes: 1000,
      voltage: 21.5,
      temperatureC: 81,
      security: null,
      ...overrides
    },
    NOW
  );
  return state;
}

function setup() {
  const publisher: jest.Mocked<IAlertPublisher> = {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };
  const outages: jest.Mocked<IReportedOutageQuery> = {
    wasReportedDown: jest.fn().mockResolvedValue(Result.ok(false))
  };
  const logger = makeLogger();
  return {
    publisher,
    outages,
    logger,
    notifier: new RouterSystemNotifier(publisher, outages, logger)
  };
}

const THRESHOLDS = RouterHealthThresholds.create({
  ...RouterHealthThresholds.defaults().values,
  minVoltage: 22
}).value;

describe('RouterSystemNotifier', () => {
  it('[MON-174] should name one problem, its value and its limit in the summary', async () => {
    const { notifier, publisher } = setup();

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({}),
      { raised: ['TEMPERATURE'], recovered: [] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).toHaveBeenCalledWith({
      deviceId: ROUTER_ID,
      severity: 'WARNING',
      source: 'Estado de routers',
      summary: 'Temperatura de 81 °C en "Core" (más de 75 °C)',
      detail: null,
      occurredAt: NOW,
      resolved: false,
      type: 'router_health'
    });
  });

  it('[MON-174] should list several problems in the detail', async () => {
    const { notifier, publisher } = setup();

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({}),
      { raised: ['CPU', 'MEMORY', 'VOLTAGE'], recovered: [] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish.mock.calls[0]![0]).toMatchObject({
      summary: '3 problemas de salud en "Core"',
      detail: [
        '• CPU al 97 % (más de 90 %)',
        '• Memoria libre al 6 % (menos de 10 %)',
        '• Voltaje de 21,5 V (menos de 22 V)'
      ].join('\n')
    });
  });

  it('[MON-174] should send one recovery for what closed', async () => {
    const { notifier, publisher } = setup();

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({ temperatureC: 60 }),
      { raised: [], recovered: ['TEMPERATURE'] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Se normalizó la temperatura en "Core" (60 °C)',
        detail: null,
        resolved: true,
        type: 'router_health'
      })
    );
  });

  it('[MON-174] should list several recoveries in the detail', async () => {
    const { notifier, publisher } = setup();

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({ cpuLoadPercent: 20, temperatureC: 60 }),
      { raised: [], recovered: ['CPU', 'TEMPERATURE'] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish.mock.calls[0]![0]).toMatchObject({
      summary: 'Se normalizaron 2 problemas de salud en "Core"',
      detail: '• La CPU: 20 %\n• La temperatura: 60 °C'
    });
  });

  it('[MON-174] should send nothing when nothing changed', async () => {
    const { notifier, publisher } = setup();

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({}),
      { raised: [], recovered: [] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('[MON-174] should not log a muted notice as a failure', async () => {
    const { notifier, publisher, logger } = setup();
    publisher.publish.mockResolvedValue(
      Result.fail(TYPE_MUTED_SUPPRESSED)
    );

    await notifier.notifyHealth(
      CANDIDATE,
      makeState({}),
      { raised: ['CPU'], recovered: [] },
      THRESHOLDS,
      NOW
    );

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log a notice that could not be sent', async () => {
    const { notifier, publisher, logger } = setup();
    publisher.publish.mockResolvedValue(Result.fail('telegram down'));

    const told = await notifier.notifyReboot(CANDIDATE, NOW, NOW);

    expect(told).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Router notice not sent',
      undefined,
      expect.objectContaining({ type: 'router_rebooted' })
    );
  });

  it('[MON-171] should look for down notices from 10 minutes before the boot until now', async () => {
    const { notifier, outages } = setup();
    const bootedAt = new Date('2026-10-28T14:50:00Z');

    await notifier.notifyReboot(CANDIDATE, bootedAt, NOW);

    expect(outages.wasReportedDown).toHaveBeenCalledWith(
      ROUTER_ID,
      new Date('2026-10-28T14:40:00Z'),
      NOW
    );
  });
});
