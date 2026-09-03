// Source: src/application/notifications/use-cases/GetDeviceNotificationPolicyUseCase.ts

import { GetDeviceNotificationPolicyUseCase } from '../../../../src/application/notifications/use-cases/GetDeviceNotificationPolicyUseCase';
import { IDeviceNotificationPolicyRepository } from '../../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceNotificationPolicy } from '../../../../src/domain/notifications/entities/DeviceNotificationPolicy';
import { DeviceNotificationPolicyId } from '../../../../src/domain/shared/ids/DeviceNotificationPolicyId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { QuietHours } from '../../../../src/domain/notifications/value-objects/QuietHours';
import { TimeOfDay } from '../../../../src/domain/notifications/value-objects/TimeOfDay';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440090';

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
    save: jest.fn(),
    findByDeviceId: jest.fn(),
    delete: jest.fn()
  };
}

function makeDeviceRepo(exists = true) {
  return { exists: jest.fn().mockResolvedValue(Result.ok(exists)) };
}

describe('GetDeviceNotificationPolicyUseCase', () => {
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let deviceRepo: ReturnType<typeof makeDeviceRepo>;
  let useCase: GetDeviceNotificationPolicyUseCase;

  beforeEach(() => {
    policyRepo = makePolicyRepo();
    deviceRepo = makeDeviceRepo();
    useCase = new GetDeviceNotificationPolicyUseCase(
      policyRepo,
      deviceRepo as unknown as IDeviceRepository,
      makeLogger()
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail when deviceId is missing', async () => {
    const result = await useCase.execute({ deviceId: '' });
    expect(result.isFailure).toBe(true);
  });

  it('should fail when the device does not exist', async () => {
    deviceRepo.exists.mockResolvedValue(Result.ok(false));
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Device not found');
  });

  it('[NOT-170] should return default (always-notify) values when no policy row exists', async () => {
    policyRepo.findByDeviceId.mockResolvedValue(Result.ok(null));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      deviceId: VALID_DEVICE_UUID,
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null,
      updatedAt: null
    });
  });

  it('should map an existing policy to its DTO', async () => {
    const quietHours = QuietHours.create(
      TimeOfDay.create('22:00').value,
      TimeOfDay.create('07:00').value
    ).value;
    const updatedAt = new Date('2026-06-01T10:00:00.000Z');
    const policy = DeviceNotificationPolicy.reconstitute(
      DeviceNotificationPolicyId.create(),
      {
        deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
        quietHours,
        alertDelayMinutes: 15,
        createdAt: updatedAt,
        updatedAt
      }
    );
    policyRepo.findByDeviceId.mockResolvedValue(Result.ok(policy));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      deviceId: VALID_DEVICE_UUID,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: 15,
      updatedAt: updatedAt.toISOString()
    });
  });

  it('should fail when the repository lookup fails', async () => {
    policyRepo.findByDeviceId.mockResolvedValue(
      Result.fail('db down')
    );

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isFailure).toBe(true);
  });
});
