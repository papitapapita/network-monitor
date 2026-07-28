// Source: src/application/device-inventory/use-cases/SetDeviceCredentialsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { SetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
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

describe('SetDeviceCredentialsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createDevice: CreateDeviceUseCase;
  let useCase: SetDeviceCredentialsUseCase;
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
    useCase = new SetDeviceCredentialsUseCase(
      deviceRepo,
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
      serialNumber: 'SN-CRED-001'
    });
    expect(created.isSuccess).toBe(true);
    deviceId = created.value.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path — HTTP credentials
  // ──────────────────────────────────────────────────────────────

  it('stores HTTP credentials and masks the password in the response', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.httpUsername).toBe('ubnt');
    expect(result.value.httpPassword).toBe('***');
    expect(result.value.hasHttpCredentials).toBe(true);
  });

  it('encrypts the password at rest — the plaintext never reaches the column', async () => {
    await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret'
    });

    const row = await prisma.deviceCredentials.findUnique({
      where: { deviceId }
    });

    expect(row).not.toBeNull();
    expect(row!.httpPassword).not.toBeNull();
    expect(row!.httpPassword).not.toContain('super-secret');
    // iv:authTag:ciphertext, all base64
    expect(row!.httpPassword!.split(':')).toHaveLength(3);
  });

  it('defaults httpPort to 443 and snmpPort to 161', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.httpPort).toBe(443);
    expect(result.value.snmpPort).toBe(161);
  });

  it('overwrites credentials on a second call rather than creating a row', async () => {
    await useCase.execute({
      deviceId,
      httpUsername: 'first',
      httpPassword: 'pw1'
    });
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'second',
      httpPassword: 'pw2'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.httpUsername).toBe('second');

    const rows = await prisma.deviceCredentials.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].httpUsername).toBe('second');
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path — SNMP credentials
  // ──────────────────────────────────────────────────────────────

  it('stores SNMPv2 credentials with a community string', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 2,
      snmpCommunity: 'public-ro'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpVersion).toBe(2);
    expect(result.value.snmpCommunity).toBe('***');
    expect(result.value.hasSnmpCredentials).toBe(true);
  });

  it('stores SNMPv3 credentials with auth user and key', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA',
      snmpV3AuthKey: 'auth-key-value'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpV3AuthUser).toBe('monitor');
    expect(result.value.snmpV3AuthProto).toBe('SHA');
    expect(result.value.snmpV3AuthKey).toBe('***');
    expect(result.value.hasSnmpCredentials).toBe(true);
  });

  it('accepts a custom snmpPort and httpPort', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 2,
      snmpCommunity: 'public',
      snmpPort: 1161,
      httpPort: 8443
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpPort).toBe(1161);
    expect(result.value.httpPort).toBe(8443);
  });

  // ──────────────────────────────────────────────────────────────
  // Stored SNMP keys survive an HTTP-only save
  // ──────────────────────────────────────────────────────────────

  it('keeps stored SNMP keys when a later call sends HTTP credentials only', async () => {
    await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA',
      snmpV3AuthKey: 'auth-key-value',
      snmpPort: 1161
    });

    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'rotated-pw'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpVersion).toBe(3);
    expect(result.value.snmpV3AuthUser).toBe('monitor');
    expect(result.value.snmpV3AuthKey).toBe('***');
    expect(result.value.snmpPort).toBe(1161);
    expect(result.value.hasSnmpCredentials).toBe(true);
  });

  it('re-encrypts a carried-forward SNMP key rather than storing plaintext', async () => {
    await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA',
      snmpV3AuthKey: 'auth-key-value'
    });
    await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'rotated-pw'
    });

    const row = await prisma.deviceCredentials.findUnique({
      where: { deviceId }
    });

    expect(row!.snmpV3AuthKey).not.toBeNull();
    expect(row!.snmpV3AuthKey).not.toContain('auth-key-value');
    expect(row!.snmpV3AuthKey!.split(':')).toHaveLength(3);
  });

  it('clears a stored SNMP key when the request sends it as null', async () => {
    await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 2,
      snmpCommunity: 'public-ro'
    });

    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpCommunity: null
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.snmpCommunity).toBeNull();
    expect(result.value.hasSnmpCredentials).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

  it('fails when no HTTP credentials are supplied', async () => {
    const result = await useCase.execute({
      deviceId
    } as never);

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /httpUsername and httpPassword are required/i
    );
  });

  it('fails when only SNMP credentials are supplied', async () => {
    const result = await useCase.execute({
      deviceId,
      snmpVersion: 2,
      snmpCommunity: 'public-ro'
    } as never);

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /httpUsername and httpPassword are required/i
    );
  });

  it('fails when httpPassword is missing', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt'
    } as never);

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /httpUsername and httpPassword are required/i
    );
  });

  it('fails when an SNMP field is sent without snmpVersion', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpCommunity: 'public'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /snmpVersion is required when SNMP credentials are provided/i
    );
  });

  it('fails with an unsupported snmpVersion', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 4 as never,
      snmpCommunity: 'public'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/snmpVersion must be 1, 2, or 3/i);
  });

  it('fails when SNMPv2 is given without a community string', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 2
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/snmpCommunity is required/i);
  });

  it('fails when SNMPv3 is given without an auth user', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/snmpV3AuthUser is required/i);
  });

  it('fails when SNMPv3 is given without an auth key', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/snmpV3AuthKey is required/i);
  });

  it('fails when a priv protocol is set without a priv key', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthProto: 'SHA',
      snmpV3AuthKey: 'auth-key',
      snmpV3PrivProto: 'AES'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/snmpV3PrivKey is required/i);
  });

  it('fails with an out-of-range snmpPort', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      snmpVersion: 2,
      snmpCommunity: 'public',
      snmpPort: 70000
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /snmpPort must be between 1 and 65535/i
    );
  });

  it('fails with an out-of-range httpPort', async () => {
    const result = await useCase.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw',
      httpPort: 0
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /httpPort must be between 1 and 65535/i
    );
  });

  // ──────────────────────────────────────────────────────────────
  // Device resolution failures
  // ──────────────────────────────────────────────────────────────

  it('fails when the device does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({
      deviceId: GHOST_ID,
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device not found/i);
  });

  it('fails with a malformed deviceId', async () => {
    const result = await useCase.execute({
      deviceId: INVALID_ID,
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid deviceId/i);
  });

  it('fails when deviceId is empty', async () => {
    const result = await useCase.execute({
      deviceId: '',
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/deviceId is required/i);
  });
});
