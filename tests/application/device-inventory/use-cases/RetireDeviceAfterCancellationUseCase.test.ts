// Source: src/application/device-inventory/use-cases/RetireDeviceAfterCancellationUseCase.ts

import { RetireDeviceAfterCancellationUseCase } from '../../../../src/application/device-inventory/use-cases/RetireDeviceAfterCancellationUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import {
  IPAddress,
  MACAddress
} from '../../../../src/domain/shared/value-objects';
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';

const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const MODEL_ID = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2026-06-01T00:00:00.000Z');

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

function makeRepo(): jest.Mocked<
  Pick<IDeviceRepository, 'findById' | 'save'>
> {
  return { findById: jest.fn(), save: jest.fn() };
}

function makeDevice(
  overrides: {
    status?: string;
    ownerType?: DeviceOwnerType | null;
    monitoringEnabled?: boolean;
  } = {}
): Device {
  return Device.reconstitute(DeviceId.parse(DEVICE_ID).value, {
    deviceModelId: DeviceModelId.parse(MODEL_ID).value,
    locationId: null,
    agentId: null,
    status: DeviceStatus.reconstitute(
      overrides.status ?? DeviceStatus.ACTIVE
    ),
    category: null,
    ownerType:
      overrides.ownerType === undefined
        ? DeviceOwnerType.COMPANY
        : overrides.ownerType,
    name: DeviceName.reconstitute('CPE Ana'),
    serialNumber: null,
    macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
    ipAddress: IPAddress.create('10.0.0.5').value,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    deletedBy: null,
    replacedAt: null,
    replacesDeviceId: null,
    replacedByDeviceId: null,
    monitoringEnabled: overrides.monitoringEnabled ?? true
  });
}

describe('RetireDeviceAfterCancellationUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: RetireDeviceAfterCancellationUseCase;

  beforeEach(() => {
    repo = makeRepo();
    repo.save.mockImplementation(async (d: Device) => Result.ok(d));
    useCase = new RetireDeviceAfterCancellationUseCase(
      repo as unknown as IDeviceRepository,
      makeLogger()
    );
  });

  describe('[DEV-173] retires by owner', () => {
    it('moves a company device back to INVENTORY, off the network', async () => {
      const device = makeDevice({
        ownerType: DeviceOwnerType.COMPANY
      });
      repo.findById.mockResolvedValue(Result.ok(device));

      const result = await useCase.execute({ deviceId: DEVICE_ID });

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        deviceId: DEVICE_ID,
        outcome: 'RETIRED',
        status: 'INVENTORY'
      });
      expect(device.status.isInInventory()).toBe(true);
      expect(device.monitoringEnabled).toBe(false);
      expect(device.ipAddress).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(device);
    });

    it('decommissions a device the customer kept', async () => {
      const device = makeDevice({
        ownerType: DeviceOwnerType.CLIENT
      });
      repo.findById.mockResolvedValue(Result.ok(device));

      const result = await useCase.execute({ deviceId: DEVICE_ID });

      expect(result.value.outcome).toBe('RETIRED');
      expect(device.status.isDecommissioned()).toBe(true);
      expect(device.monitoringEnabled).toBe(false);
      expect(device.ipAddress).toBeNull();
    });

    it('leaves a device with no recorded owner untouched', async () => {
      const device = makeDevice({ ownerType: null });
      repo.findById.mockResolvedValue(Result.ok(device));

      const result = await useCase.execute({ deviceId: DEVICE_ID });

      expect(result.value.outcome).toBe('SKIPPED_NO_OWNER');
      expect(device.status.toString()).toBe('ACTIVE');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it.each([DeviceStatus.DAMAGED, DeviceStatus.DECOMMISSIONED])(
      'leaves a %s device as it is',
      async (status) => {
        const device = makeDevice({
          status,
          ownerType: DeviceOwnerType.COMPANY,
          monitoringEnabled: false
        });
        repo.findById.mockResolvedValue(Result.ok(device));

        const result = await useCase.execute({ deviceId: DEVICE_ID });

        expect(result.value.outcome).toBe('SKIPPED_ALREADY_RETIRED');
        expect(device.status.toString()).toBe(status);
        expect(repo.save).not.toHaveBeenCalled();
      }
    );

    it('skips a device that is gone or in the trash', async () => {
      repo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute({ deviceId: DEVICE_ID });

      expect(result.value).toEqual({
        deviceId: DEVICE_ID,
        outcome: 'SKIPPED_NOT_FOUND',
        status: null
      });
    });
  });

  it('fails when the device cannot be saved', async () => {
    repo.findById.mockResolvedValue(Result.ok(makeDevice()));
    repo.save.mockResolvedValue(Result.fail('Database error'));

    const result = await useCase.execute({ deviceId: DEVICE_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Database error');
  });

  it('fails on a malformed device id', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
  });
});
