// Source: src/application/notifications/use-cases/DeleteDeviceNotificationPolicyUseCase.ts

import { DeleteDeviceNotificationPolicyUseCase } from '../../../../src/application/notifications/use-cases/DeleteDeviceNotificationPolicyUseCase';
import { IDeviceNotificationPolicyRepository } from '../../../../src/domain/notifications/repository/IDeviceNotificationPolicyRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440092';

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
    delete: jest.fn().mockResolvedValue(Result.ok(undefined))
  };
}

describe('DeleteDeviceNotificationPolicyUseCase', () => {
  let policyRepo: jest.Mocked<IDeviceNotificationPolicyRepository>;
  let useCase: DeleteDeviceNotificationPolicyUseCase;

  beforeEach(() => {
    policyRepo = makePolicyRepo();
    useCase = new DeleteDeviceNotificationPolicyUseCase(
      policyRepo,
      makeLogger()
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail when deviceId is missing', async () => {
    const result = await useCase.execute({ deviceId: '' });
    expect(result.isFailure).toBe(true);
  });

  it('[NOT-170] should reset the device to always-notify by deleting the row', async () => {
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(policyRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the device never had a policy row', async () => {
    // delete() is deleteMany-backed and never fails for a missing row
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
  });

  it('should fail when the repository delete fails', async () => {
    policyRepo.delete.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isFailure).toBe(true);
  });
});
