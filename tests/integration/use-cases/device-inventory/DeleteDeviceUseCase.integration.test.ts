// Source: src/application/device-inventory/use-cases/DeleteDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { DeleteDeviceUseCase } from 'application/device-inventory/use-cases/DeleteDeviceUseCase';
import { GetDeviceUseCase } from 'application/device-inventory/use-cases/GetDeviceUseCase';
import { ListDevicesUseCase } from 'application/device-inventory/use-cases/ListDevicesUseCase';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanDatabase,
  cleanBills,
  cleanCustomers,
  cleanTickets,
  seedDeviceModel,
  seedLocation,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  seedTicket,
  waitForPollingConfig,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('DeleteDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let deleteUseCase: DeleteDeviceUseCase;
  let getUseCase: GetDeviceUseCase;
  let listUseCase: ListDevicesUseCase;
  let deviceModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    deleteUseCase = new DeleteDeviceUseCase(
      repo,
      new PrismaContractedServiceRepository(prisma),
      new PrismaTicketRepository(prisma),
      logger
    );
    getUseCase = new GetDeviceUseCase(repo, logger);
    listUseCase = new ListDevicesUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  // cleanDatabase() wipes locations, so the fixture is re-seeded per test.
  // FK-safe order: bills RESTRICT customers, tickets and contracted services
  // both reference devices, so all three go before the devices themselves.
  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId,
      name: 'Deletable Device',
      ownerType: 'COMPANY',
      serialNumber: 'SN-DEL-001',
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  // ──────────────────────────────────────────────────────────────
  // [DEV-070] Soft delete — the row survives, the device does not
  // ──────────────────────────────────────────────────────────────

  it('[DEV-070] keeps the row but stamps deletedAt', async () => {
    const id = await createDevice();

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });

  it('[DEV-070] records who deleted it', async () => {
    const id = await createDevice();
    const actor = '11111111-1111-4111-8111-111111111111';

    await deleteUseCase.execute({ id, deletedBy: actor });

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.deletedBy).toBe(actor);
  });

  it('[DEV-072] the deleted device is invisible to a direct read', async () => {
    const id = await createDevice();

    await deleteUseCase.execute({ id });

    const read = await getUseCase.execute({ id });
    expect(read.isFailure).toBe(true);
    expect(read.error).toMatch(/not found/i);
  });

  it('[DEV-072] the deleted device drops out of listings and the total', async () => {
    const doomed = await createDevice({ serialNumber: 'SN-DEL-A' });
    await createDevice({ serialNumber: 'SN-DEL-B' });

    await deleteUseCase.execute({ id: doomed });

    const list = await listUseCase.execute({});
    expect(list.isSuccess).toBe(true);
    expect(list.value.total).toBe(1);
    expect(list.value.devices.map((d) => d.id)).not.toContain(doomed);
  });

  it('[DEV-071] stops polling by disabling the polling configuration', async () => {
    const id = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.50.0.1',
      monitoringEnabled: true
    });
    await waitForPollingConfig(prisma, id);

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);

    const row = await prisma.device.findUnique({ where: { id } });
    expect(row!.monitoringEnabled).toBe(false);
  });

  // The partial unique index is scoped to live rows, so a tombstone must not
  // keep holding the address its replacement needs.
  it('[DEV-072] releases the IP address for reuse once deleted', async () => {
    const first = await createDevice({
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.50.0.77',
      monitoringEnabled: false,
      serialNumber: 'SN-IP-A'
    });

    await deleteUseCase.execute({ id: first });

    const second = await createUseCase.execute({
      deviceModelId,
      name: 'Reusing the address',
      ownerType: 'COMPANY',
      serialNumber: 'SN-IP-B',
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.50.0.77'
    });

    expect(second.isSuccess).toBe(true);
  });

  it('leaves other devices untouched', async () => {
    const doomed = await createDevice({ serialNumber: 'SN-DEL-A' });
    const survivor = await createDevice({ serialNumber: 'SN-DEL-B' });

    const result = await deleteUseCase.execute({ id: doomed });

    expect(result.isSuccess).toBe(true);

    const remaining = await prisma.device.findMany({
      where: { deletedAt: null }
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(survivor);
  });

  it('[DEV-068] is not idempotent — deleting twice fails the second time', async () => {
    const id = await createDevice();

    expect((await deleteUseCase.execute({ id })).isSuccess).toBe(true);

    const second = await deleteUseCase.execute({ id });

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/not found/i);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-075] Live contracted service blocks the delete
  // ──────────────────────────────────────────────────────────────

  async function attachContract(
    deviceId: string,
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  ): Promise<void> {
    const customerId = await seedCustomer(prisma);
    const servicePlanId = await seedServicePlan(prisma);
    const id = await seedActiveContractedService(
      prisma,
      customerId,
      servicePlanId,
      { deviceId }
    );
    if (status !== 'ACTIVE') {
      await prisma.contractedService.update({
        where: { id },
        data: { status }
      });
    }
  }

  it.each(['PENDING', 'ACTIVE', 'SUSPENDED'] as const)(
    '[DEV-075] refuses while a %s contracted service points at the device',
    async (status) => {
      const id = await createDevice();
      await attachContract(id, status);

      const result = await deleteUseCase.execute({ id });

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/live contracted service/i);

      const row = await prisma.device.findUnique({ where: { id } });
      expect(row!.deletedAt).toBeNull();
    }
  );

  it('[DEV-075] allows the delete once the service is CANCELLED', async () => {
    const id = await createDevice();
    await attachContract(id, 'CANCELLED');

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  it('[DEV-075] allows the delete when no service points at the device', async () => {
    const id = await createDevice();

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-076] Open tickets block the delete
  // ──────────────────────────────────────────────────────────────

  it.each(['OPEN', 'ASSIGNED', 'IN_PROGRESS'] as const)(
    '[DEV-076] refuses while a %s ticket references the device',
    async (status) => {
      const id = await createDevice();
      await seedTicket(prisma, { deviceId: id, status });

      const result = await deleteUseCase.execute({ id });

      expect(result.isFailure).toBe(true);
      expect(result.error).toMatch(/open ticket/i);

      const row = await prisma.device.findUnique({ where: { id } });
      expect(row!.deletedAt).toBeNull();
    }
  );

  it.each(['RESOLVED', 'CANCELLED'] as const)(
    '[DEV-076] allows the delete once the ticket is %s',
    async (status) => {
      const id = await createDevice();
      await seedTicket(prisma, { deviceId: id, status });

      const result = await deleteUseCase.execute({ id });

      expect(result.isSuccess).toBe(true);
    }
  );

  it('[DEV-076] names how many tickets are blocking', async () => {
    const id = await createDevice();
    await seedTicket(prisma, { deviceId: id, status: 'OPEN' });
    await seedTicket(prisma, { deviceId: id, status: 'ASSIGNED' });

    const result = await deleteUseCase.execute({ id });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('2 open ticket(s)');
  });

  it('[DEV-076] ignores open tickets belonging to another device', async () => {
    const id = await createDevice({ serialNumber: 'SN-T-A' });
    const other = await createDevice({ serialNumber: 'SN-T-B' });
    await seedTicket(prisma, { deviceId: other, status: 'OPEN' });

    const result = await deleteUseCase.execute({ id });

    expect(result.isSuccess).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Not found / validation failures
  // ──────────────────────────────────────────────────────────────

  it('[DEV-068] fails when the device does not exist (GHOST_ID)', async () => {
    const result = await deleteUseCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails with a malformed id', async () => {
    const result = await deleteUseCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('fails when id is empty', async () => {
    const result = await deleteUseCase.execute({ id: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });

  it('fails when id is only whitespace', async () => {
    const result = await deleteUseCase.execute({ id: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/required/i);
  });
});
