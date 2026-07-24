// Source: src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts

import { SetDeviceCredentialsUseCase } from '../../../../src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository';
import {
  IDeviceCredentialsRepository,
  DeviceCredentials
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';
import { Device } from '../../../../src/domain/device-inventory/aggregates';
import { DeviceName, DeviceStatus } from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import { DeviceId, DeviceModelId } from '../../../../src/domain/shared/ids';
import { SetDeviceCredentialsRequestDTO } from '../../../../src/application/device-inventory/dtos';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DEVICE_MODEL = '550e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-06-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

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

function makeDeviceRepo(): jest.Mocked<IDeviceRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    findByLocation: jest.fn(),
    findByDeviceModel: jest.fn(),
    findByMacAddress: jest.fn(),
    findByIpAddress: jest.fn(),
    findByStatus: jest.fn(),
    existsByMacAddress: jest.fn(),
    existsByIpAddress: jest.fn(),
    findByLocationIds: jest.fn(),
    findByFilters: jest.fn()
  };
}

function makeCredentialsRepo(): jest.Mocked<IDeviceCredentialsRepository> {
  return {
    findByDeviceId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn()
  };
}

function makePersistedDevice(): Device {
  const id = DeviceId.parse(VALID_DEVICE_ID).value;
  const modelId = DeviceModelId.parse(VALID_DEVICE_MODEL)
    .value as unknown as DeviceId;
  const status = DeviceStatus.reconstitute(DeviceStatus.INVENTORY);
  const name = DeviceName.reconstitute('Core-Router-01');

  return Device.reconstitute(id, {
    deviceModelId: modelId as unknown as DeviceModelId,
    locationId: null,
    status,
    category: null,
    ownerType: DeviceOwnerType.COMPANY,
    name,
    serialNumber: null,
    macAddress: null,
    ipAddress: null,
    description: null,
    installedDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    monitoringEnabled: false
  });
}

function makeV2Request(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return {
    deviceId: VALID_DEVICE_ID,
    snmpVersion: 2,
    snmpCommunity: 'public',
    ...overrides
  };
}

function makeV3Request(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return {
    deviceId: VALID_DEVICE_ID,
    snmpVersion: 3,
    snmpV3AuthUser: 'admin',
    snmpV3AuthProto: 'SHA',
    snmpV3AuthKey: 'secret-auth-key',
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('SetDeviceCredentialsUseCase', () => {
  let deviceRepo: jest.Mocked<IDeviceRepository>;
  let credentialsRepo: jest.Mocked<IDeviceCredentialsRepository>;
  let logger: ILogger;
  let useCase: SetDeviceCredentialsUseCase;

  beforeEach(() => {
    deviceRepo = makeDeviceRepo();
    credentialsRepo = makeCredentialsRepo();
    logger = makeLogger();
    useCase = new SetDeviceCredentialsUseCase(
      deviceRepo,
      credentialsRepo,
      logger
    );

    deviceRepo.findById.mockResolvedValue(
      Result.ok(makePersistedDevice())
    );
    credentialsRepo.save.mockResolvedValue(Result.ok(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('beforeExecute — deviceId validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(
        makeV2Request({ deviceId: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(
        makeV2Request({ deviceId: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId is required');
    });

    it('should not call deviceRepo.findById when deviceId is missing', async () => {
      await useCase.execute(makeV2Request({ deviceId: '' }));

      expect(deviceRepo.findById).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('beforeExecute — snmpVersion validation', () => {
    it('should fail when snmpVersion is not 1, 2, or 3', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpVersion: 4 as 1 | 2 | 3 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpVersion must be 1, 2, or 3');
    });

    it('should pass when snmpVersion is 1', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpVersion: 1, snmpCommunity: 'public' })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when snmpVersion is 2', async () => {
      const result = await useCase.execute(makeV2Request());

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when snmpVersion is 3', async () => {
      const result = await useCase.execute(makeV3Request());

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('beforeExecute — SNMPv1/v2 community string validation', () => {
    it('should fail when snmpVersion is 1 and snmpCommunity is missing', async () => {
      const result = await useCase.execute(
        makeV2Request({
          snmpVersion: 1,
          snmpCommunity: undefined
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpCommunity is required');
    });

    it('should fail when snmpVersion is 2 and snmpCommunity is an empty string', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpCommunity: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpCommunity is required');
    });

    it('should fail when snmpVersion is 2 and snmpCommunity is whitespace only', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpCommunity: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpCommunity is required');
    });
  });

  // =========================================================================
  describe('beforeExecute — SNMPv3 field validation', () => {
    it('should fail when snmpVersion is 3 and snmpV3AuthUser is missing', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3AuthUser: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3AuthUser is required');
    });

    it('should fail when snmpVersion is 3 and snmpV3AuthUser is empty string', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3AuthUser: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3AuthUser is required');
    });

    it('should fail when snmpVersion is 3 and snmpV3AuthProto is missing', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3AuthProto: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3AuthProto is required');
    });

    it('should fail when snmpVersion is 3 and snmpV3AuthKey is missing', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3AuthKey: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3AuthKey is required');
    });

    it('should fail when snmpVersion is 3 and snmpV3AuthKey is whitespace only', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3AuthKey: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3AuthKey is required');
    });

    it('should fail when snmpV3PrivProto is set but snmpV3PrivKey is missing', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3PrivProto: 'AES', snmpV3PrivKey: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3PrivKey is required');
    });

    it('should pass when snmpV3PrivProto and snmpV3PrivKey are both provided', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3PrivProto: 'AES', snmpV3PrivKey: 'priv-secret' })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when snmpV3PrivProto is not set (privacy is optional)', async () => {
      const result = await useCase.execute(
        makeV3Request({ snmpV3PrivProto: undefined })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('beforeExecute — port validation', () => {
    it('should fail when snmpPort is below 1', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: 0 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpPort must be between 1 and 65535');
    });

    it('should fail when snmpPort is above 65535', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: 70000 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpPort must be between 1 and 65535');
    });

    it('should pass when snmpPort is within valid range', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: 161 })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should pass when snmpPort is not provided', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: undefined })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when httpPort is below 1', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPort: 0 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('httpPort must be between 1 and 65535');
    });

    it('should fail when httpPort is above 65535', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPort: 99999 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('httpPort must be between 1 and 65535');
    });

    it('should pass when httpPort is within valid range', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPort: 8080 })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  // =========================================================================
  describe('executeImpl — deviceId parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeV2Request({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid deviceId');
    });
  });

  // =========================================================================
  describe('executeImpl — device lookup', () => {
    it('should fail when device is not found (findById returns null)', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(null));

      const result = await useCase.execute(makeV2Request());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device not found');
    });

    it('should fail when deviceRepo.findById returns a failure Result', async () => {
      deviceRepo.findById.mockResolvedValue(
        Result.fail('DB connection lost')
      );

      const result = await useCase.execute(makeV2Request());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to look up device');
      expect(result.error).toContain('DB connection lost');
    });

    it('should not call credentialsRepo.save when device is not found', async () => {
      deviceRepo.findById.mockResolvedValue(Result.ok(null));

      await useCase.execute(makeV2Request());

      expect(credentialsRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('executeImpl — mapper delegation (extractCreateData)', () => {
    it('should call credentialsRepo.save with data shaped by extractCreateData (SNMPv2)', async () => {
      await useCase.execute(
        makeV2Request({ snmpCommunity: 'my-community' })
      );

      expect(credentialsRepo.save).toHaveBeenCalledTimes(1);
      const savedCredentials: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(savedCredentials.snmpVersion).toBe(2);
      expect(savedCredentials.snmpCommunity).toBe('my-community');
      expect(savedCredentials.snmpPort).toBe(161);
      expect(savedCredentials.httpPort).toBe(443);
    });

    it('should call credentialsRepo.save with data shaped by extractCreateData (SNMPv3)', async () => {
      await useCase.execute(
        makeV3Request({ snmpV3PrivProto: 'AES', snmpV3PrivKey: 'priv-k' })
      );

      expect(credentialsRepo.save).toHaveBeenCalledTimes(1);
      const savedCredentials: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(savedCredentials.snmpVersion).toBe(3);
      expect(savedCredentials.snmpV3AuthUser).toBe('admin');
      expect(savedCredentials.snmpV3AuthProto).toBe('SHA');
      expect(savedCredentials.snmpV3AuthKey).toBe('secret-auth-key');
      expect(savedCredentials.snmpV3PrivProto).toBe('AES');
      expect(savedCredentials.snmpV3PrivKey).toBe('priv-k');
    });

    it('should default snmpPort to 161 when not provided', async () => {
      await useCase.execute(makeV2Request({ snmpPort: undefined }));

      const savedCredentials: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(savedCredentials.snmpPort).toBe(161);
    });

    it('should default httpPort to 443 when not provided', async () => {
      await useCase.execute(makeV2Request({ httpPort: undefined }));

      const savedCredentials: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(savedCredentials.httpPort).toBe(443);
    });

    it('should set null for optional snmp fields when not provided', async () => {
      await useCase.execute(makeV2Request());

      const savedCredentials: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(savedCredentials.snmpV3AuthUser).toBeNull();
      expect(savedCredentials.snmpV3AuthProto).toBeNull();
      expect(savedCredentials.snmpV3AuthKey).toBeNull();
      expect(savedCredentials.snmpV3PrivProto).toBeNull();
      expect(savedCredentials.snmpV3PrivKey).toBeNull();
    });

    it('should pass the trimmed deviceId as the first arg to credentialsRepo.save', async () => {
      await useCase.execute(makeV2Request({ deviceId: `  ${VALID_DEVICE_ID}  ` }));

      const savedDeviceId = credentialsRepo.save.mock.calls[0][0];
      expect(savedDeviceId.toString()).toBe(VALID_DEVICE_ID);
    });
  });

  // =========================================================================
  describe('executeImpl — credentials save failure', () => {
    it('should fail when credentialsRepo.save returns a failure Result', async () => {
      credentialsRepo.save.mockResolvedValue(
        Result.fail('Encryption error')
      );

      const result = await useCase.execute(makeV2Request());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save credentials');
      expect(result.error).toContain('Encryption error');
    });
  });

  // =========================================================================
  describe('executeImpl — happy path', () => {
    it('should return isSuccess true on a valid SNMPv2 request', async () => {
      const result = await useCase.execute(makeV2Request());

      expect(result.isSuccess).toBe(true);
    });

    it('should return isSuccess true on a valid SNMPv3 request', async () => {
      const result = await useCase.execute(makeV3Request());

      expect(result.isSuccess).toBe(true);
    });

    it('should return a DeviceCredentialsResponseDTO with the correct deviceId', async () => {
      const result = await useCase.execute(makeV2Request());

      expect(result.value!.deviceId).toBe(VALID_DEVICE_ID);
    });

    it('should return snmpVersion in the response DTO', async () => {
      const result = await useCase.execute(makeV2Request());

      expect(result.value!.snmpVersion).toBe(2);
    });

    it('should mask snmpCommunity in the response DTO when it is set', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpCommunity: 'public' })
      );

      expect(result.value!.snmpCommunity).toBe('***');
    });

    it('should set snmpCommunity to null in the response DTO when not set', async () => {
      const result = await useCase.execute(makeV3Request());

      expect(result.value!.snmpCommunity).toBeNull();
    });

    it('should indicate hasSnmpCredentials true for a valid SNMPv2 setup', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpCommunity: 'public' })
      );

      expect(result.value!.hasSnmpCredentials).toBe(true);
    });

    it('should indicate hasSnmpCredentials true for a valid SNMPv3 setup', async () => {
      const result = await useCase.execute(makeV3Request());

      expect(result.value!.hasSnmpCredentials).toBe(true);
    });

    it('should indicate hasHttpCredentials false when HTTP credentials are not set', async () => {
      const result = await useCase.execute(makeV2Request());

      expect(result.value!.hasHttpCredentials).toBe(false);
    });

    it('should indicate hasHttpCredentials true when both httpUsername and httpPassword are set', async () => {
      const result = await useCase.execute(
        makeV2Request({
          httpUsername: 'admin',
          httpPassword: 'supersecret'
        })
      );

      expect(result.value!.hasHttpCredentials).toBe(true);
    });

    it('should mask httpPassword in the response DTO when it is set', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPassword: 'supersecret' })
      );

      expect(result.value!.httpPassword).toBe('***');
    });
  });
});
