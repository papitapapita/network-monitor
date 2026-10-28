// Source: src/application/device-monitoring/services/PortHealthNotifier.ts

import {
  PORT_HEALTH_ALERT_TYPE,
  PortHealthNotifier
} from '../../../../src/application/device-monitoring/services/PortHealthNotifier';
import {
  EthernetPortReading,
  PortSpeedRouterCandidate
} from '../../../../src/application/device-monitoring/interfaces';
import { RouterPortCounters } from '../../../../src/domain/device-monitoring/aggregates';
import { PortCounterReadingProps } from '../../../../src/domain/device-monitoring/props';
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
const THRESHOLDS = RouterHealthThresholds.defaults();

const CANDIDATE: PortSpeedRouterCandidate = {
  deviceId: ROUTER_ID,
  deviceName: 'Core',
  ipAddress: '10.0.0.1',
  reach: { by: 'server' },
  login: { username: 'admin', password: 'secret', apiPort: 8728 }
};

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

function makePort(
  name: string,
  overrides: Partial<EthernetPortReading> = {}
): EthernetPortReading {
  return {
    name,
    comment: null,
    linked: true,
    rateMbps: 1000,
    fullDuplex: true,
    rxErrors: null,
    linkDowns: null,
    sfp: null,
    ...overrides
  };
}

// Counters after two checks: the second adds what `second` says on top of 0.
function makeCounters(second: PortCounterReadingProps[]) {
  const counters = RouterPortCounters.createInitial(
    DeviceId.parse(ROUTER_ID).value
  );
  counters.recordCheck(
    second.map((r) => ({ ...r, rxErrors: 0, linkDowns: 0 })),
    THRESHOLDS,
    NOW
  );
  counters.recordCheck(second, THRESHOLDS, NOW);
  return counters;
}

function setup() {
  const publisher: jest.Mocked<IAlertPublisher> = {
    publish: jest.fn().mockResolvedValue(Result.ok())
  };
  const logger = makeLogger();
  return {
    publisher,
    logger,
    notifier: new PortHealthNotifier(publisher, logger)
  };
}

const sfp = (rxPowerDbm: number) => ({
  rxPowerDbm,
  txPowerDbm: -2,
  temperatureC: 40
});

describe('PortHealthNotifier', () => {
  it('[MON-197] should name one port with its comment and what the check added', async () => {
    const { notifier, publisher } = setup();

    await notifier.notify(
      CANDIDATE,
      [makePort('ether5', { comment: 'Torre norte' })],
      makeCounters([
        {
          name: 'ether5',
          rxErrors: 1250,
          linkDowns: 0,
          sfpRxPowerDbm: null
        }
      ]),
      {
        raised: [{ portName: 'ether5', issue: 'ERRORS' }],
        recovered: []
      },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).toHaveBeenCalledWith({
      deviceId: ROUTER_ID,
      severity: 'WARNING',
      source: 'Estado de puertos',
      summary:
        'El puerto ether5 (Torre norte) de "Core" sigue sumando errores (+1.250 en el último chequeo)',
      detail: null,
      occurredAt: NOW,
      resolved: false,
      type: PORT_HEALTH_ALERT_TYPE
    });
  });

  it('[MON-197] should list several problems of a router in one notice', async () => {
    const { notifier, publisher } = setup();

    await notifier.notify(
      CANDIDATE,
      [makePort('ether2'), makePort('sfp1', { sfp: sfp(-23.45) })],
      makeCounters([
        {
          name: 'ether2',
          rxErrors: 0,
          linkDowns: 1,
          sfpRxPowerDbm: null
        },
        {
          name: 'sfp1',
          rxErrors: 0,
          linkDowns: 4,
          sfpRxPowerDbm: -23.45
        }
      ]),
      {
        raised: [
          { portName: 'ether2', issue: 'FLAPPING' },
          { portName: 'sfp1', issue: 'FLAPPING' },
          { portName: 'sfp1', issue: 'SFP_RX_LOW' }
        ],
        recovered: []
      },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish.mock.calls[0]![0]).toMatchObject({
      summary: '3 problemas en puertos de "Core"',
      detail: [
        '• ether2: se cayó 1 vez en el último chequeo',
        '• sfp1: se cayó 4 veces en el último chequeo',
        '• sfp1: recibe -23,5 dBm por la fibra (menos de -20 dBm)'
      ].join('\n')
    });
  });

  it('[MON-197] should send one recovery for what closed', async () => {
    const { notifier, publisher } = setup();

    await notifier.notify(
      CANDIDATE,
      [makePort('sfp1', { sfp: sfp(-15) })],
      makeCounters([
        {
          name: 'sfp1',
          rxErrors: 0,
          linkDowns: 0,
          sfpRxPowerDbm: -15
        }
      ]),
      {
        raised: [],
        recovered: [{ portName: 'sfp1', issue: 'SFP_RX_LOW' }]
      },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        resolved: true,
        summary:
          'El puerto sfp1 de "Core" volvió a recibir bien por la fibra (-15 dBm)',
        detail: null
      })
    );
  });

  it('[MON-197] should list several recoveries in the detail', async () => {
    const { notifier, publisher } = setup();

    await notifier.notify(
      CANDIDATE,
      [makePort('ether1'), makePort('ether2')],
      makeCounters([]),
      {
        raised: [],
        recovered: [
          { portName: 'ether1', issue: 'ERRORS' },
          { portName: 'ether2', issue: 'FLAPPING' }
        ]
      },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish.mock.calls[0]![0]).toMatchObject({
      summary: 'Se normalizaron 2 problemas en puertos de "Core"',
      detail:
        '• ether1: dejó de sumar errores\n• ether2: dejó de caerse'
    });
  });

  it('[MON-197] should send nothing when nothing changed', async () => {
    const { notifier, publisher } = setup();

    await notifier.notify(
      CANDIDATE,
      [],
      makeCounters([]),
      { raised: [], recovered: [] },
      THRESHOLDS,
      NOW
    );

    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('[MON-197] should not log a muted notice as a failure, but log one not sent', async () => {
    const { notifier, publisher, logger } = setup();
    const change = {
      raised: [{ portName: 'ether1', issue: 'ERRORS' as const }],
      recovered: []
    };
    const send = () =>
      notifier.notify(
        CANDIDATE,
        [makePort('ether1')],
        makeCounters([]),
        change,
        THRESHOLDS,
        NOW
      );

    publisher.publish.mockResolvedValue(
      Result.fail(TYPE_MUTED_SUPPRESSED)
    );
    await send();
    expect(logger.error).not.toHaveBeenCalled();

    publisher.publish.mockResolvedValue(Result.fail('telegram down'));
    await send();
    expect(logger.error).toHaveBeenCalledWith(
      'Port health notice not sent',
      undefined,
      { deviceId: ROUTER_ID, error: 'telegram down' }
    );
  });
});
