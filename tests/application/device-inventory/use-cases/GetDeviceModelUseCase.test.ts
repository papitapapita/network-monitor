// Source: src/application/device-inventory/use-cases/GetDeviceModelUseCase.ts

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach
} from '@jest/globals';
import { GetDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/GetDeviceModelUseCase';
import { IDeviceModelRepository } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { DeviceModelRecord } from '../../../../src/domain/device-inventory/repository/IDeviceModelRepository';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeRecord(
  overrides: Partial<DeviceModelRecord> = {}
): DeviceModelRecord {
  return {
    id: VALID_UUID,
    manufacturer: 'Mikrotik',
    model: 'RB760iGS',
    deviceType: 'ROUTER',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('GetDeviceModelUseCase', () => {
  let useCase: GetDeviceModelUseCase;
  let mockRepository: jest.Mocked<IDeviceModelRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as any;

    useCase = new GetDeviceModelUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — input validation', () => {
    describe('id validation', () => {
      it('should fail when id is an empty string', async () => {
        const result = await useCase.execute({ id: '' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ID');
      });

      it('should fail when id is only whitespace', async () => {
        const result = await useCase.execute({ id: '   ' });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ID');
      });

      it('should not call repository.findById when id is empty', async () => {
        await useCase.execute({ id: '' });

        expect(mockRepository.findById).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  describe('executeImpl — successful retrieval', () => {
    describe('repository interaction', () => {
      it('should call repository.findById exactly once', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord())
        );

        await useCase.execute({ id: VALID_UUID });

        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      });

      it('should call repository.findById with a DeviceModelId matching the request id', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord())
        );

        await useCase.execute({ id: VALID_UUID });

        const calledWithId = (
          mockRepository.findById as jest.MockedFunction<
            typeof mockRepository.findById
          >
        ).mock.calls[0][0];
        expect(calledWithId.toString()).toBe(VALID_UUID);
      });

      it('should trim whitespace from the id before calling the repository', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord())
        );

        await useCase.execute({ id: `  ${VALID_UUID}  ` });

        const calledWithId = (
          mockRepository.findById as jest.MockedFunction<
            typeof mockRepository.findById
          >
        ).mock.calls[0][0];
        expect(calledWithId.toString()).toBe(VALID_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('response DTO fields', () => {
      it('should return isSuccess true when the model is found', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(makeRecord()));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isSuccess).toBe(true);
      });

      it('should return the id from the record', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(makeRecord()));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.id).toBe(VALID_UUID);
      });

      it('should return the manufacturer from the record', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord({ manufacturer: 'Ubiquiti' }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.manufacturer).toBe('Ubiquiti');
      });

      it('should return the model from the record', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord({ model: 'UniFi AP' }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.model).toBe('UniFi AP');
      });

      it('should return the deviceType from the record', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.ok(makeRecord({ deviceType: 'SWITCH' }))
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.deviceType).toBe('SWITCH');
      });

      it('should return createdAt as an ISO 8601 string', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(makeRecord()));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.createdAt).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should return updatedAt as an ISO 8601 string', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(makeRecord()));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.value.updatedAt).toBe('2024-01-01T00:00:00.000Z');
      });
    });
  });

  // =========================================================================
  describe('executeImpl — failure paths', () => {
    describe('invalid id format', () => {
      it('should return failure when id is not a valid UUID', async () => {
        const result = await useCase.execute({ id: 'not-a-valid-id' });

        expect(result.isFailure).toBe(true);
      });

      it('should include "Invalid" in the error when the id format is wrong', async () => {
        const result = await useCase.execute({ id: 'not-a-valid-id' });

        expect(result.error).toContain('Invalid');
      });

      it('should not call repository.findById when the id format is invalid', async () => {
        await useCase.execute({ id: 'not-a-valid-id' });

        expect(mockRepository.findById).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('device model not found', () => {
      it('should return failure when repository.findById returns null', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isFailure).toBe(true);
      });

      it('should include "not found" in the error message', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.error).toContain('not found');
      });

      it('should include the requested id in the error message', async () => {
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.error).toContain(VALID_UUID);
      });
    });

    // -----------------------------------------------------------------------
    describe('repository failure', () => {
      it('should return failure when repository.findById returns a failure Result', async () => {
        mockRepository.findById.mockResolvedValue(
          Result.fail('DB timeout')
        );

        const result = await useCase.execute({ id: VALID_UUID });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('DB timeout');
      });
    });
  });
});
