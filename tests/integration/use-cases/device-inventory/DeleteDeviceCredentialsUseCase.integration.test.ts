// Source: src/application/device-inventory/use-cases/DeleteDeviceCredentialsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { SetDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/SetDeviceCredentialsUseCase';
import { DeleteDeviceCredentialsUseCase } from 'application/device-inventory/use-cases/DeleteDeviceCredentialsUseCase';
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

describe('DeleteDeviceCredentialsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createDevice: CreateDeviceUseCase;
  let setCredentials: SetDeviceCredentialsUseCase;
  let useCase: DeleteDeviceCredentialsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const deviceRepo = new PrismaDeviceRepository(prisma);
    const credentialsRepo = new PrismaDeviceCredentialsRepository(prisma);
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
    useCase = new DeleteDeviceCredentialsUseCase(credentialsRepo, logger);
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
      serialNumber: 'SN-CRED-003'
    });
    expect(created.isSuccess).toBe(true);
    deviceId = created.value.id;
  });

  // ──────────────────────────────────────────────────────────────
  // Happy path
  // ──────────────────────────────────────────────────────────────

  it('deletes the credentials row', async () => {
    const stored = await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });
    expect(stored.isSuccess).toBe(true);

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.deviceCredentials.findUnique({
      where: { deviceId }
    });
    expect(row).toBeNull();
  });

  it('leaves the device itself intact', async () => {
    await setCredentials.execute({
      deviceId,
      httpUsername: 'ubnt',
      httpPassword: 'pw'
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);

    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });
    expect(device).not.toBeNull();
    expect(device!.name).toBe('Credentialed Device');
  });

  it('[DEV-132] is idempotent — deleting when nothing is stored still succeeds', async () => {
    const first = await useCase.execute({ deviceId });
    const second = await useCase.execute({ deviceId });

    expect(first.isSuccess).toBe(true);
    expect(second.isSuccess).toBe(true);
  });

  it('[DEV-132] succeeds for a device that does not exist (GHOST_ID)', async () => {
    // The use case deletes by deviceId without loading the device first,
    // so a missing device is indistinguishable from missing credentials.
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isSuccess).toBe(true);
  });

  it('does not touch another device\'s credentials', async () => {
    const other = await createDevice.execute({
      deviceModelId,
      name: 'Other Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-CRED-004'
    });
    expect(other.isSuccess).toBe(true);

    await setCredentials.execute({
      deviceId,
      httpUsername: 'first',
      httpPassword: 'pw'
    });
    await setCredentials.execute({
      deviceId: other.value.id,
      httpUsername: 'second',
      httpPassword: 'pw'
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);

    const survivor = await prisma.deviceCredentials.findUnique({
      where: { deviceId: other.value.id }
    });
    expect(survivor).not.toBeNull();
    expect(survivor!.httpUsername).toBe('second');
  });

  // ──────────────────────────────────────────────────────────────
  // Validation failures
  // ──────────────────────────────────────────────────────────────

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
