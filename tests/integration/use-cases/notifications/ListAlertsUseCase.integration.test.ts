import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAlertsUseCase } from 'application/notifications/use-cases/ListAlertsUseCase';
import { PrismaAlertListQuery } from 'infrastructure/persistence/PrismaAlertListQuery';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  cleanDatabase,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice,
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('ListAlertsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: ListAlertsUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);

    useCase = new ListAlertsUseCase(
      new PrismaAlertListQuery(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  // ──────────────────────────────────────────────────────────────
  // Listing all alerts
  // ──────────────────────────────────────────────────────────────

  it('returns an empty list when no alerts exist', async () => {
    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(0);
    expect(result.value.total).toBe(0);
    expect(result.value.hasMore).toBe(false);
  });

  it('returns all alerts ordered newest-first', async () => {
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        startedAt: new Date('2025-06-01T08:00:00Z')
      }
    });
    await prisma.alertEvent.create({
      data: {
        deviceId,
        severity: 'CRITICAL',
        startedAt: new Date('2025-06-01T10:00:00Z')
      }
    });

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(2);
    const [first, second] = result.value.alerts;
    expect(
      new Date(first.startedAt) >= new Date(second.startedAt)
    ).toBe(true);
  });

  it('returns correct DTO shape for an open alert', async () => {
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });

    const result = await useCase.execute({});

    const alert = result.value.alerts[0];
    expect(alert.status).toBe('OPEN');
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.deviceId).toBe(deviceId);
    expect(alert.resolvedAt).toBeNull();
    expect(alert.notifiedAt).toBeNull();
    expect(alert.recoveryNotifiedAt).toBeNull();
    expect(alert.durationSecs).toBeNull();
  });

  it('returns correct DTO shape for a resolved alert', async () => {
    const startedAt = new Date('2025-06-01T10:00:00Z');
    const resolvedAt = new Date('2025-06-01T11:00:00Z');
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL', startedAt, resolvedAt }
    });

    const result = await useCase.execute({});

    const alert = result.value.alerts[0];
    expect(alert.status).toBe('RESOLVED');
    expect(alert.resolvedAt).not.toBeNull();
    expect(alert.durationSecs).toBe(3600);
  });

  // ──────────────────────────────────────────────────────────────
  // Filtering by deviceId
  // ──────────────────────────────────────────────────────────────

  it('returns only alerts belonging to the specified device', async () => {
    const other = await seedMonitoredDevice(
      prisma,
      deviceModelId,
      '10.0.0.1'
    );

    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL' }
    });
    await prisma.alertEvent.create({
      data: { deviceId: other.deviceId, severity: 'CRITICAL' }
    });

    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(1);
    expect(result.value.alerts[0].deviceId).toBe(deviceId);
  });

  it('returns empty list when device has no alerts', async () => {
    const result = await useCase.execute({ deviceId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(0);
  });

  it('fails when deviceId filter is not a valid UUID', async () => {
    const result = await useCase.execute({ deviceId: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/invalid device id/i);
  });

  it('returns empty list when filtering by a ghost deviceId', async () => {
    const result = await useCase.execute({ deviceId: GHOST_ID });

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────
  // Pagination
  // ──────────────────────────────────────────────────────────────

  it('respects limit parameter', async () => {
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        prisma.alertEvent.create({
          data: { deviceId, severity: 'CRITICAL' }
        })
      )
    );

    const result = await useCase.execute({ limit: 3 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(3);
    expect(result.value.limit).toBe(3);
  });

  it('respects offset parameter', async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.alertEvent.create({
        data: {
          deviceId,
          severity: 'CRITICAL',
          startedAt: new Date(Date.now() + i * 1000)
        }
      });
    }

    const page1 = await useCase.execute({ limit: 2, offset: 0 });
    const page2 = await useCase.execute({ limit: 2, offset: 2 });

    expect(page1.value.alerts).toHaveLength(2);
    expect(page2.value.alerts).toHaveLength(2);

    const page1Ids = page1.value.alerts.map((a) => a.id);
    const page2Ids = page2.value.alerts.map((a) => a.id);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });

  it('returns correct limit and offset in the response envelope', async () => {
    await Promise.all(
      Array.from({ length: 3 }).map(() =>
        prisma.alertEvent.create({
          data: { deviceId, severity: 'CRITICAL' }
        })
      )
    );

    const result = await useCase.execute({ limit: 2, offset: 1 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.limit).toBe(2);
    expect(result.value.offset).toBe(1);
  });

  it('[NOT-134] reports the full total and hasMore across pages', async () => {
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        prisma.alertEvent.create({
          data: { deviceId, severity: 'CRITICAL' }
        })
      )
    );

    const page1 = await useCase.execute({ limit: 2, offset: 0 });
    const last = await useCase.execute({ limit: 2, offset: 4 });

    expect(page1.value.total).toBe(5);
    expect(page1.value.hasMore).toBe(true);
    expect(last.value.total).toBe(5);
    expect(last.value.hasMore).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────
  // Filters and device name
  // ──────────────────────────────────────────────────────────────

  describe('[NOT-135] status, severity and device name', () => {
    beforeEach(async () => {
      await prisma.alertEvent.createMany({
        data: [
          { deviceId, severity: 'CRITICAL', type: 'open_critical' },
          { deviceId, severity: 'WARNING', type: 'open_warning' },
          {
            deviceId,
            severity: 'CRITICAL',
            type: 'resolved_critical',
            resolvedAt: new Date()
          }
        ]
      });
    });

    it('status=OPEN returns only unresolved alerts, with a matching total', async () => {
      const result = await useCase.execute({ status: 'OPEN' });

      expect(result.value.total).toBe(2);
      expect(
        result.value.alerts.every((a) => a.status === 'OPEN')
      ).toBe(true);
    });

    it('status=RESOLVED returns only resolved alerts', async () => {
      const result = await useCase.execute({ status: 'RESOLVED' });

      expect(result.value.alerts.map((a) => a.type)).toEqual([
        'resolved_critical'
      ]);
    });

    it('combines status and severity', async () => {
      const result = await useCase.execute({
        status: 'OPEN',
        severity: 'CRITICAL'
      });

      expect(result.value.total).toBe(1);
      expect(result.value.alerts[0].type).toBe('open_critical');
    });

    it('carries the current device name on every alert', async () => {
      await prisma.device.update({
        where: { id: deviceId },
        data: { name: 'Renamed Router' }
      });

      const result = await useCase.execute({});

      expect(result.value.alerts).toHaveLength(3);
      expect(
        result.value.alerts.every(
          (a) => a.deviceName === 'Renamed Router'
        )
      ).toBe(true);
    });

    it('rejects an unknown status', async () => {
      const result = await useCase.execute({ status: 'CLOSED' });

      expect(result.isFailure).toBe(true);
    });
  });
});
