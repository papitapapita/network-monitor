import { PrismaClient } from '../../../src/generated/prisma/client';
import { ILogger } from '../../../src/application/shared/interfaces';
import { PingCycleProbe } from '../../../src/application/device-monitoring/services';
import { RunNetworkSweepUseCase } from '../../../src/application/device-monitoring/use-cases';
import { PrismaNetworkSweepTargetsQuery } from '../../../src/infrastructure/monitoring/network-sweep';
import { FakePingService } from './FakePingService';

// A device with its polling configuration, monitored and in service unless
// told otherwise. Returns the device UUID.
export async function seedSweepDevice(
  prisma: PrismaClient,
  deviceModelId: string,
  opts: {
    name: string;
    ip: string | null;
    category?:
      | 'CPE'
      | 'WIRELESS_CPE'
      | 'ACCESS_POINT'
      | 'GATEWAY'
      | 'AGGREGATION_SWITCH'
      | 'OTHER';
    status?:
      | 'ACTIVE'
      | 'COMMISSIONING'
      | 'INVENTORY'
      | 'DECOMMISSIONED';
    locationId?: string | null;
    agentId?: string | null;
    monitoringEnabled?: boolean;
    pollingEnabled?: boolean;
    withPollingConfig?: boolean;
    deleted?: boolean;
  }
): Promise<string> {
  const device = await prisma.device.create({
    data: {
      name: opts.name,
      owner: 'COMPANY',
      status: opts.status ?? 'ACTIVE',
      category: opts.category ?? 'CPE',
      ipAddress: opts.ip,
      locationId: opts.locationId ?? null,
      agentId: opts.agentId ?? null,
      monitoringEnabled: opts.monitoringEnabled ?? true,
      deletedAt: opts.deleted ? new Date() : null,
      deviceModelId
    }
  });

  if (opts.withPollingConfig ?? true) {
    await prisma.pollingConfiguration.create({
      data: {
        deviceId: device.id,
        ipAddress: opts.ip,
        enabled: opts.pollingEnabled ?? true,
        pingIntervalSecs: 60,
        failuresBeforeDown: 3
      }
    });
  }

  return device.id;
}

export function buildNetworkSweep(
  prisma: PrismaClient,
  ping: FakePingService,
  logger: ILogger,
  serverOnSite = true
): RunNetworkSweepUseCase {
  return new RunNetworkSweepUseCase(
    new PrismaNetworkSweepTargetsQuery(prisma),
    new PingCycleProbe(ping, 0, 1_000),
    logger,
    serverOnSite
  );
}
