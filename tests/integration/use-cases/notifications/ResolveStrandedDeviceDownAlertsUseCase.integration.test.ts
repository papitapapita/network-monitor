import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ResolveStrandedDeviceDownAlertsUseCase } from 'application/notifications/use-cases/ResolveStrandedDeviceDownAlertsUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence';
import { PrismaDeviceStateRepository } from 'infrastructure/persistence/PrismaDeviceStateRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { AlertId, DeviceId } from 'domain/shared/ids';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000);
const daysAgo = (days: number) => minutesAgo(days * 24 * 60);

describe('[NOT-229] ResolveStrandedDeviceDownAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let alertRepo: PrismaAlertRepository;
  let useCase: ResolveStrandedDeviceDownAlertsUseCase;
  let deviceModelId: string;
  let ipCounter = 0;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    alertRepo = new PrismaAlertRepository(prisma);
    useCase = new ResolveStrandedDeviceDownAlertsUseCase(
      alertRepo,
      new PrismaDeviceStateRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.alertEvent.deleteMany();
    await cleanDatabase(prisma);
  });

  async function seedDevice(
    state: { status: 'UP' | 'DOWN'; lastSeen: Date | null } | null
  ): Promise<string> {
    ipCounter++;
    const { deviceId } = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      `192.168.97.${ipCounter}`
    );
    if (state) {
      await prisma.deviceState.create({
        data: {
          deviceId,
          status: state.status,
          lastSeen: state.lastSeen,
          lastCheckedAt: minutesAgo(1),
          consecutiveFailures: state.status === 'DOWN' ? 3 : 0,
          downSince: state.status === 'DOWN' ? daysAgo(3) : null
        }
      });
    }
    return deviceId;
  }

  async function seedOpenAlert(
    deviceId: string,
    type = 'device_unreachable'
  ): Promise<string> {
    const alert = await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        source: 'Disponibilidad',
        type,
        description: 'Sin conexión.',
        startedAt: daysAgo(3),
        notifiedAt: daysAgo(3)
      }
    });
    return alert.id;
  }

  it('closes a down alert left open for a device that has answered since', async () => {
    const deviceId = await seedDevice({
      status: 'UP',
      lastSeen: minutesAgo(1)
    });
    const alertId = await seedOpenAlert(deviceId);

    const result = await useCase.execute();

    expect(result.value).toBe(1);
    const row = await prisma.alertEvent.findUniqueOrThrow({
      where: { id: alertId }
    });
    expect(row.resolvedAt).not.toBeNull();
    expect(row.recoveryNotifiedAt).toBeNull();
  });

  it('lets the next outage open a fresh alert instead of reusing the stranded one', async () => {
    const deviceId = await seedDevice({
      status: 'UP',
      lastSeen: minutesAgo(1)
    });
    await seedOpenAlert(deviceId);

    await useCase.execute();

    const open = await alertRepo.findOpenByDeviceAndType(
      DeviceId.parse(deviceId).value,
      'device_unreachable'
    );
    expect(open.value).toBeNull();
  });

  it('leaves the alert of a device that is still down', async () => {
    const deviceId = await seedDevice({
      status: 'DOWN',
      lastSeen: daysAgo(4)
    });
    const alertId = await seedOpenAlert(deviceId);

    const result = await useCase.execute();

    expect(result.value).toBe(0);
    const row = await prisma.alertEvent.findUniqueOrThrow({
      where: { id: alertId }
    });
    expect(row.resolvedAt).toBeNull();
  });

  it('leaves the alert of a device with no state yet', async () => {
    const deviceId = await seedDevice(null);
    await seedOpenAlert(deviceId);

    expect((await useCase.execute()).value).toBe(0);
  });

  it('leaves alerts of other types alone', async () => {
    const deviceId = await seedDevice({
      status: 'UP',
      lastSeen: minutesAgo(1)
    });
    const alertId = await seedOpenAlert(deviceId, 'backup_failing');

    await useCase.execute();

    const row = await prisma.alertEvent.findUniqueOrThrow({
      where: { id: alertId }
    });
    expect(row.resolvedAt).toBeNull();
  });

  it('a stale copy saved after the alert was resolved does not reopen it', async () => {
    const deviceId = await seedDevice({
      status: 'DOWN',
      lastSeen: daysAgo(4)
    });
    const alertId = await seedOpenAlert(deviceId);
    const id = AlertId.parse(alertId).value;

    const scanCopy = (await alertRepo.findById(id)).value!;
    const recoveryCopy = (await alertRepo.findById(id)).value!;
    recoveryCopy.resolve(new Date());
    await alertRepo.save(recoveryCopy);
    await alertRepo.save(scanCopy);

    const row = await prisma.alertEvent.findUniqueOrThrow({
      where: { id: alertId }
    });
    expect(row.resolvedAt).not.toBeNull();
  });
});
