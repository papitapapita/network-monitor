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
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { Alert } from '../../../../src/domain/notifications/aggregates/Alert';
import { AlertProps } from '../../../../src/domain/notifications/props/AlertProps';
import { AlertId } from '../../../../src/domain/shared/ids/AlertId';
import { AlertSeverity } from '../../../../src/domain/shared/enums';
import { IOutageTopologyQuery } from '../../../../src/application/notifications/interfaces/IOutageTopologyQuery';

const VALID_DEVICE_UUID_1 = '550e8400-e29b-41d4-a716-446655440070';
const VALID_DEVICE_UUID_2 = '550e8400-e29b-41d4-a716-446655440071';
const UPSTREAM_UUID = '550e8400-e29b-41d4-a716-446655440080';
const TOP_UUID = '550e8400-e29b-41d4-a716-446655440081';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');
const ALERT_DELAY_MS = 60 * 60 * 1_000;

function makeSettings(
  downAlertDelayMinutes = 60
): NotificationSettings {
  return NotificationSettings.reconstitute({
    telegramChatId: '-100',
    downAlertDelayMinutes,
    wirelessAlertsEnabled: true,
    alertTicketMode: 'SUGGEST',
    quietHours: null
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
      quietHoursMode: 'INHERIT',
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
  durationSecs: null,
  causedByAlertId: null
};

// The re-read before raising sees what the scan saw unless a test says
// otherwise: findByDeviceId answers from the last down list handed out.
function makeDeviceStateRepo(): jest.Mocked<IDeviceStateRepository> {
  const repo: jest.Mocked<IDeviceStateRepository> = {
    findByDeviceId: jest.fn(),
    findAllDown: jest.fn(),
    save: jest.fn()
  };
  repo.findByDeviceId.mockImplementation(async (deviceId) => {
    const last = repo.findAllDown.mock.results.at(-1)?.value as
      | Promise<Result<DeviceState[]>>
      | undefined;
    const states = last ? (await last).value : [];
    return Result.ok(
      states.find((s) => s.deviceId.equals(deviceId)) ?? null
    );
  });
  return repo;
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

function makeAlert(
  uuid: string,
  overrides: Partial<AlertProps> = {}
): Alert {
  return Alert.reconstitute(AlertId.create(), {
    deviceId: makeDeviceId(uuid),
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    type: 'device_unreachable',
    description: 'Sin conexión.',
    details: {},
    startedAt: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS),
    resolvedAt: null,
    notifiedAt: null,
    recoveryNotifiedAt: null,
    causedByAlertId: null,
    ...overrides
  });
}

function makeAlertRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest.fn(async (alert: Alert) => Result.ok(alert)),
    findById: jest.fn().mockResolvedValue(Result.ok(null)),
    findOpenByDeviceAndType: jest
      .fn()
      .mockResolvedValue(Result.ok(null)),
    findAllOpenByDeviceId: jest.fn(),
    findAllOpenByType: jest.fn(),
    findAffectedBy: jest.fn().mockResolvedValue(Result.ok([])),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

// Open alerts by device, as findOpenByDeviceAndType would answer.
function answerOpenAlerts(
  repo: jest.Mocked<IAlertRepository>,
  alerts: Alert[]
): void {
  repo.findOpenByDeviceAndType.mockImplementation(async (deviceId) =>
    Result.ok(
      alerts.find((a) => a.isOpen && a.deviceId.equals(deviceId)) ??
        null
    )
  );
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
  let alertRepo: jest.Mocked<IAlertRepository>;
  let topology: jest.Mocked<IOutageTopologyQuery>;
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
    alertRepo = makeAlertRepo();
    topology = {
      findUpstreamIds: jest.fn().mockResolvedValue(Result.ok([])),
      findDownstream: jest.fn().mockResolvedValue(Result.ok([])),
      findByIds: jest.fn().mockResolvedValue(Result.ok([]))
    };
    useCase = new RaiseOverdueDeviceDownAlertsUseCase(
      deviceStateRepo,
      policyRepo,
      sendDeviceDownAlertUseCase as unknown as SendDeviceDownAlertUseCase,
      settingsRepo,
      logger,
      agentStatusQuery,
      alertRepo,
      topology
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

  describe('[NOT-229] the device is re-read just before its alert is raised', () => {
    it('skips a device that recovered after the down list was read', async () => {
      const snapshot = makeDeviceState(VALID_DEVICE_UUID_1);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([snapshot])
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState(VALID_DEVICE_UUID_1, {
            status: ReachabilityStatus.createUp(),
            downSince: null
          })
        )
      );

      const result = await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
      expect(result.value).toBe(0);
    });

    it('skips a device that went down again in a new streak since the read', async () => {
      const snapshot = makeDeviceState(VALID_DEVICE_UUID_1);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([snapshot])
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState(VALID_DEVICE_UUID_1, {
            downSince: FIXED_DATE
          })
        )
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('skips a device whose state is gone', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
    });

    it('skips a device it cannot re-read and still raises the rest', async () => {
      const first = makeDeviceState(VALID_DEVICE_UUID_1);
      const second = makeDeviceState(VALID_DEVICE_UUID_2);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([first, second])
      );
      deviceStateRepo.findByDeviceId
        .mockResolvedValueOnce(Result.fail('connection reset'))
        .mockResolvedValueOnce(Result.ok(second));
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
      expect(sendDeviceDownAlertUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: VALID_DEVICE_UUID_2 })
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    it('reports the failure count as of the re-read, and the streak start from the scan', async () => {
      const snapshot = makeDeviceState(VALID_DEVICE_UUID_1, {
        consecutiveFailures: 5
      });
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([snapshot])
      );
      deviceStateRepo.findByDeviceId.mockResolvedValue(
        Result.ok(
          makeDeviceState(VALID_DEVICE_UUID_1, {
            consecutiveFailures: 9
          })
        )
      );
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );

      await useCase.execute();

      expect(sendDeviceDownAlertUseCase.execute).toHaveBeenCalledWith(
        {
          deviceId: VALID_DEVICE_UUID_1,
          consecutiveFailures: 9,
          occurredAt: snapshot.downSince
        }
      );
    });
  });
  describe('outage behind an upstream device (NOT-240..245)', () => {
    beforeEach(() => {
      sendDeviceDownAlertUseCase.execute.mockResolvedValue(
        Result.ok(STUB_ALERT_DTO)
      );
    });

    it('pages a device whose upstream chain is all up', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      topology.findUpstreamIds.mockResolvedValue(
        Result.ok([UPSTREAM_UUID])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
    });

    it('[NOT-240] [NOT-241] attaches the device to its down upstream alert instead of paging', async () => {
      const own = makeAlert(VALID_DEVICE_UUID_1);
      const upstream = makeAlert(UPSTREAM_UUID);
      answerOpenAlerts(alertRepo, [own, upstream]);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(UPSTREAM_UUID, {
            downSince: new Date(FIXED_DATE.getTime() - 60_000)
          })
        ])
      );
      topology.findUpstreamIds.mockImplementation(async (id) =>
        Result.ok(id === VALID_DEVICE_UUID_1 ? [UPSTREAM_UUID] : [])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
      expect(own.causedByAlertId?.equals(upstream.id)).toBe(true);
      expect(alertRepo.save).toHaveBeenCalledWith(own);
    });

    it('attaches to the highest down upstream, past an up one in between', async () => {
      const own = makeAlert(VALID_DEVICE_UUID_1);
      const nearest = makeAlert(UPSTREAM_UUID);
      const top = makeAlert(TOP_UUID);
      answerOpenAlerts(alertRepo, [own, nearest, top]);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(UPSTREAM_UUID, {
            downSince: FIXED_DATE
          }),
          makeDeviceState(TOP_UUID, { downSince: FIXED_DATE })
        ])
      );
      topology.findUpstreamIds.mockImplementation(async (id) =>
        Result.ok(
          id === VALID_DEVICE_UUID_1
            ? [UPSTREAM_UUID, VALID_DEVICE_UUID_2, TOP_UUID]
            : []
        )
      );

      await useCase.execute();

      expect(own.causedByAlertId?.equals(top.id)).toBe(true);
    });

    it('skips an upstream behind an agent that is not reporting', async () => {
      agentStatusQuery.findUnmeasuredDevices.mockResolvedValue(
        Result.ok(new Set([UPSTREAM_UUID]))
      );
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(UPSTREAM_UUID)
        ])
      );
      topology.findUpstreamIds.mockResolvedValue(
        Result.ok([UPSTREAM_UUID])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
    });

    it('waits while the down upstream has no open alert yet (NOT-242)', async () => {
      answerOpenAlerts(alertRepo, [makeAlert(VALID_DEVICE_UUID_1)]);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(UPSTREAM_UUID, { downSince: FIXED_DATE })
        ])
      );
      topology.findUpstreamIds.mockImplementation(async (id) =>
        Result.ok(id === VALID_DEVICE_UUID_1 ? [UPSTREAM_UUID] : [])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
      expect(alertRepo.save).not.toHaveBeenCalled();
    });

    it('leaves an attached device alone while its root alert is open', async () => {
      const root = makeAlert(UPSTREAM_UUID);
      const own = makeAlert(VALID_DEVICE_UUID_1, {
        causedByAlertId: root.id
      });
      answerOpenAlerts(alertRepo, [own, root]);
      alertRepo.findById.mockResolvedValue(Result.ok(root));
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
      expect(topology.findUpstreamIds).not.toHaveBeenCalled();
    });

    it('holds a device still down after its root recovered, until its own delay passes (NOT-245)', async () => {
      const root = makeAlert(UPSTREAM_UUID, {
        resolvedAt: new Date(
          FIXED_DATE.getTime() - ALERT_DELAY_MS + 1
        )
      });
      const own = makeAlert(VALID_DEVICE_UUID_1, {
        causedByAlertId: root.id
      });
      answerOpenAlerts(alertRepo, [own]);
      alertRepo.findById.mockResolvedValue(Result.ok(root));
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).not.toHaveBeenCalled();
      expect(own.causedByAlertId).not.toBeNull();
    });

    it('detaches and pages a device still down its own delay after the root recovered (NOT-245)', async () => {
      const root = makeAlert(UPSTREAM_UUID, {
        resolvedAt: new Date(FIXED_DATE.getTime() - ALERT_DELAY_MS)
      });
      const own = makeAlert(VALID_DEVICE_UUID_1, {
        causedByAlertId: root.id
      });
      answerOpenAlerts(alertRepo, [own]);
      alertRepo.findById.mockResolvedValue(Result.ok(root));
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      topology.findUpstreamIds.mockResolvedValue(
        Result.ok([UPSTREAM_UUID])
      );

      await useCase.execute();

      expect(own.causedByAlertId).toBeNull();
      expect(alertRepo.save).toHaveBeenCalledWith(own);
      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
    });

    it('does not re-attribute a device already paged on its own', async () => {
      const own = makeAlert(VALID_DEVICE_UUID_1, {
        notifiedAt: FIXED_DATE
      });
      answerOpenAlerts(alertRepo, [own]);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );

      await useCase.execute();

      expect(topology.findUpstreamIds).not.toHaveBeenCalled();
      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
    });

    it('pages when the upstream chain cannot be read', async () => {
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([makeDeviceState(VALID_DEVICE_UUID_1)])
      );
      topology.findUpstreamIds.mockResolvedValue(
        Result.fail('db down')
      );

      await useCase.execute();

      expect(
        sendDeviceDownAlertUseCase.execute
      ).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('opens a record to attach when the transition was never recorded', async () => {
      const upstream = makeAlert(UPSTREAM_UUID);
      answerOpenAlerts(alertRepo, [upstream]);
      deviceStateRepo.findAllDown.mockResolvedValue(
        Result.ok([
          makeDeviceState(VALID_DEVICE_UUID_1),
          makeDeviceState(UPSTREAM_UUID, { downSince: FIXED_DATE })
        ])
      );
      topology.findUpstreamIds.mockImplementation(async (id) =>
        Result.ok(id === VALID_DEVICE_UUID_1 ? [UPSTREAM_UUID] : [])
      );

      await useCase.execute();

      const saved = alertRepo.save.mock.calls[0][0];
      expect(saved.deviceId.toString()).toBe(VALID_DEVICE_UUID_1);
      expect(saved.causedByAlertId?.equals(upstream.id)).toBe(true);
    });
  });
});
