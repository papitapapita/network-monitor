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
import { DeviceModel } from '../../../../src/domain/device-inventory/aggregates/DeviceModel';
import { DeviceType } from '../../../../src/domain/device-inventory/value-objects';
import {
  DeviceModelId,
  VendorId
} from '../../../../src/domain/shared/ids';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VENDOR_UUID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');

function makeDeviceModel(): DeviceModel {
  return DeviceModel.reconstitute(
    DeviceModelId.parse(VALID_UUID).value!,
    {
      vendorId: VendorId.parse(VENDOR_UUID).value!,
      vendorName: 'Mikrotik',
      vendorSlug: 'mikrotik',
      model: 'RB760iGS',
      deviceType: DeviceType.reconstitute(DeviceType.ROUTER),
      isWireless: false,
      imageUrl: null,
      createdAt: NOW,
      updatedAt: NOW
    }
  );
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
      findByVendor: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      existsByVendorAndModel: jest.fn(),
      findByVendorAndModel: jest.fn(),
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
      });
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return success when the device model is found', async () => {
      (mockRepository.findById as any).mockResolvedValue(
        Result.ok(makeDeviceModel())
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DTO with vendorName field', async () => {
      (mockRepository.findById as any).mockResolvedValue(
        Result.ok(makeDeviceModel())
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.vendorName).toBe('Mikrotik');
    });

    it('should return a DTO with model field', async () => {
      (mockRepository.findById as any).mockResolvedValue(
        Result.ok(makeDeviceModel())
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.value!.model).toBe('RB760iGS');
    });
  });

  // =========================================================================
  describe('executeImpl — not found', () => {
    it('should fail when the device model is not found', async () => {
      (mockRepository.findById as any).mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
    });
  });

  // =========================================================================
  describe('executeImpl — repository failure', () => {
    it('should propagate repository errors', async () => {
      (mockRepository.findById as any).mockResolvedValue(
        Result.fail('DB error')
      );

      const result = await useCase.execute({ id: VALID_UUID });

      expect(result.isFailure).toBe(true);
    });
  });
});
