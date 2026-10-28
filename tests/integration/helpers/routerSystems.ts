import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaPortSpeedTargetsQuery } from '../../../src/infrastructure/monitoring/port-speeds/PrismaPortSpeedTargetsQuery';
import { PrismaRouterSystemStateRepository } from '../../../src/infrastructure/persistence/PrismaRouterSystemStateRepository';
import { PrismaRouterHealthThresholdsRepository } from '../../../src/infrastructure/persistence/PrismaRouterHealthThresholdsRepository';
import { PrismaReportedOutageQuery } from '../../../src/infrastructure/persistence/PrismaReportedOutageQuery';
import { RouterOsSystemReader } from '../../../src/infrastructure/monitoring/router-system/RouterOsSystemReader';
import {
  RouterSystemNotifier,
  RouterSystemRecorder
} from '../../../src/application/device-monitoring/services';
import {
  CheckRouterSystemsUseCase,
  GetRouterHealthThresholdsUseCase,
  GetRouterSystemUseCase,
  ListRouterSystemsUseCase,
  UpdateRouterHealthThresholdsUseCase
} from '../../../src/application/device-monitoring/use-cases';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeRouterOsPrinter } from './FakeRouterOsPrinter';
import { FakeAlertPublisher } from './FakeAlertPublisher';

// The stored state row of one router, or null.
export async function systemStateOf(
  prisma: PrismaClient,
  deviceId: string
) {
  return prisma.routerSystemState.findUnique({ where: { deviceId } });
}

export function buildRouterSystems(
  prisma: PrismaClient,
  printer: FakeRouterOsPrinter,
  opts: {
    serverOnSite?: boolean;
    now?: Date;
    publisher?: FakeAlertPublisher;
  } = {}
) {
  const logger = new WinstonLogger();
  const targets = new PrismaPortSpeedTargetsQuery(
    prisma,
    opts.serverOnSite ?? true
  );
  const recorder = new RouterSystemRecorder(
    new RouterOsSystemReader(printer),
    new PrismaRouterSystemStateRepository(prisma)
  );
  const now = opts.now ?? new Date('2026-10-28T15:00:00Z');
  const publisher = opts.publisher ?? new FakeAlertPublisher();
  const thresholds = new PrismaRouterHealthThresholdsRepository(
    prisma
  );
  const notifier = new RouterSystemNotifier(
    publisher,
    new PrismaReportedOutageQuery(prisma),
    logger
  );
  return {
    list: new ListRouterSystemsUseCase(targets, recorder, logger),
    get: new GetRouterSystemUseCase(
      targets,
      recorder,
      notifier,
      logger,
      () => now
    ),
    check: new CheckRouterSystemsUseCase(
      targets,
      recorder,
      thresholds,
      notifier,
      logger
    ),
    getThresholds: new GetRouterHealthThresholdsUseCase(
      thresholds,
      logger
    ),
    updateThresholds: new UpdateRouterHealthThresholdsUseCase(
      thresholds,
      logger
    ),
    publisher,
    now
  };
}
