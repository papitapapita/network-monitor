// Source: src/application/device-inventory/use-cases/ReplaceDeviceUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaLocationRepository } from 'infrastructure/persistence/PrismaLocationRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence';
import { PrismaContractedServiceRepository } from 'infrastructure/customers';
import { PrismaWirelessDeviceConfigRepository } from 'infrastructure/wireless-monitoring';
import { CreateDeviceUseCase } from 'application/device-inventory/use-cases/CreateDeviceUseCase';
import { ReplaceDeviceUseCase } from 'application/device-inventory/use-cases/ReplaceDeviceUseCase';
import { GetDeviceUseCase } from 'application/device-inventory/use-cases/GetDeviceUseCase';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { DeviceId } from 'domain/shared/ids';
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
  seedWirelessDeviceModel,
  seedLocation,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('ReplaceDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let createUseCase: CreateDeviceUseCase;
  let replaceUseCase: ReplaceDeviceUseCase;
  let getUseCase: GetDeviceUseCase;
  let wiredModelId: string;
  let wirelessModelId: string;
  let locationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    wiredModelId = await seedDeviceModel(prisma);
    wirelessModelId = await seedWirelessDeviceModel(prisma);

    const repo = new PrismaDeviceRepository(prisma);
    const logger = new WinstonLogger();
    createUseCase = new CreateDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaLocationRepository(prisma),
      logger
    );
    replaceUseCase = new ReplaceDeviceUseCase(
      repo,
      new PrismaDeviceModelRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      new PrismaContractedServiceRepository(prisma),
      new PrismaWirelessDeviceConfigRepository(prisma),
      logger
    );
    getUseCase = new GetDeviceUseCase(repo, logger);
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanTickets(prisma);
    await cleanCustomers(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  async function createActiveDevice(
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await createUseCase.execute({
      deviceModelId: wirelessModelId,
      name: 'CPE-Casa-12',
      ownerType: 'CLIENT',
      category: 'WIRELESS_CPE',
      serialNumber: 'SN-OLD-001',
      macAddress: 'AA:BB:CC:DD:EE:01',
      locationId,
      status: 'ACTIVE',
      ipAddress: '10.60.0.10',
      monitoringEnabled: true,
      ...overrides
    });
    expect(result.isSuccess).toBe(true);
    return result.value.id;
  }

  function request(overrides: Record<string, unknown> = {}) {
    return {
      id: '',
      deviceModelId: wirelessModelId,
      retiredStatus: 'DAMAGED',
      serialNumber: 'SN-NEW-001',
      macAddress: 'AA:BB:CC:DD:EE:02',
      ...overrides
    };
  }

  // ──────────────────────────────────────────────────────────────
  // [DEV-078] Lineage
  // ──────────────────────────────────────────────────────────────

  it('[DEV-078] creates a new device linked to the one it replaces', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    expect(result.isSuccess).toBe(true);
    const newId = result.value.newDevice.id;
    expect(newId).not.toBe(oldId);

    const newRow = await prisma.device.findUnique({
      where: { id: newId }
    });
    expect(newRow!.replacesDeviceId).toBe(oldId);
    expect(newRow!.replacedAt).toBeInstanceOf(Date);
  });

  it('[DEV-078] exposes the reverse link on the retired unit', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );
    const newId = result.value.newDevice.id;

    // The response must already carry the link — a client that reads it back
    // immediately would otherwise be told null for something that is set.
    expect(result.value.retiredDevice.replacedByDeviceId).toBe(newId);

    // replacedByDeviceId is the back-reference, so it must be readable off the
    // old row without anything having written a second column.
    const reread = await getUseCase.execute({ id: oldId });
    expect(reread.isSuccess).toBe(true);
    expect(reread.value.replacedByDeviceId).toBe(newId);
  });

  it.each(['INVENTORY', 'DAMAGED', 'DECOMMISSIONED'] as const)(
    '[DEV-078] retires the old unit into the caller-chosen %s',
    async (retiredStatus) => {
      const oldId = await createActiveDevice();

      const result = await replaceUseCase.execute(
        request({ id: oldId, retiredStatus })
      );

      expect(result.isSuccess).toBe(true);
      const oldRow = await prisma.device.findUnique({
        where: { id: oldId }
      });
      expect(oldRow!.status).toBe(retiredStatus);
    }
  );

  it('[DEV-082] refuses to replace the same unit twice', async () => {
    const oldId = await createActiveDevice();
    await replaceUseCase.execute(request({ id: oldId }));

    const second = await replaceUseCase.execute(
      request({
        id: oldId,
        serialNumber: 'SN-NEW-002',
        macAddress: 'AA:BB:CC:DD:EE:03'
      })
    );

    expect(second.isFailure).toBe(true);
    expect(second.error).toMatch(/already been replaced/i);
  });

  it('keeps the retired unit’s history on the retired unit', async () => {
    const oldId = await createActiveDevice();
    await prisma.pingResult.create({
      data: { deviceId: oldId, isReachable: true, latencyMs: 12 }
    });

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    const pings = await prisma.pingResult.findMany({
      where: { deviceId: oldId }
    });
    expect(pings).toHaveLength(1);
    const newPings = await prisma.pingResult.findMany({
      where: { deviceId: result.value.newDevice.id }
    });
    expect(newPings).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-079] IP handover
  // ──────────────────────────────────────────────────────────────

  it('[DEV-079] moves the IP from the retired unit to the replacement', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    const oldRow = await prisma.device.findUnique({
      where: { id: oldId }
    });
    const newRow = await prisma.device.findUnique({
      where: { id: result.value.newDevice.id }
    });

    expect(oldRow!.ipAddress).toBeNull();
    expect(newRow!.ipAddress).toBe('10.60.0.10');
  });

  it('[DEV-079] stops monitoring on the retired unit', async () => {
    const oldId = await createActiveDevice();

    await replaceUseCase.execute(request({ id: oldId }));

    const oldRow = await prisma.device.findUnique({
      where: { id: oldId }
    });
    expect(oldRow!.monitoringEnabled).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-080] Credentials and contracted service follow the job
  // ──────────────────────────────────────────────────────────────

  it('[DEV-080] moves the credentials onto the replacement', async () => {
    const oldId = await createActiveDevice();
    // Seeded through the repository, not raw Prisma: the stored columns are
    // encrypted, so a plaintext row would fail to read back.
    const credentialsRepo = new PrismaDeviceCredentialsRepository(
      prisma
    );
    const seeded = await credentialsRepo.save(
      DeviceId.parse(oldId).value,
      {
        snmpVersion: 3,
        snmpCommunity: null,
        snmpV3AuthUser: null,
        snmpV3AuthProto: null,
        snmpV3AuthKey: null,
        snmpV3PrivProto: null,
        snmpV3PrivKey: null,
        httpUsername: 'ubnt-user',
        httpPassword: 'ubnt-pass',
        snmpPort: 161,
        httpPort: 443
      }
    );
    expect(seeded.isSuccess).toBe(true);

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.credentialsTransferred).toBe(true);

    const oldCreds = await prisma.deviceCredentials.findUnique({
      where: { deviceId: oldId }
    });
    const newCreds = await prisma.deviceCredentials.findUnique({
      where: { deviceId: result.value.newDevice.id }
    });
    expect(oldCreds).toBeNull();
    expect(newCreds).not.toBeNull();
  });

  it('[DEV-080] re-points the contracted service at the replacement', async () => {
    const oldId = await createActiveDevice();
    const customerId = await seedCustomer(prisma);
    const servicePlanId = await seedServicePlan(prisma);
    const serviceId = await seedActiveContractedService(
      prisma,
      customerId,
      servicePlanId,
      { deviceId: oldId }
    );

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    expect(result.value.contractedServiceTransferred).toBe(true);

    const service = await prisma.contractedService.findUnique({
      where: { id: serviceId }
    });
    expect(service!.deviceId).toBe(result.value.newDevice.id);
  });

  it('[DEV-080] reports nothing transferred when there was nothing to move', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    expect(result.value.credentialsTransferred).toBe(false);
    expect(result.value.contractedServiceTransferred).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // [DEV-081] Wireless config on a model mismatch
  // ──────────────────────────────────────────────────────────────

  it('[DEV-081] removes the wireless config when the replacement has no radio', async () => {
    const oldId = await createActiveDevice();
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: oldId,
        ipAddress: '10.60.0.10',
        enabled: true,
        intervalSecs: 3600,
        deviceType: 'STATION'
      }
    });

    const result = await replaceUseCase.execute(
      request({ id: oldId, deviceModelId: wiredModelId })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.value.wirelessConfigRemoved).toBe(true);

    const configs =
      await prisma.wirelessPollingConfiguration.findMany({
        where: { deviceId: oldId }
      });
    expect(configs).toHaveLength(0);
  });

  it('[DEV-081] keeps the config when the replacement is also wireless', async () => {
    const oldId = await createActiveDevice();
    await prisma.wirelessPollingConfiguration.create({
      data: {
        deviceId: oldId,
        ipAddress: '10.60.0.10',
        enabled: true,
        intervalSecs: 3600,
        deviceType: 'STATION'
      }
    });

    const result = await replaceUseCase.execute(
      request({ id: oldId, deviceModelId: wirelessModelId })
    );

    expect(result.value.wirelessConfigRemoved).toBe(false);
    const configs =
      await prisma.wirelessPollingConfiguration.findMany({
        where: { deviceId: oldId }
      });
    expect(configs).toHaveLength(1);
  });

  // ──────────────────────────────────────────────────────────────
  // Inheritance and replacement fields
  // ──────────────────────────────────────────────────────────────

  it('inherits location, category and owner from the retired unit', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    const newRow = await prisma.device.findUnique({
      where: { id: result.value.newDevice.id }
    });
    expect(newRow!.locationId).toBe(locationId);
    expect(newRow!.category).toBe('WIRELESS_CPE');
    expect(newRow!.owner).toBe('CLIENT');
  });

  it('puts the replacement on the new model', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId, deviceModelId: wiredModelId })
    );

    const newRow = await prisma.device.findUnique({
      where: { id: result.value.newDevice.id }
    });
    expect(newRow!.deviceModelId).toBe(wiredModelId);
  });

  it('commissions a replacement that inherited an address', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId })
    );

    expect(result.value.newDevice.status).toBe('COMMISSIONING');
  });

  // ──────────────────────────────────────────────────────────────
  // Failures
  // ──────────────────────────────────────────────────────────────

  it('fails when the device does not exist (GHOST_ID)', async () => {
    const result = await replaceUseCase.execute(
      request({ id: GHOST_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device not found/i);
  });

  it('[DEV-066] fails when the replacement model does not exist', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId, deviceModelId: GHOST_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/device model not found/i);

    // Nothing may have been retired on the way to discovering this.
    const oldRow = await prisma.device.findUnique({
      where: { id: oldId }
    });
    expect(oldRow!.status).toBe('ACTIVE');
  });

  it('fails with a malformed id', async () => {
    const result = await replaceUseCase.execute(
      request({ id: INVALID_ID })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('[DEV-078] refuses a retiredStatus that is still in service', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({ id: oldId, retiredStatus: 'ACTIVE' })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/must be one of/i);
  });

  it('refuses a replacement with no identifier', async () => {
    const oldId = await createActiveDevice();

    const result = await replaceUseCase.execute(
      request({
        id: oldId,
        serialNumber: undefined,
        macAddress: undefined
      })
    );

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(
      /at least a serial number or MAC address/i
    );
  });
});
