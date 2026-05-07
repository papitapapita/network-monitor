import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListAlertsUseCase } from 'application/notifications/use-cases/ListAlertsUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
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

    const alertRepo = new PrismaAlertRepository(prisma);
    const logger = new WinstonLogger();
    useCase = new ListAlertsUseCase(alertRepo, logger);
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
      data: { deviceId, severity: 'CRITICAL', startedAt: new Date('2025-06-01T08:00:00Z') }
    });
    await prisma.alertEvent.create({
      data: { deviceId, severity: 'CRITICAL', startedAt: new Date('2025-06-01T10:00:00Z') }
    });

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.alerts).toHaveLength(2);
    const [first, second] = result.value.alerts;
    expect(new Date(first.startedAt) >= new Date(second.startedAt)).toBe(true);
  });

  it('returns correct DTO shape for an open alert', async () => {
    await prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } });

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
      data: { deviceId, severity: 'CRITICAL', startedAt, resolvedAt, durationSecs: 3600 }
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
    const other = await seedMonitoredDevice(prisma, deviceModelId, '10.0.0.1');

    await prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } });
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
        prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } })
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
        prisma.alertEvent.create({ data: { deviceId, severity: 'CRITICAL' } })
      )
    );

    const result = await useCase.execute({ limit: 2, offset: 1 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.limit).toBe(2);
    expect(result.value.offset).toBe(1);
  });
});
