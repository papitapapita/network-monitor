// Source: src/application/wireless-monitoring/use-cases/RebootWirelessDeviceUseCase.ts

import { RebootWirelessDeviceUseCase } from '../../../../src/application/wireless-monitoring/use-cases/RebootWirelessDeviceUseCase';
import { IWirelessDeviceConfigRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessDeviceConfigRepository';
import {
  IDeviceCredentialsRepository,
  DecryptedCredentials
} from '../../../../src/application/wireless-monitoring/interfaces/IDeviceCredentialsRepository';
import { IWirelessDeviceRebooter } from '../../../../src/application/wireless-monitoring/interfaces/IWirelessDeviceRebooter';
import { WirelessDeviceConfig } from '../../../../src/domain/wireless-monitoring/aggregates/WirelessDeviceConfig';
import { WirelessDeviceConfigId } from '../../../../src/domain/shared/ids/WirelessDeviceConfigId';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { IPAddress } from '../../../../src/domain/shared/value-objects/IPAddress';
import { PollingInterval } from '../../../../src/domain/wireless-monitoring/value-objects/PollingInterval';
import { Result } from '../../../../src/domain/shared/core/Result';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_IP = '192.168.1.100';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

function makeDeviceId(): DeviceId {
  return DeviceId.parse(VALID_DEVICE_UUID).value;
}

function makePollingConfig(
  overrides: {
    ipAddress?: IPAddress | null;
  } = {}
): WirelessDeviceConfig {
  const ipResult = IPAddress.create(VALID_IP);
  return WirelessDeviceConfig.reconstitute(
    WirelessDeviceConfigId.create(),
    {
      deviceId: makeDeviceId(),
      ipAddress:
        overrides.ipAddress !== undefined
          ? overrides.ipAddress
          : ipResult.value,
      enabled: true,
      pollingInterval: PollingInterval.reconstitute(60),
      deviceType: 'STATION',
      linkCapacityKbps: null,
      clientsProvisionedLimit: null,
      lastPolledAt: null
    }
  );
}

function makeCredentials(): DecryptedCredentials {
  return {
    snmpVersion: 2,
    snmpCommunity: null,
    snmpV3AuthUser: null,
    snmpV3AuthProto: null,
    snmpV3AuthKey: null,
    snmpV3PrivProto: null,
    snmpV3PrivKey: null,
    httpUsername: 'ubnt',
    httpPassword: 'ubnt',
    snmpPort: 161,
    httpPort: 443
  };
}

function makeMocks() {
  const wirelessDeviceConfigRepo: jest.Mocked<IWirelessDeviceConfigRepository> =
    {
      findByDeviceId: jest.fn(),
      save: jest.fn(),
      findAllDue: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn()
    };

  const credentialsRepo: jest.Mocked<IDeviceCredentialsRepository> = {
    findByDeviceId: jest.fn()
  };

  const rebooter: jest.Mocked<IWirelessDeviceRebooter> = {
    reboot: jest.fn()
  };

  return { wirelessDeviceConfigRepo, credentialsRepo, rebooter };
}

function makeUseCase() {
  const mocks = makeMocks();
  const logger = makeLogger();
  const useCase = new RebootWirelessDeviceUseCase(
    mocks.wirelessDeviceConfigRepo,
    mocks.credentialsRepo,
    mocks.rebooter,
    logger
  );
  return { useCase, ...mocks, logger };
}

// ---------------------------------------------------------------------------

describe('[WLS-024] RebootWirelessDeviceUseCase', () => {
  describe('Happy Path', () => {
    it('should reboot the device and return the acknowledgement', async () => {
      const {
        useCase,
        wirelessDeviceConfigRepo,
        credentialsRepo,
        rebooter
      } = makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeCredentials())
      );
      rebooter.reboot.mockResolvedValue(Result.ok());

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
      expect(result.value.requestedAt).toEqual(expect.any(String));
      expect(rebooter.reboot).toHaveBeenCalledWith(VALID_IP, {
        username: 'ubnt',
        password: 'ubnt',
        port: 443
      });
    });
  });

  describe('Validation failures', () => {
    it('should fail when device ID is missing', async () => {
      const { useCase } = makeUseCase();

      const result = await useCase.execute({ deviceId: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when device ID is not a valid UUID', async () => {
      const { useCase } = makeUseCase();

      const result = await useCase.execute({
        deviceId: 'not-a-uuid'
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  describe('Missing configuration', () => {
    it('should fail when no wireless config exists for the device', async () => {
      const { useCase, wirelessDeviceConfigRepo } = makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'No wireless polling configuration found'
      );
    });

    it('should fail when the config has no IP address', async () => {
      const { useCase, wirelessDeviceConfigRepo } = makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig({ ipAddress: null }))
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('no IP address');
    });

    it('should fail when no credentials are configured', async () => {
      const { useCase, wirelessDeviceConfigRepo, credentialsRepo } =
        makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(null)
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Credentials not configured');
    });
  });

  describe('Repository failures', () => {
    it('should fail when the config repository fails', async () => {
      const { useCase, wirelessDeviceConfigRepo } = makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.fail('DB down')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to load wireless polling config'
      );
    });

    it('should fail when the credentials repository fails', async () => {
      const { useCase, wirelessDeviceConfigRepo, credentialsRepo } =
        makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.fail('decrypt error')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load credentials');
    });
  });

  describe('Rebooter failures', () => {
    it('should fail when the rebooter fails', async () => {
      const {
        useCase,
        wirelessDeviceConfigRepo,
        credentialsRepo,
        rebooter
      } = makeUseCase();
      wirelessDeviceConfigRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makePollingConfig())
      );
      credentialsRepo.findByDeviceId.mockResolvedValue(
        Result.ok(makeCredentials())
      );
      rebooter.reboot.mockResolvedValue(
        Result.fail('Reboot request returned HTTP 500')
      );

      const result = await useCase.execute({
        deviceId: VALID_DEVICE_UUID
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to reboot device');
    });
  });
});
