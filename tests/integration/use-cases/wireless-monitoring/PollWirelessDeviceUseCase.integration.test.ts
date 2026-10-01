import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PollWirelessDeviceUseCase } from 'application/wireless-monitoring/use-cases';
import { OUT_OF_SERVER_REACH } from 'application/wireless-monitoring/interfaces';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { WirelessAlertEvaluator } from 'domain/wireless-monitoring/services';
import {
  PrismaWirelessAlertRecordRepository,
  PrismaWirelessDeviceConfigRepository,
  PrismaWirelessSnapshotRepository
} from 'infrastructure/wireless-monitoring/repositories';
import { WirelessDeviceRepositoryAdapter } from 'infrastructure/wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { DeviceReachAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceReachAdapter';
import { DeviceVendorAdapter } from 'infrastructure/wireless-monitoring/adapters/DeviceVendorAdapter';
import { ContractedCapacityAdapter } from 'infrastructure/wireless-monitoring/adapters/ContractedCapacityAdapter';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
import { PrismaVendorRepository } from 'infrastructure/persistence/PrismaVendorRepository';
import { PrismaDeviceCredentialsRepository } from 'infrastructure/persistence/PrismaDeviceCredentialsRepository';
import {
  PrismaContractedServiceRepository,
  PrismaServicePlanRepository
} from 'infrastructure/customers';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  seedAgent,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { FakeWirelessCollector } from '../../helpers/FakeWirelessCollector';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';

// Covers where this server's reach decides what it polls (WLS-029): the
// scheduler's due query and the manual poll, against the real device rows.
// The radio itself is a fake.
describe('PollWirelessDeviceUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let deviceModelId: string;
  const collector = new FakeWirelessCollector();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    collector.reset();
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  const build = (serverOnSite: boolean) => {
    const deviceRepo = new PrismaDeviceRepository(prisma);
    const configRepo = new PrismaWirelessDeviceConfigRepository(
      prisma,
      serverOnSite
    );
    const useCase = new PollWirelessDeviceUseCase(
      configRepo,
      new PrismaWirelessSnapshotRepository(prisma),
      new PrismaWirelessAlertRecordRepository(prisma),
      new PrismaDeviceCredentialsRepository(prisma),
      collector,
      new DeviceVendorAdapter(
        deviceRepo,
        new PrismaDeviceModelRepository(prisma),
        new PrismaVendorRepository(prisma)
      ),
      new WirelessAlertEvaluator([]),
      new WirelessDeviceRepositoryAdapter(
        deviceRepo,
        new DeviceEligibilityService()
      ),
      new DeviceReachAdapter(serverOnSite),
      new ContractedCapacityAdapter(
        new PrismaContractedServiceRepository(prisma),
        new PrismaServicePlanRepository(prisma)
      ),
      null,
      new WinstonLogger()
    );
    return { useCase, configRepo };
  };

  const seedRadio = (ip: string) =>
    seedDiagnosableDevice(prisma, deviceModelId, { ip });

  const seedRadioBehindAgent = async (ip: string) => {
    const deviceId = await seedRadio(ip);
    const agent = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: agent.id }
    });
    return deviceId;
  };

  const dueIds = async (
    configRepo: PrismaWirelessDeviceConfigRepository
  ) => {
    const due = await configRepo.findAllDue(new Date());
    return due.value.map((c) => c.deviceId.toString());
  };

  describe('[WLS-029] a server hosted off site', () => {
    it('leaves every device out of the scheduled polling, with or without an agent', async () => {
      await seedRadioBehindAgent('192.168.90.10');
      await seedRadio('192.168.90.11');
      const { configRepo } = build(false);

      expect(await dueIds(configRepo)).toEqual([]);
    });

    it('refuses a manual poll of a device behind an agent', async () => {
      const deviceId = await seedRadioBehindAgent('192.168.90.12');
      const { useCase } = build(false);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toBe(
        `Cannot poll device — ${OUT_OF_SERVER_REACH}`
      );
      expect(collector.calls).toHaveLength(0);
    });

    it('refuses a manual poll of a device with no agent too', async () => {
      const deviceId = await seedRadio('192.168.90.13');
      const { useCase } = build(false);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.error).toBe(
        `Cannot poll device — ${OUT_OF_SERVER_REACH}`
      );
      expect(collector.calls).toHaveLength(0);
    });
  });

  describe('[WLS-029] a server on the monitored network', () => {
    it('keeps every device in the scheduled polling, with or without an agent', async () => {
      const behindAgent = await seedRadioBehindAgent('192.168.90.20');
      const direct = await seedRadio('192.168.90.22');
      const { configRepo } = build(true);

      const due = await dueIds(configRepo);

      expect(due).toContain(behindAgent);
      expect(due).toContain(direct);
    });

    it('polls a device behind an agent on demand', async () => {
      const deviceId = await seedRadioBehindAgent('192.168.90.21');
      const { useCase } = build(true);

      const result = await useCase.execute({
        deviceId,
        forceExecution: true
      });

      expect(result.isSuccess).toBe(true);
      expect(collector.calls).toHaveLength(1);
    });
  });
});
