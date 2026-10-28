import { PrismaClient } from '../../../src/generated/prisma/client';
import { PrismaPortSpeedTargetsQuery } from '../../../src/infrastructure/monitoring/port-speeds/PrismaPortSpeedTargetsQuery';
import { PrismaRouterSystemStateRepository } from '../../../src/infrastructure/persistence/PrismaRouterSystemStateRepository';
import { RouterOsSystemReader } from '../../../src/infrastructure/monitoring/router-system/RouterOsSystemReader';
import { RouterSystemRecorder } from '../../../src/application/device-monitoring/services';
import {
  CheckRouterSystemsUseCase,
  GetRouterSystemUseCase,
  ListRouterSystemsUseCase
} from '../../../src/application/device-monitoring/use-cases';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { FakeRouterOsPrinter } from './FakeRouterOsPrinter';

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
  opts: { serverOnSite?: boolean; now?: Date } = {}
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
  return {
    list: new ListRouterSystemsUseCase(targets, recorder, logger),
    get: new GetRouterSystemUseCase(
      targets,
      recorder,
      logger,
      () => now
    ),
    check: new CheckRouterSystemsUseCase(targets, recorder, logger),
    now
  };
}
