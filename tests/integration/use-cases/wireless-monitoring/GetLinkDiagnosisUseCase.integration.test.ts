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
describe('GetLinkDiagnosisUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let stack: LinkDiagnosisStack;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    stack = buildLinkDiagnosis(
      prisma,
      new SseBroadcaster(new WinstonLogger()),
      {
        ping: new FakePingService(),
        collector: new FakeWirelessCollector()
      }
    );
  });

  afterAll(async () => {
    stack.runner.stopAll();
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    deviceModelId = await seedWirelessDeviceModel(prisma);
  });

  afterEach(() => {
    stack.runner.stopAll();
  });

  it('[WLS-181] returns a started session with its opening samples', async () => {
    const deviceId = await seedDiagnosableDevice(
      prisma,
      deviceModelId,
      {
        ip: '192.168.81.10'
      }
    );
    await stack.start.execute({ deviceId });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await stack.get.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('RUNNING');
    expect(result.value.samples!.ping).toHaveLength(1);
    expect(result.value.samples!.radio).toHaveLength(1);
    expect(result.value.target.name).toBe('CPE-Fake');
  });

  it('fails as not found when no session exists', async () => {
    const result = await stack.get.execute({ deviceId: GHOST_ID });

    expect(result.error).toBe('Diagnosis not found for device');
  });

  it('rejects a malformed id', async () => {
    const result = await stack.get.execute({ deviceId: INVALID_ID });

    expect(result.error).toMatch(/^Invalid device ID/);
  });
});
