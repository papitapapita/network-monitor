// Source: src/application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase.ts

import { BulkUpsertDeviceNotificationPoliciesUseCase } from '../../../../src/application/notifications/use-cases/BulkUpsertDeviceNotificationPoliciesUseCase';
import { UpsertDeviceNotificationPolicyUseCase } from '../../../../src/application/notifications/use-cases/UpsertDeviceNotificationPolicyUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceNotificationPolicyResponseDTO } from '../../../../src/application/notifications/dtos/DeviceNotificationPolicyResponseDTO';

const DEVICE_1 = '550e8400-e29b-41d4-a716-446655440093';
const DEVICE_2 = '550e8400-e29b-41d4-a716-446655440094';

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

function makeUpsertUseCase(): jest.Mocked<
  Pick<UpsertDeviceNotificationPolicyUseCase, 'execute'>
> {
  return { execute: jest.fn() };
}

function makeDTO(
  deviceId: string
): DeviceNotificationPolicyResponseDTO {
  return {
    deviceId,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    alertDelayMinutes: null,
    updatedAt: new Date().toISOString()
  };
}

describe('BulkUpsertDeviceNotificationPoliciesUseCase', () => {
  let upsert: jest.Mocked<
    Pick<UpsertDeviceNotificationPolicyUseCase, 'execute'>
  >;
  let useCase: BulkUpsertDeviceNotificationPoliciesUseCase;

  beforeEach(() => {
    upsert = makeUpsertUseCase();
    useCase = new BulkUpsertDeviceNotificationPoliciesUseCase(
      upsert as unknown as UpsertDeviceNotificationPolicyUseCase,
      makeLogger()
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should fail when deviceIds is empty', async () => {
    const result = await useCase.execute({
      deviceIds: [],
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null
    });

    expect(result.isFailure).toBe(true);
  });

  it('[NOT-176] should apply the same fields to every device in the list', async () => {
    upsert.execute.mockImplementation(async (req) =>
      Result.ok(makeDTO(req.deviceId))
    );

    const result = await useCase.execute({
      deviceIds: [DEVICE_1, DEVICE_2],
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      alertDelayMinutes: null
    });

    expect(result.isSuccess).toBe(true);
    expect(upsert.execute).toHaveBeenCalledTimes(2);
    expect(upsert.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_1,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      })
    );
    expect(result.value.updated).toHaveLength(2);
    expect(result.value.failed).toHaveLength(0);
  });

  it('[NOT-176] should bucket a failing device under failed without aborting the rest', async () => {
    upsert.execute
      .mockResolvedValueOnce(Result.fail('Device not found'))
      .mockResolvedValueOnce(Result.ok(makeDTO(DEVICE_2)));

    const result = await useCase.execute({
      deviceIds: [DEVICE_1, DEVICE_2],
      quietHoursStart: null,
      quietHoursEnd: null,
      alertDelayMinutes: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.updated).toHaveLength(1);
    expect(result.value.failed).toEqual([
      { id: DEVICE_1, error: 'Device not found' }
    ]);
  });
});
