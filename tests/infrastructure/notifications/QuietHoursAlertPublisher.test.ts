// Source: src/infrastructure/notifications/QuietHoursAlertPublisher.ts

import { QuietHoursAlertPublisher } from '../../../src/infrastructure/notifications/QuietHoursAlertPublisher';
import {
  IAlertPublisher,
  AlertNotification,
  QUIET_HOURS_SUPPRESSED
} from '../../../src/application/shared/interfaces/IAlertPublisher';
import { IDeviceNotificationPolicyRepository } from '../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../src/domain/shared/core/Result';
import { DeviceNotificationPolicy } from '../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../src/domain/shared/ids/DeviceId';
import { AlertSeverity } from '../../../src/domain/shared/enums/AlertSeverity';
import { QuietHours } from '../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../src/domain/notifications/value-objects/TimeOfDay';

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

function makePolicyWithinWindow(): DeviceNotificationPolicy {
  const quietHours = QuietHours.create(
    TimeOfDay.create('00:00').value,
    TimeOfDay.create('23:59').value
  ).value;
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.create(),
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
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
    subject: 'Dispositivo fuera de línea',
    detail: 'Sin conexión',
    occurredAt: FIXED_DATE,
    resolved: false,
    type: 'device_unreachable'
  };
}

describe('QuietHoursAlertPublisher', () => {
  let inner: jest.Mocked<IAlertPublisher>;
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let publisher: QuietHoursAlertPublisher;

  beforeEach(() => {
    // isWithinQuietHours reads the real wall clock (server-local time), so
    // "now" is pinned to a known local hour rather than left to whatever
    // time the test happens to run at.
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 1, 10, 0));
    inner = makeInner();
    policyRepo = makePolicyRepo();
    publisher = new QuietHoursAlertPublisher(
      inner,
      policyRepo,
      makeLogger()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('[NOT-170] forwards to the inner publisher when the device has no policy', async () => {
    const result = await publisher.publish(makeNotification());

    expect(inner.publish).toHaveBeenCalledTimes(1);
    expect(result.isSuccess).toBe(true);
  });

  it('forwards to the inner publisher when outside the configured window', async () => {
    const quietHours = QuietHours.create(
      TimeOfDay.create('22:00').value,
      TimeOfDay.create('23:00').value
    ).value;
    const policy = DeviceNotificationPolicy.reconstitute(
      DeviceNotificationPolicyId.create(),
      {
        deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
        quietHours,
        alertDelayMinutes: null,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE
      }
    );
    policyRepo.findByDeviceId.mockResolvedValue(Result.ok(policy));

    // "now" is pinned to local 10:00 in beforeEach — outside 22:00-23:00.
    await publisher.publish(makeNotification());

    expect(inner.publish).toHaveBeenCalledTimes(1);
  });

  it('[NOT-174] suppresses without forwarding when inside the configured window', async () => {
    policyRepo.findByDeviceId.mockResolvedValue(
      Result.ok(makePolicyWithinWindow())
    );

    const result = await publisher.publish(makeNotification());

    expect(inner.publish).not.toHaveBeenCalled();
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(QUIET_HOURS_SUPPRESSED);
  });

  it('fails open (notifies anyway) when the policy lookup itself fails', async () => {
    policyRepo.findByDeviceId.mockResolvedValue(
      Result.fail('db unavailable')
    );

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
});
