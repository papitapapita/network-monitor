// Source: src/application/device-monitoring/use-cases/DeleteDevicePingHistoryUseCase.ts

import { DeleteDevicePingHistoryUseCase } from '../../../../src/application/device-monitoring/use-cases/DeleteDevicePingHistoryUseCase';
import { IPingResultRepository } from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';

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

function makePingResultRepo(): jest.Mocked<IPingResultRepository> {
  return {
    save: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn(),
    deleteOlderThan: jest.fn(),
    deleteByDevice: jest.fn().mockResolvedValue(Result.ok(0))
  };
}

describe('DeleteDevicePingHistoryUseCase', () => {
  let repo: jest.Mocked<IPingResultRepository>;
  let useCase: DeleteDevicePingHistoryUseCase;

  beforeEach(() => {
    repo = makePingResultRepo();
    useCase = new DeleteDevicePingHistoryUseCase(repo, makeLogger());
  });

  afterEach(() => jest.clearAllMocks());

  it('[MON-041] fails when deviceId is missing', async () => {
    const result = await useCase.execute({ deviceId: '' });
    expect(result.isFailure).toBe(true);
  });

  it('[MON-041] fails on an invalid device id', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });
    expect(result.isFailure).toBe(true);
  });

  it('[MON-041] fails when fromDate is after toDate', async () => {
    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      fromDate: new Date('2024-06-02T00:00:00.000Z'),
      toDate: new Date('2024-06-01T00:00:00.000Z')
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('fromDate must be before toDate');
  });

  it('[MON-041] deletes the device history and returns the count', async () => {
    repo.deleteByDevice.mockResolvedValue(Result.ok(7));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deletedCount).toBe(7);
    expect(repo.deleteByDevice.mock.calls[0][0].toString()).toBe(
      VALID_DEVICE_UUID
    );
    expect(repo.deleteByDevice.mock.calls[0][1]).toEqual({
      fromDate: undefined,
      toDate: undefined
    });
  });

  it('[MON-041] passes fromDate/toDate through to the repository', async () => {
    const fromDate = new Date('2024-06-01T00:00:00.000Z');
    const toDate = new Date('2024-06-02T00:00:00.000Z');
    repo.deleteByDevice.mockResolvedValue(Result.ok(3));

    await useCase.execute({
      deviceId: VALID_DEVICE_UUID,
      fromDate,
      toDate
    });

    expect(repo.deleteByDevice).toHaveBeenCalledWith(
      expect.anything(),
      { fromDate, toDate }
    );
  });

  it('[MON-041] fails when the repository fails', async () => {
    repo.deleteByDevice.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({
      deviceId: VALID_DEVICE_UUID
    });

    expect(result.isFailure).toBe(true);
  });
});
