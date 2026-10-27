// Source: src/application/wireless-monitoring/use-cases/RenameRadioUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  cleanAgents,
  cleanDatabase,
  createTestPrisma,
  GHOST_ID,
  INVALID_ID,
  seedAgent,
  seedWirelessDeviceModel
} from '../../helpers/db';
import { seedDiagnosableDevice } from '../../helpers/linkDiagnosis';
import {
  FakeAgentRadioSettings,
  FakeRadio
} from '../../helpers/FakeRadio';
import { buildRadioSettings } from '../../helpers/radioSettings';

describe('RenameRadioUseCase (integration)', () => {
  let prisma: PrismaClient;
  let deviceModelId: string;
  const radio = new FakeRadio();
  const agent = new FakeAgentRadioSettings();

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    radio.reset();
    agent.reset();
    await cleanAgents(prisma);
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  const seedStation = () =>
    seedDiagnosableDevice(prisma, deviceModelId, { ip: '10.0.0.20' });

  const rename = (
    deviceId: string,
    hostname: string,
    serverOnSite = true
  ) =>
    buildRadioSettings(prisma, radio, agent, {
      serverOnSite
    }).rename.execute({
      deviceId,
      hostname,
      renamedBy: 'user-1'
    });

  it('[WLS-224] writes the name to the radio over its SSH login', async () => {
    const deviceId = await seedStation();

    const result = await rename(deviceId, ' STA Cliente 7 ');

    expect(result.value).toMatchObject({
      deviceId,
      hostname: 'STA Cliente 7'
    });
    expect(radio.renames).toEqual([
      {
        ip: '10.0.0.20',
        login: {
          username: 'ubnt',
          password: 'secret',
          httpPort: 443,
          sshPort: 22
        },
        hostname: 'STA Cliente 7'
      }
    ]);
  });

  it("[WLS-224] leaves the device's inventory name alone", async () => {
    const deviceId = await seedStation();

    await rename(deviceId, 'STA Cliente 7');

    const device = await prisma.device.findUniqueOrThrow({
      where: { id: deviceId }
    });
    expect(device.name).toBe('Radio 10.0.0.20');
  });

  it('[WLS-223] refuses a name AirOS cannot take, without reaching the radio', async () => {
    const deviceId = await seedStation();

    const result = await rename(deviceId, 'Estación Peña');

    expect(result.error).toContain('must be letters');
    expect(radio.renames).toHaveLength(0);
  });

  it('[AGT-120] off site, renames through the agent the radio sits behind', async () => {
    const deviceId = await seedStation();
    const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: seeded.id }
    });
    agent.rename = { ok: true, value: undefined };

    const result = await rename(deviceId, 'STA Cliente 7', false);

    expect(result.isSuccess).toBe(true);
    expect(agent.calls).toMatchObject([
      { agentId: seeded.id, hostname: 'STA Cliente 7' }
    ]);
    expect(radio.renames).toHaveLength(0);
  });

  it('[AGT-120] names an agent too old to rename', async () => {
    const deviceId = await seedStation();
    const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: seeded.id }
    });
    agent.rename = {
      ok: false,
      reason: 'PROBE_UNSUPPORTED',
      error: 'The agent must be updated to rename radios'
    };

    const result = await rename(deviceId, 'STA Cliente 7', false);

    expect(result.error).toContain(
      'its on-site agent must be updated first'
    );
  });

  it('passes on what the radio said when it refused', async () => {
    const deviceId = await seedStation();
    radio.rename = Result.fail('SSH connection refused on port 22');

    const result = await rename(deviceId, 'STA Cliente 7');

    expect(result.error).toContain(
      'SSH connection refused on port 22'
    );
  });

  it('fails for a device that does not exist', async () => {
    const result = await rename(GHOST_ID, 'STA Cliente 7');

    expect(result.isFailure).toBe(true);
    expect(radio.renames).toHaveLength(0);
  });

  it('fails for a malformed id', async () => {
    const result = await rename(INVALID_ID, 'STA Cliente 7');

    expect(result.error).toContain('Invalid device ID');
  });
});
