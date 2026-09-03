// Source: src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase.ts

import { UpsertDeviceNotificationPolicyUseCase } from '../../../../src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase';
import { IDeviceNotificationPolicyRepository } from '../../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceNotificationPolicy } from '../../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { UpsertDeviceNotificationPolicyDTO } from '../../../../src/application/notifications/dtos/UpsertDeviceNotificationPolicyDTO';
import { QuietHours } from '../../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../../src/domain/notifications/value-objects/TimeOfDay';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440091';

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

function makePolicyRepo(): jest.Mocked<IDeviceNotificationPolicyRepository> {
  return {
    save: jest.fn().mockImplementation(async (p) => Result.ok(p)),
    findByDeviceId: jest.fn().mockResolvedValue(Result.ok(null)),
    delete: jest.fn()
  };
}

function makeDeviceRepo(exists = true) {
  return { exists: jest.fn().mockResolvedValue(Result.ok(exists)) };
}

function makeRequest(
  overrides: Partial<UpsertDeviceNotificationPolicyDTO> = {}
): UpsertDeviceNotificationPolicyDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    quietHoursStart: null,
    quietHoursEnd: null,
    alertDelayMinutes: null,
    ...overrides
  };
}

function makeExistingPolicy(): DeviceNotificationPolicy {
  return DeviceNotificationPolicy.reconstitute(
    DeviceNotificationPolicyId.create(),
    {
      deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
      quietHours: null,
      alertDelayMinutes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }
  );
}

describe('UpsertDeviceNotificationPolicyUseCase', () => {
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let useCase: UpsertDeviceNotificationPolicyUseCase;

  beforeEach(() => {
    policyRepo = makePolicyRepo();
    deviceRepo = makeDeviceRepo();
    useCase = new UpsertDeviceNotificationPolicyUseCase(
      policyRepo,
      deviceRepo as unknown as IDeviceRepository,
      makeLogger()
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('[NOT-171] should fail when only quietHoursStart is provided', async () => {
    const result = await useCase.execute(
      makeRequest({ quietHoursStart: '22:00' })
    );
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('must both be set');
  });

  it('[NOT-171] should fail when only quietHoursEnd is provided', async () => {
    const result = await useCase.execute(
      makeRequest({ quietHoursEnd: '07:00' })
    );
    expect(result.isFailure).toBe(true);
  });

  it('should fail when the device does not exist', async () => {
    deviceRepo.exists.mockResolvedValue(Result.ok(false));
    const result = await useCase.execute(makeRequest());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device not found');
  });

  it('[NOT-171] should fail for an out-of-range time string', async () => {
    const result = await useCase.execute(
      makeRequest({
        quietHoursStart: '25:00',
        quietHoursEnd: '07:00'
      })
    );
    expect(result.isFailure).toBe(true);
  });

  it('[NOT-173] should fail for a negative alert delay override', async () => {
    const result = await useCase.execute(
      makeRequest({ alertDelayMinutes: -5 })
    );
    expect(result.isFailure).toBe(true);
  });

  it('should create a new policy when none exists', async () => {
    const result = await useCase.execute(
      makeRequest({
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        alertDelayMinutes: 10
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(policyRepo.save).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({
      deviceId: VALID_DEVICE_UUID,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: 10,
      updatedAt: expect.any(String)
    });
  });

  it('should update the existing policy in place rather than creating a second one', async () => {
    const existing = makeExistingPolicy();
    policyRepo.findByDeviceId.mockResolvedValue(Result.ok(existing));

    await useCase.execute(
      makeRequest({
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00'
      })
    );

    const saved = policyRepo.save.mock.calls[0][0];
    expect(saved).toBe(existing);
    expect(saved.quietHours?.start.toString()).toBe('22:00');
  });

  it('[NOT-170] should clear the window back to null (always notify)', async () => {
    const existing = DeviceNotificationPolicy.reconstitute(
      DeviceNotificationPolicyId.create(),
      {
        deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
        quietHours: QuietHours.create(
          TimeOfDay.create('22:00').value,
          TimeOfDay.create('07:00').value
        ).value,
        alertDelayMinutes: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      }
    );
    policyRepo.findByDeviceId.mockResolvedValue(Result.ok(existing));

    const result = await useCase.execute(
      makeRequest({ quietHoursStart: null, quietHoursEnd: null })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.quietHoursStart).toBeNull();
    expect(result.value.quietHoursEnd).toBeNull();
  });

  it('should fail when saving the policy fails', async () => {
    policyRepo.save.mockResolvedValue(Result.fail('write conflict'));

    const result = await useCase.execute(makeRequest());

    expect(result.isFailure).toBe(true);
  });
});
