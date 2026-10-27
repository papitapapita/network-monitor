// Source: src/application/notifications/shared/OutageRollup.ts

import { OutageRollup } from '../../../../src/application/notifications/shared/OutageRollup';
import { IOutageTopologyQuery } from '../../../../src/application/notifications/interfaces/IOutageTopologyQuery';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertProps } from '../../../../src/domain/notifications/props/AlertProps';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../../src/domain/shared/enums/AlertSeverity';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const ROOT = '550e8400-e29b-41d4-a716-446655440001';
const SWITCH = '550e8400-e29b-41d4-a716-446655440002';
const CPE_A = '550e8400-e29b-41d4-a716-446655440003';
const CPE_B = '550e8400-e29b-41d4-a716-446655440004';
const ELSEWHERE = '550e8400-e29b-41d4-a716-446655440005';
const NOW = new Date('2024-06-01T10:00:00.000Z');

function makeAlert(
  deviceUuid: string,
  overrides: Partial<AlertProps> = {}
): Alert {
  return Alert.reconstitute(AlertId.create(), {
    deviceId: DeviceId.parse(deviceUuid).value,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión.',
    details: {},
    startedAt: NOW,
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    causedByAlertId: null,
    ...overrides
  });
}

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

// ROOT → SWITCH → CPE_A, and ROOT → CPE_B
const DOWNSTREAM = [
  {
    deviceId: SWITCH,
    name: 'Switch Sur',
    ipAddress: '10.0.0.2',
    upstreamDeviceId: ROOT
  },
  {
    deviceId: CPE_A,
    name: 'Cliente A',
    ipAddress: '10.0.0.3',
    upstreamDeviceId: SWITCH
  },
  {
    deviceId: CPE_B,
    name: 'Cliente B',
    ipAddress: null,
    upstreamDeviceId: ROOT
  }
];

describe('OutageRollup', () => {
  let alertRepo: jest.Mocked<IAlertRepository>;
  let topology: jest.Mocked<IOutageTopologyQuery>;
  let logger: jest.Mocked<ILogger>;
  let rollup: OutageRollup;
  let root: Alert;

  beforeEach(() => {
    alertRepo = {
      save: jest.fn(async (alert: Alert) => Result.ok(alert)),
      findById: jest.fn(),
      findOpenByDeviceAndType: jest.fn(),
      findAllOpenByDeviceId: jest.fn(),
      findAllOpenByType: jest.fn().mockResolvedValue(Result.ok([])),
      findAffectedBy: jest.fn().mockResolvedValue(Result.ok([])),
      deleteById: jest.fn(),
      deleteResolvedOlderThan: jest.fn()
    };
    topology = {
      findUpstreamIds: jest.fn(),
      findDownstream: jest
        .fn()
        .mockResolvedValue(Result.ok(DOWNSTREAM)),
      findByIds: jest.fn().mockResolvedValue(Result.ok([]))
    };
    logger = makeLogger();
    rollup = new OutageRollup(alertRepo, topology, logger);
    root = makeAlert(ROOT);
  });

  describe('[NOT-243] attachDownstream()', () => {
    it('attaches every unnotified down alert behind the root', async () => {
      const a = makeAlert(CPE_A);
      const b = makeAlert(CPE_B);
      alertRepo.findAllOpenByType.mockResolvedValue(
        Result.ok([a, b])
      );

      await rollup.attachDownstream(root);

      expect(a.causedByAlertId?.equals(root.id)).toBe(true);
      expect(b.causedByAlertId?.equals(root.id)).toBe(true);
      expect(alertRepo.save).toHaveBeenCalledTimes(2);
    });

    it('leaves alone a device that is not behind the root', async () => {
      const other = makeAlert(ELSEWHERE);
      alertRepo.findAllOpenByType.mockResolvedValue(
        Result.ok([other])
      );

      await rollup.attachDownstream(root);

      expect(other.causedByAlertId).toBeNull();
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('leaves alone a device already paged on its own', async () => {
      const paged = makeAlert(CPE_A, { notifiedAt: NOW });
      alertRepo.findAllOpenByType.mockResolvedValue(
        Result.ok([paged])
      );

      await rollup.attachDownstream(root);

      expect(paged.causedByAlertId).toBeNull();
    });

    it('does not re-save a device already attached to this root', async () => {
      const attached = makeAlert(CPE_A, { causedByAlertId: root.id });
      alertRepo.findAllOpenByType.mockResolvedValue(
        Result.ok([attached])
      );

      await rollup.attachDownstream(root);

      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('moves a device held by an older outage onto this one', async () => {
      const held = makeAlert(CPE_A, {
        causedByAlertId: AlertId.create()
      });
      alertRepo.findAllOpenByType.mockResolvedValue(
        Result.ok([held])
      );

      await rollup.attachDownstream(root);

      expect(held.causedByAlertId?.equals(root.id)).toBe(true);
    });

    it('does nothing for a root with nothing behind it', async () => {
      topology.findDownstream.mockResolvedValue(Result.ok([]));

      await rollup.attachDownstream(root);

      expect(alertRepo.findAllOpenByType).not.toHaveBeenCalled();
    });

    it('logs and gives up when the downstream cannot be read', async () => {
      topology.findDownstream.mockResolvedValue(
        Result.fail('db down')
      );

      await rollup.attachDownstream(root);

      expect(logger.warn).toHaveBeenCalled();
      expect(alertRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('[NOT-243] affected()', () => {
    it('is empty when nothing is attached', async () => {
      const result = await rollup.affected(root);

      expect(result.value).toEqual([]);
      expect(topology.findDownstream).not.toHaveBeenCalled();
    });

    it('names each attached device, its status and the device it hangs from', async () => {
      alertRepo.findAffectedBy.mockResolvedValue(
        Result.ok([
          makeAlert(SWITCH, { causedByAlertId: root.id }),
          makeAlert(CPE_A, {
            causedByAlertId: root.id,
            resolvedAt: NOW
          }),
          makeAlert(CPE_B, { causedByAlertId: root.id })
        ])
      );

      const result = await rollup.affected(root);

      expect(result.value).toEqual([
        {
          deviceId: SWITCH,
          name: 'Switch Sur',
          ipAddress: '10.0.0.2',
          status: 'DOWN',
          viaDeviceId: null,
          viaDeviceName: null
        },
        {
          deviceId: CPE_A,
          name: 'Cliente A',
          ipAddress: '10.0.0.3',
          status: 'UP',
          viaDeviceId: SWITCH,
          viaDeviceName: 'Switch Sur'
        },
        {
          deviceId: CPE_B,
          name: 'Cliente B',
          ipAddress: null,
          status: 'DOWN',
          viaDeviceId: null,
          viaDeviceName: null
        }
      ]);
    });

    it('has no via when the device in between is not affected', async () => {
      alertRepo.findAffectedBy.mockResolvedValue(
        Result.ok([makeAlert(CPE_A, { causedByAlertId: root.id })])
      );

      const result = await rollup.affected(root);

      expect(result.value[0].viaDeviceId).toBeNull();
    });

    it('still names a device moved out of the subtree since', async () => {
      alertRepo.findAffectedBy.mockResolvedValue(
        Result.ok([
          makeAlert(ELSEWHERE, {
            causedByAlertId: root.id,
            details: { ipAddress: '10.9.9.9' }
          })
        ])
      );
      topology.findByIds.mockResolvedValue(
        Result.ok([
          {
            deviceId: ELSEWHERE,
            name: 'Movido',
            ipAddress: null,
            upstreamDeviceId: SWITCH
          }
        ])
      );

      const result = await rollup.affected(root);

      expect(result.value[0]).toMatchObject({
        name: 'Movido',
        ipAddress: '10.9.9.9',
        viaDeviceId: null
      });
    });

    it('fails when the attached alerts cannot be read', async () => {
      alertRepo.findAffectedBy.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await rollup.affected(root);

      expect(result.isFailure).toBe(true);
    });
  });
});
