import { PrismaClient } from '../../../../src/generated/prisma/client';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { SseBroadcaster } from 'infrastructure/realtime/SseBroadcaster';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  seedWirelessDeviceModel,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';
import { FakePingService } from '../../helpers/FakePingService';
import { FakeWirelessCollector } from '../../helpers/FakeWirelessCollector';
import {
  buildLinkDiagnosis,
  seedDiagnosableDevice,
  LinkDiagnosisStack
} from '../../helpers/linkDiagnosis';

// Thin: sessions live in the runner, not the database.
describe('StopLinkDiagnosisUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let stack: LinkDiagnosisStack;
  let deviceModelId: string;
  const collector = new FakeWirelessCollector();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    stack = buildLinkDiagnosis(
      prisma,
      new SseBroadcaster(new WinstonLogger()),
      { ping: new FakePingService(), collector }
    );
  });

  afterAll(async () => {
    stack.runner.stopAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    collector.reset();
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  afterEach(() => {
    stack.runner.stopAll();
  });

  it('[WLS-181] stops a running session and keeps it readable', async () => {
    const deviceId = await seedDiagnosableDevice(
      prisma,
      deviceModelId,
      {
        ip: '192.168.82.10'
      }
    );
    await stack.start.execute({ deviceId });

    const result = await stack.stop.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('STOPPED');
    expect((await stack.get.execute({ deviceId })).value.status).toBe(
      'STOPPED'
    );
  });

  it('lets a new session start after a stop', async () => {
    const deviceId = await seedDiagnosableDevice(
      prisma,
      deviceModelId,
      {
        ip: '192.168.82.11'
      }
    );
    await stack.start.execute({ deviceId });
    await stack.stop.execute({ deviceId });

    const restarted = await stack.start.execute({ deviceId });

    expect(restarted.value.started).toBe(true);
  });

  it('fails as not found when nothing is running', async () => {
    const result = await stack.stop.execute({ deviceId: GHOST_ID });

    expect(result.error).toBe(
      'Running diagnosis not found for device'
    );
  });

  it('rejects a malformed id', async () => {
    const result = await stack.stop.execute({ deviceId: INVALID_ID });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
