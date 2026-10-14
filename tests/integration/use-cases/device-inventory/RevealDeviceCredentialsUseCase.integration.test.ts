// Source: src/application/device-inventory/use-cases/RevealDeviceCredentialsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { SetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
import { RevealDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/RevealDeviceCredentialsUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { ILogger, LogContext } from 'application/shared/interfaces';
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

describe('RevealDeviceCredentialsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createDevice: CreateDeviceUseCase;
  let setCredentials: SetDeviceCredentialsUseCase;
  let useCase: RevealDeviceCredentialsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  const REVEALED_BY = 'operator-user-id';

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const credentialsRepo = new PrismaDeviceCredentialsRepository(
      prisma
    );
    const logger = new WinstonLogger();
    createDevice = new CreateDeviceUseCase(
      deviceRepo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    setCredentials = new SetDeviceCredentialsUseCase(
      deviceRepo,
      credentialsRepo,
      logger
    );
    useCase = new RevealDeviceCredentialsUseCase(
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
      serialNumber: 'SN-CRED-REVEAL'
    });
    if (created.isFailure) throw new Error(created.error);
    deviceId = created.value.id;
  });

  it('[DEV-134] decrypts every stored secret', async () => {
    await setCredentials.execute({
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

    const result = await useCase.execute({
      deviceId,
      revealedBy: REVEALED_BY
    });

    expect(result.value).toMatchObject({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret',
      snmpVersion: 3,
      snmpV3AuthUser: 'monitor',
      snmpV3AuthKey: 'auth-key-value',
      snmpV3PrivKey: 'priv-key-value'
    });
  });

  it('[DEV-135] logs who saw which device, without the secrets', async () => {
    await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'super-secret'
    });
    const lines: {
      level: string;
      message: string;
      context?: LogContext;
    }[] = [];
    const recording: ILogger = {
      debug: (message, context) =>
        lines.push({ level: 'debug', message, context }),
      info: (message, context) =>
        lines.push({ level: 'info', message, context }),
      warn: (message, context) =>
        lines.push({ level: 'warn', message, context }),
      error: (message, _e, context) =>
        lines.push({ level: 'error', message, context }),
      fatal: (message, _e, context) =>
        lines.push({ level: 'fatal', message, context }),
      child: () => recording,
      setLevel: () => undefined
    };
    const recorded = new RevealDeviceCredentialsUseCase(
      new PrismaDeviceCredentialsRepository(prisma),
      recording
    );

    await recorded.execute({ deviceId, revealedBy: REVEALED_BY });

    expect(lines).toContainEqual({
      level: 'warn',
      message: 'Device credentials revealed',
      context: { deviceId, revealedBy: REVEALED_BY }
    });
    expect(JSON.stringify(lines)).not.toContain('super-secret');
  });

  it('[DEV-131] fails when the device has no credentials configured', async () => {
    const result = await useCase.execute({
      deviceId,
      revealedBy: REVEALED_BY
    });

    expect(result.error).toMatch(/no credentials configured/i);
  });

  it('fails for a device that does not exist (GHOST_ID)', async () => {
    const result = await useCase.execute({
      deviceId: GHOST_ID,
      revealedBy: REVEALED_BY
    });

    expect(result.error).toMatch(/no credentials configured/i);
  });

  it('fails with a malformed deviceId', async () => {
    const result = await useCase.execute({
      deviceId: INVALID_ID,
      revealedBy: REVEALED_BY
    });

    expect(result.error).toMatch(/invalid deviceId/i);
  });
});
