// Source: src/infrastructure/wireless-monitoring/repositories/PrismaDeviceCredentialsRepository.ts
//
// NOTE: CredentialsEncryption is mocked using its module path alias so that the
// import inside PrismaDeviceCredentialsRepository (which uses a relative path
// resolved at build time) is intercepted by Jest's module registry.
// The mock uses a predictable prefix strategy so assertion values are easy to
// verify without needing a real AES key.

import { PrismaDeviceCredentialsRepository } from '../../../../src/infrastructure/wireless-monitoring/repositories/PrismaDeviceCredentialsRepository';
import { DeviceId } from 'domain/shared';
import { DecryptedCredentials } from 'application/wireless-monitoring/interfaces';
import type { PrismaClient } from '../../../../src/generated/prisma/client';

// Jest.mock must be hoisted before imports and uses a factory to avoid
// the hoisting constraint when referencing module-level variables.
jest.mock('../../../../src/infrastructure/wireless-monitoring/crypto/CredentialsEncryption', () => ({
  CredentialsEncryption: {
    encrypt: jest.fn((plaintext: string) => `enc:${plaintext}`),
    decrypt: jest.fn((ciphertext: string) => ciphertext.replace(/^enc:/, '')),
  },
}));

// Import the mocked module AFTER jest.mock so we can access the mock functions
import { CredentialsEncryption } from '../../../../src/infrastructure/wireless-monitoring/crypto/CredentialsEncryption';

const DEVICE_UUID = 'f149790a-58f0-479a-8534-b0b01e9942bb';

const mockEncrypt = CredentialsEncryption.encrypt as jest.Mock;
const mockDecrypt = CredentialsEncryption.decrypt as jest.Mock;

const createMockPrisma = () => ({
  deviceCredentials: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
});

const makeDecryptedCredentials = (overrides: Partial<DecryptedCredentials> = {}): DecryptedCredentials => ({
  snmpVersion: 2,
  snmpCommunity: 'public',
  snmpV3AuthUser: null,
  snmpV3AuthProto: null,
  snmpV3AuthKey: null,
  snmpV3PrivProto: null,
  snmpV3PrivKey: null,
  httpUsername: 'ubnt',
  httpPassword: 'secret',
  snmpPort: 161,
  httpPort: 80,
  ...overrides,
});

const makePrismaRow = () => ({
  deviceId: DEVICE_UUID,
  snmpVersion: 2,
  snmpCommunity: 'enc:public',
  snmpV3AuthUser: null,
  snmpV3AuthProto: null,
  snmpV3AuthKey: null,
  snmpV3PrivProto: null,
  snmpV3PrivKey: null,
  httpUsername: 'ubnt',
  httpPassword: 'enc:secret',
  snmpPort: 161,
  httpPort: 80,
});

describe('PrismaDeviceCredentialsRepository', () => {
  let prismaMock: ReturnType<typeof createMockPrisma>;
  let repository: PrismaDeviceCredentialsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = createMockPrisma();
    repository = new PrismaDeviceCredentialsRepository(prismaMock as unknown as PrismaClient);
  });

  describe('save', () => {
    it('should encrypt snmpCommunity before persisting', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const credentials = makeDecryptedCredentials({ snmpCommunity: 'myCommunity' });

      await repository.save(deviceId, credentials);

      expect(mockEncrypt).toHaveBeenCalledWith('myCommunity');
      const arg = prismaMock.deviceCredentials.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      };
      expect(arg.create['snmpCommunity']).toBe('enc:myCommunity');
      expect(arg.update['snmpCommunity']).toBe('enc:myCommunity');
    });

    it('should encrypt httpPassword before persisting', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const credentials = makeDecryptedCredentials({ httpPassword: 'myPassword' });

      await repository.save(deviceId, credentials);

      expect(mockEncrypt).toHaveBeenCalledWith('myPassword');
      const arg = prismaMock.deviceCredentials.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>;
      };
      expect(arg.create['httpPassword']).toBe('enc:myPassword');
    });

    it('should encrypt snmpV3AuthKey and snmpV3PrivKey when they are present', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const credentials = makeDecryptedCredentials({
        snmpVersion: 3,
        snmpCommunity: null,
        snmpV3AuthUser: 'admin',
        snmpV3AuthProto: 'SHA',
        snmpV3AuthKey: 'authKey123',
        snmpV3PrivProto: 'AES',
        snmpV3PrivKey: 'privKey123',
        httpPassword: null,
      });

      await repository.save(deviceId, credentials);

      const arg = prismaMock.deviceCredentials.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>;
      };
      expect(arg.create['snmpV3AuthKey']).toBe('enc:authKey123');
      expect(arg.create['snmpV3PrivKey']).toBe('enc:privKey123');
    });

    it('should persist null for snmpCommunity when the credential is null', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;
      const credentials = makeDecryptedCredentials({ snmpCommunity: null, httpPassword: null });

      await repository.save(deviceId, credentials);

      const arg = prismaMock.deviceCredentials.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>;
      };
      expect(arg.create['snmpCommunity']).toBeNull();
      // encrypt must not be called when fields are null
      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it('should persist the deviceId as the upsert where clause', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.save(deviceId, makeDecryptedCredentials());

      const arg = prismaMock.deviceCredentials.upsert.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(arg.where).toEqual({ deviceId: DEVICE_UUID });
    });

    it('should return Result.ok(undefined) on success', async () => {
      prismaMock.deviceCredentials.upsert.mockResolvedValue({});
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.save(deviceId, makeDecryptedCredentials());

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return a failed Result when prisma.deviceCredentials.upsert throws', async () => {
      prismaMock.deviceCredentials.upsert.mockRejectedValue(new Error('FK constraint'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.save(deviceId, makeDecryptedCredentials());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error saving device credentials');
    });
  });

  describe('findByDeviceId', () => {
    it('should call findUnique with the deviceId filter', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      await repository.findByDeviceId(deviceId);

      expect(prismaMock.deviceCredentials.findUnique).toHaveBeenCalledWith({
        where: { deviceId: DEVICE_UUID },
      });
    });

    it('should return Result.ok(null) when no credentials are found', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(null);
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should decrypt snmpCommunity before returning the domain credentials', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(mockDecrypt).toHaveBeenCalledWith('enc:public');
      expect(result.isSuccess).toBe(true);
      expect(result.value!.snmpCommunity).toBe('public');
    });

    it('should decrypt httpPassword before returning the domain credentials', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(mockDecrypt).toHaveBeenCalledWith('enc:secret');
      expect(result.value!.httpPassword).toBe('secret');
    });

    it('should not call decrypt for null credential fields', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue({
        ...makePrismaRow(),
        snmpCommunity: null,
        httpPassword: null,
        snmpV3AuthKey: null,
        snmpV3PrivKey: null,
      });
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(mockDecrypt).not.toHaveBeenCalled();
      expect(result.value!.snmpCommunity).toBeNull();
      expect(result.value!.httpPassword).toBeNull();
    });

    it('should return all non-sensitive credential fields unmutated', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(makePrismaRow());
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.value!.snmpVersion).toBe(2);
      expect(result.value!.httpUsername).toBe('ubnt');
      expect(result.value!.snmpPort).toBe(161);
      expect(result.value!.httpPort).toBe(80);
    });

    it('should decrypt snmpV3AuthKey and snmpV3PrivKey when they are present', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue({
        ...makePrismaRow(),
        snmpVersion: 3,
        snmpCommunity: null,
        snmpV3AuthUser: 'admin',
        snmpV3AuthProto: 'SHA',
        snmpV3AuthKey: 'enc:authKey123',
        snmpV3PrivProto: 'AES',
        snmpV3PrivKey: 'enc:privKey123',
        httpPassword: null,
      });
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.value!.snmpV3AuthKey).toBe('authKey123');
      expect(result.value!.snmpV3PrivKey).toBe('privKey123');
    });

    it('should return a failed Result when CredentialsEncryption.decrypt throws', async () => {
      prismaMock.deviceCredentials.findUnique.mockResolvedValue(makePrismaRow());
      mockDecrypt.mockImplementationOnce(() => { throw new Error('decryption failed'); });
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding device credentials');
    });

    it('should return a failed Result when prisma.deviceCredentials.findUnique throws', async () => {
      prismaMock.deviceCredentials.findUnique.mockRejectedValue(new Error('connection lost'));
      const deviceId = DeviceId.parse(DEVICE_UUID).value;

      const result = await repository.findByDeviceId(deviceId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error finding device credentials');
    });
  });
});
