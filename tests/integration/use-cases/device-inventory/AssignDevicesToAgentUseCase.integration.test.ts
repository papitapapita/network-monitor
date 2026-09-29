import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AssignDevicesToAgentUseCase } from 'application/device-inventory/use-cases/AssignDevicesToAgentUseCase';
import { AgentAssignmentPolicy } from 'application/device-inventory/services';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { PrismaAgentAssignmentQuery } from 'infrastructure/probe-agents/queries';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanAgents,
  cleanDatabase,
  seedAgent,
  seedDeviceModel,
  seedMonitoredDevice,
  seedLocation,
  GHOST_ID
} from '../../helpers/db';

describe('AssignDevicesToAgentUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AssignDevicesToAgentUseCase;
  let deviceModelId: string;
  let locationId: string;
  let ipSuffix = 10;

  const seedDevice = async (agentId: string | null = null) => {
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      `192.168.77.${ipSuffix++}`
    );
    // seedMonitoredDevice makes an ACTIVE device with no location, which the
    // aggregate's whole-state check (DEV-169) would refuse to move.
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId, locationId }
    });
    return deviceId;
  };
  const agentOf = async (deviceId: string) =>
    (await prisma.device.findUnique({ where: { id: deviceId } }))!
      .agentId;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    useCase = new AssignDevicesToAgentUseCase(
      new PrismaDeviceRepository(prisma),
      new AgentAssignmentPolicy(
        new PrismaAgentAssignmentQuery(prisma)
      ),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    locationId = await seedLocation(prisma);
  });

  it('[DEV-168] persists the agent on the named devices only', async () => {
    const { id: agentId } = await seedAgent(prisma, {
      status: 'ACTIVE'
    });
    const named = await seedDevice();
    const other = await seedDevice();

    const result = await useCase.execute({
      agentId,
      deviceIds: [named]
    });

    expect(result.value).toEqual({ assigned: [named], failed: [] });
    expect(await agentOf(named)).toBe(agentId);
    expect(await agentOf(other)).toBeNull();
  });

  it('[DEV-168] migrates every in-process device in one call', async () => {
    const { id: agentId } = await seedAgent(prisma);
    const { id: otherAgent } = await seedAgent(prisma);
    const a = await seedDevice();
    const b = await seedDevice();
    const behindOther = await seedDevice(otherAgent);

    const result = await useCase.execute({
      agentId,
      fromAgentId: null
    });

    expect(result.value.assigned.sort()).toEqual([a, b].sort());
    expect(await agentOf(behindOther)).toBe(otherAgent);
  });

  it('[DEV-168] leaves soft-deleted devices where they are', async () => {
    const { id: agentId } = await seedAgent(prisma);
    const deleted = await seedDevice();
    await prisma.device.update({
      where: { id: deleted },
      data: { deletedAt: new Date() }
    });

    const result = await useCase.execute({
      agentId,
      fromAgentId: null
    });

    expect(result.value.assigned).toEqual([]);
    expect(await agentOf(deleted)).toBeNull();
  });

  it('[DEV-168] moves devices off a revoked agent onto its replacement', async () => {
    const { id: oldAgent } = await seedAgent(prisma, {
      status: 'REVOKED'
    });
    const { id: newAgent } = await seedAgent(prisma, {
      status: 'ACTIVE'
    });
    const device = await seedDevice(oldAgent);

    await useCase.execute({
      agentId: newAgent,
      fromAgentId: oldAgent
    });

    expect(await agentOf(device)).toBe(newAgent);
  });

  it('[DEV-168] sends devices back to in-process polling', async () => {
    const { id: agentId } = await seedAgent(prisma);
    const device = await seedDevice(agentId);

    await useCase.execute({ agentId: null, fromAgentId: agentId });

    expect(await agentOf(device)).toBeNull();
  });

  it('[DEV-165] refuses a revoked target and writes nothing', async () => {
    const { id: revoked } = await seedAgent(prisma, {
      status: 'REVOKED'
    });
    const device = await seedDevice();

    const result = await useCase.execute({
      agentId: revoked,
      deviceIds: [device]
    });

    expect(result.error).toContain('is revoked');
    expect(await agentOf(device)).toBeNull();
  });

  it('fails for an unknown target agent', async () => {
    const result = await useCase.execute({
      agentId: GHOST_ID,
      fromAgentId: null
    });

    expect(result.error).toContain('Agent not found');
  });

  it('[DEV-169] reports a device whose other data breaks a rule, and moves the rest', async () => {
    const { id: agentId } = await seedAgent(prisma);
    const broken = await seedDevice();
    await prisma.device.update({
      where: { id: broken },
      data: { locationId: null }
    });
    const fine = await seedDevice();

    const result = await useCase.execute({
      agentId,
      fromAgentId: null
    });

    expect(result.value.assigned).toEqual([fine]);
    expect(result.value.failed).toEqual([
      {
        id: broken,
        error: 'An ACTIVE device must have a location assigned'
      }
    ]);
  });

  it('reports an unknown device and moves the rest', async () => {
    const { id: agentId } = await seedAgent(prisma);
    const device = await seedDevice();

    const result = await useCase.execute({
      agentId,
      deviceIds: [GHOST_ID, device]
    });

    expect(result.value.assigned).toEqual([device]);
    expect(result.value.failed).toEqual([
      { id: GHOST_ID, error: `Device not found: ${GHOST_ID}` }
    ]);
  });
});
