// Source: src/application/device-inventory/use-cases/GetDeviceCredentialsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { SetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
import { GetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/GetDeviceCredentialsUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetDeviceCredentialsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createDevice: CreateDeviceUseCase;
  let setCredentials: SetDeviceCredentialsUseCase;
  let useCase: GetDeviceCredentialsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const credentialsRepo = new PrismaDeviceCredentialsRepository(
      prisma
    );
    const logger = new WinstonLogger();
    createDevice = new CreateDeviceUseCase(deviceRepo, logger);
    setCredentials = new SetDeviceCredentialsUseCase(
      deviceRepo,
      credentialsRepo,
      logger
    );
    useCase = new GetDeviceCredentialsUseCase(
      credentialsRepo,
      logger
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    const created = await createDevice.execute({
      deviceModelId,
      name: 'Credentialed Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-CRED-002'
    });
    expect(created.isSuccess).toBe(true);
    deviceId = created.value.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path — round trip through encryption
  // ──────────────────────────────────────────────────────────────

  it('retrieves stored HTTP credentials with the password masked', async () => {
    const stored = await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret',
      httpPort: 8443
    });
    expect(stored.isSuccess).toBe(true);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.deviceId).toBe(deviceId);
    expect(result.value.httpUsername).toBe('ubnt');
    expect(result.value.httpPassword).toBe('***');
    expect(result.value.httpPort).toBe(8443);
    expect(result.value.hasHttpCredentials).toBe(true);
  });

  it('retrieves stored SNMPv3 credentials with secrets masked', async () => {
    const stored = await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA',
      snmpV3AuthKey: 'auth-key-value',
      snmpV3PrivProto: 'AES',
      snmpV3PrivKey: 'priv-key-value'
    });
    expect(stored.isSuccess).toBe(true);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpVersion).toBe(3);
    expect(result.value.snmpV3AuthUser).toBe('monitor');
    expect(result.value.snmpV3AuthProto).toBe('SHA');
    expect(result.value.snmpV3AuthKey).toBe('***');
    expect(result.value.snmpV3PrivProto).toBe('AES');
    expect(result.value.snmpV3PrivKey).toBe('***');
    expect(result.value.hasSnmpCredentials).toBe(true);
  });

  it('never returns a plaintext secret in the DTO', async () => {
    await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret'
    });

    const result = await useCase.execute({ deviceId });

    expect(JSON.stringify(result.value)).not.toContain(
      'super-secret'
    );
  });

  it('reports hasSnmpCredentials=false when only HTTP is configured', async () => {
    await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret'
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.hasHttpCredentials).toBe(true);
    expect(result.value.hasSnmpCredentials).toBe(false);
    expect(result.value.snmpCommunity).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────
  // Not found / validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when the device has no credentials configured', async () => {
    const result = await useCase.execute({ deviceId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no credentials configured/i);
  });

  it('fails for a device that does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/no credentials configured/i);
  });

  it('fails with a malformed deviceId', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid deviceId/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({ deviceId: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/deviceId is required/i);
  });
});
