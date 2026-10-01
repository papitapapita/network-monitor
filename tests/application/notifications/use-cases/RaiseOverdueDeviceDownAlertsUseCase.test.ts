// Source: src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase.ts

import { RaiseOverdueDeviceDownAlertsUseCase } from '../../../../src/application/notifications/use-cases/RaiseOverdueDeviceDownAlertsUseCase';
import { SendDeviceDownAlertUseCase } from '../../../../src/application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { IDeviceStateRepository } from '../../../../src/domain/device-monitoring/repository/IDeviceStateRepository';
import { IDeviceNotificationPolicyRepository } from '../../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { DeviceState } from '../../../../src/domain/device-monitoring/aggregates/DeviceState';
import { DeviceStateProps } from '../../../../src/domain/device-monitoring/props/DeviceStateProps';
import { ReachabilityStatus } from '../../../../src/domain/device-monitoring/value-objects/ReachabilityStatus';
import { DeviceNotificationPolicy } from '../../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { IAgentStatusQuery } from '../../../../src/application/shared/interfaces/IAgentStatusQuery';
import { INotificationSettingsRepository } from '../../../../src/domain/notifications/repository/INotificationSettingsRepository';
import { NotificationSettings } from '../../../../src/domain/notifications/value-objects/NotificationSettings';

const VALID_DEVICE_UUID_1 = '550e8400-e29b-41d4-a716-446655440070';
const VALID_DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440071';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');
const ALERT_DELAY_MS = 60 * 60 * 1_000;

function makeSettings(
  downAlertDelayMinutes = 60
): NotificationSettings {
  return NotificationSettings.reconstitute({
    telegramChatId: '-100',
    downAlertDelayMinutes,
    wirelessAlertsEnabled: true
  });
}

function makeSettingsRepo(): jest.Mocked<INotificationSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(Result.ok(makeSettings())),
    save: jest.fn()
  };
}

function makeDeviceId(uuid: string): DeviceId {
  return DeviceId.parse(uuid).value;
}

// downSince defaults to exactly the default delay ago — overdue under the
// default delay unless a test overrides it or attaches a policy.
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
    downSince: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS),
    updatedAt: FIXED_DATE,
    ...overrides
  };
  return DeviceState.reconstitute(deviceId, props);
}

function makePolicy(
  uuid: string,
  alertDelayMinutes: number | null
): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.create(),
    {
      deviceId: makeDeviceId(uuid),
      quietHours: null,
      alertDelayMinutes,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE
    }
  );
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
    findAllDown: jest.fn(),
    save: jest.fn()
  };
}

function makePolicyRepo(): jest.Mocked<IDeviceNotificationPolicyRepository> {
  return {
    save: jest.fn(),
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(null)),
    delete: jest.fn()
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
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let sendDeviceDownAlertUseCase: jest.Mocked<
    Pick<SendDeviceDownAlertUseCase, 'execute'>
  >;
  let logger: jest.Mocked<ILogger>;
  let agentStatusQuery: jest.Mocked<IAgentStatusQuery>;
  let settingsRepo: jest.Mocked<INotificationSettingsRepository>;
  let useCase: RaiseOverdueDeviceDownAlertsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED_DATE);
    deviceStateRepo = makeDeviceStateRepo();
    policyRepo = makePolicyRepo();
    sendDeviceDownAlertUseCase = makeSendDeviceDownAlertUseCase();
    logger = makeLogger();
    agentStatusQuery = {
      findUnmeasuredDevices: jest
        .fn()
        .mockResolvedValue(Result.ok(new Set()))
    };
    settingsRepo = makeSettingsRepo();
    useCase = new RaiseOverdueDeviceDownAlertsUseCase(
      deviceStateRepo,
      policyRepo,
      sendDeviceDownAlertUseCase as unknown as SendDeviceDownAlertUseCase,
      settingsRepo,
      logger,
      agentStatusQuery
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('happy path', () => {
    it('should query every currently-down device, unfiltered by time', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(Result.ok([]));

      await useCase.execute();

      expect(deviceStateRepo.findAllDown).toHaveBeenCalledWith();
    });

    it('should raise an alert for every overdue device returned', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
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

    it('should pass the device id, consecutiveFailures and downSince as occurredAt', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
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
          occurredAt: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS)
        }
      );
    });

    it('should return the count of alerts actually raised', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
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

    it('should return 0 when nothing is down', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(Result.ok([]));

      const result = await useCase.execute();

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should not count a device whose alert was already open (use case returns null)', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
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

  describe('[NOT-173] effective alert delay — per-device override', () => {
    it('uses the default delay when the device has no policy', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            // down for exactly the default delay — must fire
            downSince: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS)
          })
        ])
      );
      policyRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
    });

    it('skips a device whose down streak has not yet outlasted its shorter override', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            // down for 10 minutes
            downSince: new Date(FIXED_DATE.getTime() - 10 * 60_000)
          })
        ])
      );
      // override delay is 30 minutes — not overdue yet
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy(VALID_DEVICE_UUID_1, 30))
      );

      const result = await useCase.execute();

      expect(result.value).toBe(0);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('raises early for a device with a shorter override once it elapses', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            // down for 10 minutes
            downSince: new Date(FIXED_DATE.getTime() - 10 * 60_000)
          })
        ])
      );
      // override delay is 5 minutes — already overdue
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy(VALID_DEVICE_UUID_1, 5))
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
    });

    it('falls back to the default delay when the policy lookup fails', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            downSince: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS)
          })
        ])
      );
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.fail('db unavailable')
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
    });
  });

  describe('repository failure', () => {
    it('should fail without calling the alert use case when findAllDown fails', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('should include the repository error in the failure message', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      const result = await useCase.execute();

      expect(result.error).toContain('DB unavailable');
    });

    it('should fail without alerting when the settings cannot be read', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      settingsRepo.get.mockResolvedValue(
        Result.fail('DB unavailable')
      );

      const result = await useCase.execute();

      expect(result.error).toContain(
        'Failed to load notification settings'
      );
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });
  });

  describe('[NOT-201] the install-wide delay from the settings', () => {
    it('waits for a longer delay saved from the dashboard', async () => {
      settingsRepo.get.mockResolvedValue(Result.ok(makeSettings(90)));
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );

      const result = await useCase.execute();

      expect(result.value).toBe(0);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('alerts at once with a delay of 0', async () => {
      settingsRepo.get.mockResolvedValue(Result.ok(makeSettings(0)));
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1, {
            downSince: new Date(FIXED_DATE.getTime() - 1_000)
          })
        ])
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(result.value).toBe(1);
    });
  });

  describe('per-device failure isolation', () => {
    it('should continue raising alerts for remaining devices when one fails', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
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
      deviceStateRepo.findAllDown.mockResolvedValue(
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

  describe('[NOT-101] devices behind an agent that is not reporting', () => {
    it('skips them and still alerts for the rest', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(VALID_DEVICE_UUID_2)
        ])
      );
      agentStatusQuery.findUnmeasuredDevices.mockResolvedValue(
        Result.ok(new Set([VALID_DEVICE_UUID_1]))
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      const result = await useCase.execute();

      expect(
        agentStatusQuery.findUnmeasuredDevices
      ).toHaveBeenCalledWith([
        VALID_DEVICE_UUID_1,
        VALID_DEVICE_UUID_2
      ]);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
      expect(sendDeviceDownAlertUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: VALID_DEVICE_UUID_2 })
      );
      expect(result.value).toBe(1);
    });

    it('raises nothing when the agent status cannot be read', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      agentStatusQuery.findUnmeasuredDevices.mockResolvedValue(
        Result.fail('db down')
      );

      const result = await useCase.execute();

      expect(result.isFailure).toBe(true);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });
  });
});
