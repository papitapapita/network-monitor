import { PrismaClient } from '../../../../src/generated/prisma/client';
import { OpenAlertUseCase } from 'application/notifications/use-cases/OpenAlertUseCase';
import { ResolveAlertUseCase } from 'application/notifications/use-cases/ResolveAlertUseCase';
import { PrismaAlertRepository } from 'infrastructure/persistence/PrismaAlertRepository';
import { PrismaDeviceRepository } from 'infrastructure/persistence/PrismaDeviceRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import { AlertSeverity } from 'domain/shared/enums';
import { PrismaNotificationSettingsRepository } from 'infrastructure/persistence/PrismaNotificationSettingsRepository';
import { TicketModeGatedOpener } from 'infrastructure/notifications/TicketModeGatedOpener';
import {
  CustomerDirectoryAdapter,
  DeviceDirectoryAdapter,
  TicketOpenerAdapter
} from 'infrastructure/tickets/adapters';
import { PrismaTicketRepository } from 'infrastructure/tickets/repositories';
import { OpenTicketFromAlertUseCase } from 'application/tickets/use-cases';
import { NotificationSettings } from 'domain/notifications/value-objects';
import {
  cleanDatabase,
  cleanTickets,
  createTestPrisma,
  seedDeviceModel,
  seedMonitoredDevice
} from '../../helpers/db';

describe('Unified alert recording — integration', () => {
  let prisma: PrismaClient;
  let openAlert: OpenAlertUseCase;
  let resolveAlert: ResolveAlertUseCase;
  let deviceModelId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    const repo = new PrismaAlertRepository(prisma);
    const logger = new WinstonLogger();
    openAlert = new OpenAlertUseCase(
      repo,
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
      logger
    );
    resolveAlert = new ResolveAlertUseCase(repo, logger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  function wirelessInput(
    type: string,
    details: Record<string, unknown>
  ) {
    return {
      deviceId,
      severity: AlertSeverity.CRITICAL,
      source: 'Enlace inalámbrico',
      type,
      description: 'Señal crítica',
      details
    };
  }

  it('persists a wireless alert with its details into the shared list', async () => {
    await openAlert.execute(
      wirelessInput('wireless:signal_rx_dbm:CRITICAL', {
        metric: 'signal_rx_dbm',
        threshold: -80,
        currentValue: -83
      })
    );

    const row = await prisma.alertEvent.findFirst({
      where: { deviceId }
    });
    expect(row).not.toBeNull();
    expect(row!.source).toBe('Enlace inalámbrico');
    expect(row!.type).toBe('wireless:signal_rx_dbm:CRITICAL');
    expect(row!.details).toMatchObject({
      metric: 'signal_rx_dbm',
      currentValue: -83
    });
  });

  it('is idempotent per (device, type) — re-opening does not duplicate', async () => {
    const input = wirelessInput('wireless:signal_rx_dbm:CRITICAL', {
      metric: 'signal_rx_dbm'
    });
    await openAlert.execute(input);
    await openAlert.execute(input);

    const rows = await prisma.alertEvent.findMany({
      where: { deviceId }
    });
    expect(rows).toHaveLength(1);
  });

  it('lets a device hold several open alerts of different types at once', async () => {
    await openAlert.execute(
      wirelessInput('wireless:signal_rx_dbm:CRITICAL', {
        metric: 'signal_rx_dbm'
      })
    );
    await openAlert.execute(
      wirelessInput('wireless:throughput:WARNING', {
        metric: 'throughput'
      })
    );

    const open = await prisma.alertEvent.findMany({
      where: { deviceId, resolvedAt: null }
    });
    expect(open).toHaveLength(2);
    expect(open.map((r) => r.type).sort()).toEqual([
      'wireless:signal_rx_dbm:CRITICAL',
      'wireless:throughput:WARNING'
    ]);
  });

  it('resolves only the matching type, leaving the other open', async () => {
    await openAlert.execute(
      wirelessInput('wireless:signal_rx_dbm:CRITICAL', {
        metric: 'signal_rx_dbm'
      })
    );
    await openAlert.execute(
      wirelessInput('wireless:throughput:WARNING', {
        metric: 'throughput'
      })
    );

    await resolveAlert.execute({
      deviceId,
      type: 'wireless:signal_rx_dbm:CRITICAL',
      resolvedAt: new Date()
    });

    const stillOpen = await prisma.alertEvent.findMany({
      where: { deviceId, resolvedAt: null }
    });
    expect(stillOpen).toHaveLength(1);
    expect(stillOpen[0].type).toBe('wireless:throughput:WARNING');
  });
});

describe('[NOT-205] Alert ticket mode — integration', () => {
  let prisma: PrismaClient;
  let settingsRepo: PrismaNotificationSettingsRepository;
  let openAlert: OpenAlertUseCase;
  let deviceModelId: string;
  let deviceId: string;

  const SUGGEST_DEFAULTS = NotificationSettings.reconstitute({
    telegramChatId: null,
    downAlertDelayMinutes: 60,
    wirelessAlertsEnabled: true,
    alertTicketMode: 'SUGGEST'
  });

  beforeAll(async () => {
    prisma = createTestPrisma();
    deviceModelId = await seedDeviceModel(prisma);
    const logger = new WinstonLogger();
    settingsRepo = new PrismaNotificationSettingsRepository(
      prisma,
      SUGGEST_DEFAULTS
    );
    openAlert = new OpenAlertUseCase(
      new PrismaAlertRepository(prisma),
      new PrismaDeviceRepository(prisma),
      new DeviceEligibilityService(),
      logger,
      new TicketModeGatedOpener(
        new TicketOpenerAdapter(
          new OpenTicketFromAlertUseCase(
            new PrismaTicketRepository(prisma),
            new CustomerDirectoryAdapter(prisma),
            new DeviceDirectoryAdapter(prisma),
            logger
          )
        ),
        settingsRepo,
        logger
      )
    );
  });

  afterAll(async () => {
    // The row would override the env defaults in every later suite.
    await prisma.notificationSettings.deleteMany();
    await cleanTickets(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notificationSettings.deleteMany();
    await cleanTickets(prisma);
    await cleanDatabase(prisma);
    const seeded = await seedMonitoredDevice(prisma, deviceModelId);
    deviceId = seeded.deviceId;
  });

  const alertInput = () => ({
    deviceId,
    severity: AlertSeverity.WARNING,
    source: 'Enlace inalámbrico',
    type: 'wireless:ccq_percent:WARNING',
    description: 'CCQ bajo',
    details: {}
  });

  it('records the alert but opens no ticket in SUGGEST mode', async () => {
    await openAlert.execute(alertInput());

    expect(
      await prisma.alertEvent.count({ where: { deviceId } })
    ).toBe(1);
    expect(await prisma.ticket.count({ where: { deviceId } })).toBe(
      0
    );
  });

  it('opens the ticket once the administrator switches to AUTOMATIC', async () => {
    await settingsRepo.save(
      NotificationSettings.reconstitute({
        telegramChatId: null,
        downAlertDelayMinutes: 60,
        wirelessAlertsEnabled: true,
        alertTicketMode: 'AUTOMATIC'
      })
    );

    await openAlert.execute(alertInput());

    const alert = await prisma.alertEvent.findFirstOrThrow({
      where: { deviceId }
    });
    const tickets = await prisma.ticket.findMany({
      where: { deviceId }
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0].originAlertId).toBe(alert.id);
  });
});
