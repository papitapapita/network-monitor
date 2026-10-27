import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetAlertByIdUseCase } from 'application/notifications/use-cases/GetAlertByIdUseCase';
import { OutageRollup } from 'application/notifications/shared';
import {
  PrismaAlertRepository,
  PrismaOutageTopologyQuery
} from 'infrastructure/persistence';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedNetworkDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetAlertByIdUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetAlertByIdUseCase;
  let deviceModelId: string;
  let ipCounter = 0;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    const logger = new WinstonLogger();
    const alertRepo = new PrismaAlertRepository(prisma);
    useCase = new GetAlertByIdUseCase(
      alertRepo,
      logger,
      new OutageRollup(
        alertRepo,
        new PrismaOutageTopologyQuery(prisma),
        logger
      )
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  async function device(
    name: string,
    upstreamDeviceId: string | null = null
  ): Promise<string> {
    ipCounter++;
    return seedNetworkDevice(prisma, deviceModelId, {
      name,
      ipAddress: `10.0.5.${ipCounter}`,
      upstreamDeviceId,
      status: 'ACTIVE'
    });
  }

  async function alert(
    deviceId: string,
    causedByAlertId: string | null = null,
    resolvedAt: Date | null = null
  ): Promise<string> {
    const row = await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        type: 'device_unreachable',
        causedByAlertId,
        resolvedAt
      }
    });
    return row.id;
  }

  it('returns a plain alert with an empty affected list', async () => {
    const id = await alert(await device('Solo'));

    const result = await useCase.execute({ id });

    expect(result.value).toMatchObject({
      id,
      causedByAlertId: null,
      affectedDevices: []
    });
  });

  it('[NOT-243] names each affected device and the affected device it hangs from', async () => {
    const sw = await device('Switch Sur');
    const ap = await device('AP Sur', sw);
    const cpe = await device('Cliente Diaz', ap);
    const behindUnaffected = await device(
      'Cliente Rojas',
      await device('AP Arriba', sw)
    );
    const root = await alert(sw);
    await alert(ap, root);
    await alert(cpe, root, new Date());
    await alert(behindUnaffected, root);

    const result = await useCase.execute({ id: root });

    const byName = Object.fromEntries(
      result.value.affectedDevices!.map((d) => [d.name, d])
    );
    expect(Object.keys(byName).sort()).toEqual([
      'AP Sur',
      'Cliente Diaz',
      'Cliente Rojas'
    ]);
    expect(byName['AP Sur']).toMatchObject({
      status: 'DOWN',
      viaDeviceId: null
    });
    expect(byName['Cliente Diaz']).toMatchObject({
      status: 'UP',
      viaDeviceId: ap,
      viaDeviceName: 'AP Sur'
    });
    expect(byName['Cliente Rojas'].viaDeviceId).toBeNull();
  });

  it('still names a device moved elsewhere since the outage began', async () => {
    const root = await device('AP Norte');
    const other = await device('AP Otro');
    const moved = await device('Cliente Movido', other);
    const rootAlert = await alert(root);
    await alert(moved, rootAlert);

    const result = await useCase.execute({ id: rootAlert });

    expect(result.value.affectedDevices).toEqual([
      expect.objectContaining({
        name: 'Cliente Movido',
        viaDeviceId: null
      })
    ]);
  });

  it('detaches the affected alerts when the root alert is deleted', async () => {
    const root = await device('AP Norte');
    const rootAlert = await alert(root);
    const childAlert = await alert(
      await device('Cliente', root),
      rootAlert
    );

    await prisma.alertEvent.delete({ where: { id: rootAlert } });

    const result = await useCase.execute({ id: childAlert });
    expect(result.value.causedByAlertId).toBeNull();
  });

  it('fails for an alert that does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('not found');
  });

  it('fails for a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
  });
});
