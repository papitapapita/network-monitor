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
import {
  DeviceName,
  DeviceStatus
} from '../../../../src/domain/device-inventory/value-objects';
import { DeviceOwnerType } from '../../../../src/domain/device-inventory/enums';
import {
  DeviceId,
  DeviceModelId
} from '../../../../src/domain/shared/ids';
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
    findByFilters: jest.fn(),
    findByIdIncludingDeleted: jest.fn(),
    findDeletedBefore: jest.fn(),
    countByFilters: jest.fn()
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

function makeHttpRequest(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return {
    deviceId: VALID_DEVICE_ID,
    httpUsername: 'ubnt',
    httpPassword: 'http-secret',
    ...overrides
  };
}

function makeV2Request(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return makeHttpRequest({
    snmpVersion: 2,
    snmpCommunity: 'public',
    ...overrides
  });
}

function makeV3Request(
  overrides: Partial<SetDeviceCredentialsRequestDTO> = {}
): SetDeviceCredentialsRequestDTO {
  return makeHttpRequest({
    snmpVersion: 3,
    snmpV3AuthUser: 'admin',
    snmpV3AuthProto: 'SHA',
    snmpV3AuthKey: 'secret-auth-key',
    ...overrides
  });
}

function makeStoredCredentials(
  overrides: Partial<DeviceCredentials> = {}
): DeviceCredentials {
  return {
    snmpVersion: 3,
    snmpCommunity: null,
    snmpV3AuthUser: 'stored-monitor',
    snmpV3AuthProto: 'SHA',
    snmpV3AuthKey: 'stored-auth-key',
    snmpV3PrivProto: 'AES',
    snmpV3PrivKey: 'stored-priv-key',
    httpUsername: 'stored-user',
    httpPassword: 'stored-pw',
    snmpPort: 1161,
    httpPort: 8443,
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
    credentialsRepo.findByDeviceId.mockResolvedValue(Result.ok(null));
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
  describe('[DEV-120] beforeExecute — HTTP credentials are required', () => {
    it('should pass with HTTP credentials alone and no SNMP fields', async () => {
      const result = await useCase.execute(makeHttpRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when both httpUsername and httpPassword are missing', async () => {
      const result = await useCase.execute(
        makeHttpRequest({
          httpUsername: undefined,
          httpPassword: undefined
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'httpUsername and httpPassword are required'
      );
    });

    it('should fail when httpPassword is missing', async () => {
      const result = await useCase.execute(
        makeHttpRequest({ httpPassword: undefined })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'httpUsername and httpPassword are required'
      );
    });

    it('should fail when httpUsername is whitespace only', async () => {
      const result = await useCase.execute(
        makeHttpRequest({ httpUsername: '   ' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'httpUsername and httpPassword are required'
      );
    });

    it('should fail when only SNMP credentials are supplied', async () => {
      const result = await useCase.execute(
        makeV2Request({
          httpUsername: undefined,
          httpPassword: undefined
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'httpUsername and httpPassword are required'
      );
    });
  });

  // =========================================================================
  describe('[DEV-122] [DEV-123] beforeExecute — snmpVersion validation', () => {
    it('should fail when an SNMP field is sent without snmpVersion', async () => {
      const result = await useCase.execute(
        makeHttpRequest({ snmpCommunity: 'public' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'snmpVersion is required when SNMP credentials are provided'
      );
    });

    it('should skip SNMP validation when SNMP fields are all null', async () => {
      const result = await useCase.execute(
        makeHttpRequest({
          snmpCommunity: null,
          snmpV3AuthUser: null,
          snmpV3AuthKey: null
        })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when snmpVersion is not 1, 2, or 3', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpVersion: 4 as 1 | 2 | 3 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'snmpVersion must be 1, 2, or 3'
      );
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
  describe('[DEV-124] beforeExecute — SNMPv1/v2 community string validation', () => {
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
  describe('[DEV-125] [DEV-126] beforeExecute — SNMPv3 field validation', () => {
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
        makeV3Request({
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: undefined
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('snmpV3PrivKey is required');
    });

    it('should pass when snmpV3PrivProto and snmpV3PrivKey are both provided', async () => {
      const result = await useCase.execute(
        makeV3Request({
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: 'priv-secret'
        })
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
  describe('[DEV-127] beforeExecute — port validation', () => {
    it('should fail when snmpPort is below 1', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: 0 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'snmpPort must be between 1 and 65535'
      );
    });

    it('should fail when snmpPort is above 65535', async () => {
      const result = await useCase.execute(
        makeV2Request({ snmpPort: 70000 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'snmpPort must be between 1 and 65535'
      );
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
      expect(result.error).toContain(
        'httpPort must be between 1 and 65535'
      );
    });

    it('should fail when httpPort is above 65535', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPort: 99999 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'httpPort must be between 1 and 65535'
      );
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
  describe('[DEV-121] executeImpl — device lookup', () => {
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
        makeV3Request({
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: 'priv-k'
        })
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
      await useCase.execute(
        makeV2Request({ deviceId: `  ${VALID_DEVICE_ID}  ` })
      );

      const savedDeviceId = credentialsRepo.save.mock.calls[0][0];
      expect(savedDeviceId.toString()).toBe(VALID_DEVICE_ID);
    });
  });

  // =========================================================================
  describe('[DEV-130] executeImpl — stored SNMP values survive an HTTP-only save', () => {
    beforeEach(() => {
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeStoredCredentials())
      );
    });

    it('should keep the stored SNMP fields when the request omits them', async () => {
      await useCase.execute(makeHttpRequest());

      const saved: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(saved.snmpVersion).toBe(3);
      expect(saved.snmpV3AuthUser).toBe('stored-monitor');
      expect(saved.snmpV3AuthProto).toBe('SHA');
      expect(saved.snmpV3AuthKey).toBe('stored-auth-key');
      expect(saved.snmpV3PrivProto).toBe('AES');
      expect(saved.snmpV3PrivKey).toBe('stored-priv-key');
      expect(saved.snmpPort).toBe(1161);
    });

    it('should replace the HTTP fields rather than keeping the stored ones', async () => {
      await useCase.execute(makeHttpRequest());

      const saved: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(saved.httpUsername).toBe('ubnt');
      expect(saved.httpPassword).toBe('http-secret');
      expect(saved.httpPort).toBe(443);
    });

    it('should clear a stored SNMP field when the request sends null', async () => {
      await useCase.execute(
        makeHttpRequest({
          snmpV3PrivProto: null,
          snmpV3PrivKey: null
        })
      );

      const saved: DeviceCredentials =
        credentialsRepo.save.mock.calls[0][1];

      expect(saved.snmpV3PrivProto).toBeNull();
      expect(saved.snmpV3PrivKey).toBeNull();
      expect(saved.snmpV3AuthKey).toBe('stored-auth-key');
    });

    it('should fail when the stored credentials lookup fails', async () => {
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.fail('Decryption error')
      );

      const result = await useCase.execute(makeHttpRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to look up credentials');
      expect(credentialsRepo.save).not.toHaveBeenCalled();
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

    it('should indicate hasHttpCredentials true when both httpUsername and httpPassword are set', async () => {
      const result = await useCase.execute(
        makeV2Request({
          httpUsername: 'admin',
          httpPassword: 'supersecret'
        })
      );

      expect(result.value!.hasHttpCredentials).toBe(true);
    });

    it('should indicate hasSnmpCredentials false on an HTTP-only request', async () => {
      const result = await useCase.execute(makeHttpRequest());

      expect(result.value!.hasSnmpCredentials).toBe(false);
    });

    it('should mask httpPassword in the response DTO when it is set', async () => {
      const result = await useCase.execute(
        makeV2Request({ httpPassword: 'supersecret' })
      );

      expect(result.value!.httpPassword).toBe('***');
    });
  });

  // =========================================================================
  describe('[DEV-129] sanitizeForLogging — secrets never reach the logs', () => {
    const SECRETS = {
      httpPassword: 'http-pw-plaintext',
      snmpCommunity: 'community-plaintext',
      snmpV3AuthKey: 'auth-key-plaintext',
      snmpV3PrivKey: 'priv-key-plaintext'
    };

    function loggedPayloads(): string {
      const calls = [
        ...(logger.info as jest.Mock).mock.calls,
        ...(logger.debug as jest.Mock).mock.calls,
        ...(logger.warn as jest.Mock).mock.calls,
        ...(logger.error as jest.Mock).mock.calls
      ];
      return JSON.stringify(calls);
    }

    it('should not write any secret value into the logs on a successful save', async () => {
      await useCase.execute(
        makeV3Request({
          httpPassword: SECRETS.httpPassword,
          snmpV3AuthKey: SECRETS.snmpV3AuthKey,
          snmpV3PrivProto: 'AES',
          snmpV3PrivKey: SECRETS.snmpV3PrivKey
        })
      );

      const logged = loggedPayloads();
      for (const secret of Object.values(SECRETS)) {
        expect(logged).not.toContain(secret);
      }
    });

    it('should not write the SNMP community string into the logs', async () => {
      await useCase.execute(
        makeV2Request({
          httpPassword: SECRETS.httpPassword,
          snmpCommunity: SECRETS.snmpCommunity
        })
      );

      const logged = loggedPayloads();
      expect(logged).not.toContain(SECRETS.snmpCommunity);
      expect(logged).not.toContain(SECRETS.httpPassword);
    });

    it('should not leak secrets when the request fails validation', async () => {
      await useCase.execute(
        makeV2Request({
          deviceId: '',
          httpPassword: SECRETS.httpPassword,
          snmpCommunity: SECRETS.snmpCommunity
        })
      );

      const logged = loggedPayloads();
      expect(logged).not.toContain(SECRETS.httpPassword);
      expect(logged).not.toContain(SECRETS.snmpCommunity);
    });

    it('should replace each secret field with *** rather than dropping it', () => {
      const sanitize = (
        useCase as unknown as {
          sanitizeForLogging(data: unknown): Record<string, unknown>;
        }
      ).sanitizeForLogging.bind(useCase);

      const sanitized = sanitize({
        deviceId: 'abc',
        httpUsername: 'admin',
        ...SECRETS
      });

      expect(sanitized.httpPassword).toBe('***');
      expect(sanitized.snmpCommunity).toBe('***');
      expect(sanitized.snmpV3AuthKey).toBe('***');
      expect(sanitized.snmpV3PrivKey).toBe('***');
      expect(sanitized.httpUsername).toBe('admin');
      expect(sanitized.deviceId).toBe('abc');
    });
  });
});
