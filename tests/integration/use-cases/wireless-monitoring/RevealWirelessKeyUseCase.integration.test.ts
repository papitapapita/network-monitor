// Source: src/application/wireless-monitoring/use-cases/RevealWirelessKeyUseCase.ts

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
import {
  AP_CONFIG,
  buildRadioSettings
} from '../../helpers/radioSettings';

describe('RevealWirelessKeyUseCase (integration)', () => {
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

  const seedAp = (
    opts: { withCredentials?: boolean; withConfig?: boolean } = {}
  ) =>
    seedDiagnosableDevice(prisma, deviceModelId, {
      ip: '10.0.0.10',
      deviceType: 'ACCESS_POINT',
      ...opts
    });

  const reveal = (deviceId: string, serverOnSite = true) =>
    buildRadioSettings(prisma, radio, agent, {
      serverOnSite
    }).reveal.execute({
      deviceId,
      revealedBy: 'user-1'
    });

  it('[WLS-220] reads the key live from the radio, with its stored login', async () => {
    const deviceId = await seedAp();
    radio.config = Result.ok(AP_CONFIG);

    const result = await reveal(deviceId);

    expect(result.value).toMatchObject({
      deviceId,
      role: 'ACCESS_POINT',
      ssid: 'AP NORTE 1',
      security: 'WPA_PSK',
      key: 'clave-del-ap'
    });
    expect(radio.reads).toEqual([
      { ip: '10.0.0.10', port: 443, username: 'ubnt' }
    ]);
  });

  it('[WLS-225] off site, reads through the agent the radio sits behind', async () => {
    const deviceId = await seedAp();
    const seeded = await seedAgent(prisma, { status: 'ACTIVE' });
    await prisma.device.update({
      where: { id: deviceId },
      data: { agentId: seeded.id }
    });
    agent.config = { ok: true, value: AP_CONFIG };

    const result = await reveal(deviceId, false);

    expect(result.value?.key).toBe('clave-del-ap');
    expect(agent.calls).toEqual([
      {
        agentId: seeded.id,
        target: {
          ipAddress: '10.0.0.10',
          vendor: 'ubiquiti',
          deviceType: 'ACCESS_POINT',
          login: {
            username: 'ubnt',
            password: 'secret',
            httpPort: 443,
            sshPort: 22
          }
        }
      }
    ]);
    expect(radio.reads).toHaveLength(0);
  });

  it('[WLS-225] off site, refuses a radio with no agent', async () => {
    const deviceId = await seedAp();

    const result = await reveal(deviceId, false);

    expect(result.error).toContain(
      'this server is not on the monitored network'
    );
    expect(agent.calls).toHaveLength(0);
  });

  it('fails when the device has no HTTP login', async () => {
    const deviceId = await seedAp({ withCredentials: false });

    const result = await reveal(deviceId);

    expect(result.error).toContain('HTTP credentials not configured');
    expect(radio.reads).toHaveLength(0);
  });

  it('fails when the device has no wireless config', async () => {
    const deviceId = await seedAp({ withConfig: false });

    const result = await reveal(deviceId);

    expect(result.error).toContain(
      'No wireless polling configuration found'
    );
  });

  it('passes on what the radio said when it cannot be read', async () => {
    const deviceId = await seedAp();
    radio.config = Result.fail('Authentication failed: HTTP 401');

    const result = await reveal(deviceId);

    expect(result.error).toContain('Authentication failed: HTTP 401');
  });

  it('fails for a device that does not exist', async () => {
    const result = await reveal(GHOST_ID);

    expect(result.isFailure).toBe(true);
    expect(radio.reads).toHaveLength(0);
  });

  it('fails for a malformed id', async () => {
    const result = await reveal(INVALID_ID);

    expect(result.error).toContain('Invalid device ID');
  });
});
