// Source: src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts

import { RaiseOverdueDeviceDownAlertsUseCase } from '../../../../src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase';
import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

const VALID_DEVICE_UUID_1 = '550e8400-e29b-41d4-a716-446655440070';
const VALID_DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440071';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');
const ALERT_DELAY_MS = 60 * 60 * 1_000;

function makeDeviceId(uuid: string): DeviceId {
  return DeviceId.parse(uuid).value;
}

function makeDeviceState(
  uuid: string,
  overrides: Partial<DeviceStateProps> = {}
): DeviceState {
  const deviceId = makeDeviceId(uuid);
  const props: DeviceStateProps = {
    deviceId,
    status: ReachabilityStatus.createDown(),
    lastSeen: FIXED_DATE,
    lastLatencyMs: null,
    consecutiveFailures: 5,
    lastCheckedAt: FIXED_DATE,
    downSince: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(deviceId, props);
}

const STUB_ALERT_DTO = {
  id: '550e8400-e29b-41d4-a716-446655440072',
  deviceId: VALID_DEVICE_UUID_1,
  severity: 'CRITICAL',
  source: 'Disponibilidad',
  type: 'device_unreachable',
  description: 'Sin conexión',
  details: {},
  status: 'OPEN' as const,
  startedAt: FIXED_DATE.toISOString(),
  resolvedAt: null,
  notifiedAt: null,
  recoveryNotifiedAt: null,
  durationSecs: null
};

function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  return {
    findByDeviceId: jest.fn(),
    findOverdueDown: jest.fn(),
    save: jest.fn()
  };
}

function makeSendDeviceDownAlertUseCase(): jest.Mocked<
  Pick<SendDeviceDownAlertUseCase, 'execute'>
> {
  return { execute: jest.fn() };
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

describe('RaiseOverdueDeviceDownAlertsUseCase', () => {
  let deviceStateRepo: jest.Mocked<IDeviceStateRepository>;
  let sendDeviceDownAlertUseCase: jest.Mocked<
    Pick<SendDeviceDownAlertUseCase, 'execute'>
  >;
  let logger: jest.Mocked<ILogger>;
  let useCase: RaiseOverdueDeviceDownAlertsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED_DATE);
    deviceStateRepo = makeDeviceStateRepo();
    sendDeviceDownAlertUseCase = makeSendDeviceDownAlertUseCase();
    logger = makeLogger();
    useCase = new RaiseOverdueDeviceDownAlertsUseCase(
      deviceStateRepo,
      sendDeviceDownAlertUseCase as unknown as SendDeviceDownAlertUseCase,
      ALERT_DELAY_MS,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('cutoff computation', () => {
    it('[NOT-097] should query findOverdueDown with now minus the alert delay', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([])
      );

      await useCase.execute();

      expect(deviceStateRepo.findOverdueDown).toHaveBeenCalledWith(
        new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS)
      );
    });
  });

  describe('happy path', () => {
    it('should raise an alert for every overdue device returned', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(VALID_DEVICE_UUID_2)
        ])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(2);
    });

    it('should pass the device id, consecutiveFailures and a fresh occurredAt', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            consecutiveFailures: 12
          })
        ])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      await useCase.execute();

      expect(sendDeviceDownAlertUseCase.execute).toHaveBeenCalledWith(
        {
          deviceId: VALID_DEVICE_UUID_1,
          consecutiveFailures: 12,
          occurredAt: FIXED_DATE
        }
      );
    });

    it('should return the count of alerts actually raised', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(VALID_DEVICE_UUID_2)
        ])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(2);
    });

    it('should return 0 when nothing is overdue', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([])
      );

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0);
    });

    it('[NOT-097] should not count a device whose alert was already open (use case returns null)', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0);
    });
  });

  describe('repository failure', () => {
    it('should fail without calling the alert use case when findOverdueDown fails', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('should include the repository error in the failure message', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      const result = await useCase.execute();

      expect(result.error).toContain('DB unavailable');
    });
  });

  describe('per-device failure isolation', () => {
    it('should continue raising alerts for remaining devices when one fails', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(VALID_DEVICE_UUID_2)
        ])
      );
      sendDeviceDownAlertUseCase.execute
        .mockResolvedValueOnce(
          Result.fail('eligibility check failed')
        )
        .mockResolvedValueOnce(Result.ok(STUB_ALERT_DTO));

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should log an error for the device that failed', async () => {
      deviceStateRepo.findOverdueDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.fail('eligibility check failed')
      );

      await useCase.execute();

      expect(logger.error).toHaveBeenCalledWith(
        'RaiseOverdueDeviceDownAlertsUseCase: failed to raise alert for device',
        undefined,
        {
          deviceId: VALID_DEVICE_UUID_1,
          error: 'eligibility check failed'
        }
      );
    });
  });
});
