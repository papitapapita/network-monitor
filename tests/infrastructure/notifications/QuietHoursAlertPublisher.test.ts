// Source: src/infrastructure/notifications/QuietHoursAlertPublisher.ts

import { QuietHoursAlertPublisher } from '../../../src/infrastructure/notifications/QuietHoursAlertPublisher';
import {
  IAlertPublisher,
  AlertNotification,
  QUIET_HOURS_SUPPRESSED
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { IDeviceNotificationPolicyRepository } from '../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { INotificationSettingsRepository } from '../../../src/domain/notifications/repository/INotificationSettingsRepository';
import { NotificationSettings } from '../../../src/domain/notifications/value-objects/NotificationSettings';
import { QuietHoursMode } from '../../../src/domain/notifications/props';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';
import { DeviceNotificationPolicy } from '../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { QuietHours } from '../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../src/domain/shared/value-objects/TimeOfDay';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440095';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

function makeLogger(): ILogger {
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

function makeInner(): jest.Mocked<IAlertPublisher> {
  return { publish: jest.fn().mockResolvedValue(Result.ok()) };
}

function makePolicyRepo(): jest.Mocked<IDeviceNotificationPolicyRepository> {
  return {
    save: jest.fn(),
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(null)),
    delete: jest.fn()
  };
}

function makeSettingsRepo(
  quietHours: QuietHours | null = null
): jest.Mocked<INotificationSettingsRepository> {
  return {
    get: jest.fn().mockResolvedValue(
      Result.ok(
        NotificationSettings.reconstitute({
          telegramChatId: '-100123',
          downAlertDelayMinutes: 60,
          wirelessAlertsEnabled: true,
          alertTicketMode: 'SUGGEST',
          quietHours
        })
      )
    ),
    save: jest.fn()
  };
}

function window(start: string, end: string): QuietHours {
  return QuietHours.create(
    TimeOfDay.create(start).value,
    TimeOfDay.create(end).value
  ).value;
}

// "now" is pinned to local 10:00 in beforeEach.
const COVERS_NOW = () => window('00:00', '23:59');
const MISSES_NOW = () => window('22:00', '23:00');

function makePolicy(
  quietHoursMode: QuietHoursMode,
  quietHours: QuietHours | null = null
): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.create(),
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      quietHoursMode,
      quietHours,
      alertDelayMinutes: null,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE
    }
  );
}

function makeNotification(): AlertNotification {
  return {
    deviceId: VALID_DEVICE_UUID,
    severity: AlertSeverity.CRITICAL,
    source: 'Disponibilidad',
    summary: 'Dispositivo fuera de línea',
    detail: 'Sin conexión',
    occurredAt: FIXED_DATE,
    resolved: false,
    type: 'device_unreachable'
  };
}

describe('QuietHoursAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let settingsRepo: jest.Mocked<INotificationSettingsRepository>;
  let publisher: QuietHoursAlertPublisher;

  function build(): void {
    publisher = new QuietHoursAlertPublisher(
      inner,
      policyRepo,
      settingsRepo,
      makeLogger()
    );
  }

  beforeEach(() => {
    // Quiet hours are read against the real wall clock (server-local time),
    // so "now" is pinned to a known local hour rather than left to whatever
    // time the test happens to run at.
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 1, 10, 0));
    inner = makeInner();
    policyRepo = makePolicyRepo();
    settingsRepo = makeSettingsRepo();
    build();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('[NOT-170] a device with no policy follows the install window', () => {
    it('forwards when the install has no quiet hours', async () => {
      const result = await publisher.publish(makeNotification());

      expect(inner.publish).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });

    it('[NOT-207] suppresses inside the install window', async () => {
      settingsRepo = makeSettingsRepo(COVERS_NOW());
      build();

      const result = await publisher.publish(makeNotification());

      expect(inner.publish).not.toHaveBeenCalled();
      expect(result.error).toBe(QUIET_HOURS_SUPPRESSED);
    });

    it('forwards outside the install window', async () => {
      settingsRepo = makeSettingsRepo(MISSES_NOW());
      build();

      await publisher.publish(makeNotification());

      expect(inner.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('[NOT-170] INHERIT', () => {
    it('suppresses inside the install window', async () => {
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy('INHERIT'))
      );
      settingsRepo = makeSettingsRepo(COVERS_NOW());
      build();

      const result = await publisher.publish(makeNotification());

      expect(result.error).toBe(QUIET_HOURS_SUPPRESSED);
    });
  });

  describe('[NOT-170] CUSTOM', () => {
    it('[NOT-174] suppresses inside its own window', async () => {
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy('CUSTOM', COVERS_NOW()))
      );

      const result = await publisher.publish(makeNotification());

      expect(inner.publish).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(QUIET_HOURS_SUPPRESSED);
    });

    it('forwards outside its own window even inside the install window', async () => {
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy('CUSTOM', MISSES_NOW()))
      );
      settingsRepo = makeSettingsRepo(COVERS_NOW());
      build();

      await publisher.publish(makeNotification());

      expect(inner.publish).toHaveBeenCalledTimes(1);
      expect(settingsRepo.get).not.toHaveBeenCalled();
    });
  });

  describe('[NOT-170] ALWAYS_NOTIFY', () => {
    it('forwards even inside the install window', async () => {
      policyRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePolicy('ALWAYS_NOTIFY'))
      );
      settingsRepo = makeSettingsRepo(COVERS_NOW());
      build();

      const result = await publisher.publish(makeNotification());

      expect(inner.publish).toHaveBeenCalledTimes(1);
      expect(result.isSuccess).toBe(true);
    });
  });

  it('fails open (notifies anyway) when the policy lookup itself fails', async () => {
    policyRepo.findByDeviceId.mockResolvedValue(
      Result.fail('db unavailable')
    );

    const result = await publisher.publish(makeNotification());

    expect(inner.publish).toHaveBeenCalledTimes(1);
    expect(result.isSuccess).toBe(true);
  });

  it('fails open (notifies anyway) when the settings lookup fails', async () => {
    settingsRepo.get.mockResolvedValue(Result.fail('db unavailable'));

    const result = await publisher.publish(makeNotification());

    expect(inner.publish).toHaveBeenCalledTimes(1);
    expect(result.isSuccess).toBe(true);
  });

  it('forwards unchanged when the device id on the notification is malformed', async () => {
    const result = await publisher.publish({
      ...makeNotification(),
      deviceId: 'not-a-uuid'
    });

    expect(policyRepo.findByDeviceId).not.toHaveBeenCalled();
    expect(inner.publish).toHaveBeenCalledTimes(1);
    expect(result.isSuccess).toBe(true);
  });

  it('[NOT-178] forwards an alert with no device without looking up a policy, even inside the install window', async () => {
    settingsRepo = makeSettingsRepo(COVERS_NOW());
    build();
    const notification = { ...makeNotification(), deviceId: null };

    const result = await publisher.publish(notification);

    expect(policyRepo.findByDeviceId).not.toHaveBeenCalled();
    expect(inner.publish).toHaveBeenCalledWith(notification);
    expect(result.isSuccess).toBe(true);
  });
});
