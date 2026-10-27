import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  ITopologyQuery,
  TopologyDeviceRow
} from 'application/device-inventory/interfaces';
import { ConnectivityStatus } from 'application/device-inventory/dtos';
import { isUnmeasured } from '../probe-agents/queries';

const ON_NETWORK = ['ACTIVE', 'COMMISSIONING'] as const;

export class PrismaTopologyQuery implements ITopologyQuery {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly serverOnSite = true
  ) {}

  public async findAll(): Promise<Result<TopologyDeviceRow[]>> {
    try {
      const records = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          OR: [
            { status: { in: [...ON_NETWORK] } },
            { downstream: { some: { deletedAt: null } } }
          ]
        },
        select: {
          id: true,
          name: true,
          status: true,
          category: true,
          ipAddress: true,
          locationId: true,
          upstreamDeviceId: true,
          monitoringEnabled: true,
          agentId: true,
          location: { select: { name: true } },
          agent: { select: { status: true, offlineSince: true } },
          deviceState: { select: { status: true, downSince: true } }
        },
        orderBy: { ipSortKey: 'asc' }
      });

      return Result.ok(
        records.map((r) => {
          const connectivity = this.connectivityOf(r);
          return {
            id: r.id,
            name: r.name,
            status: r.status,
            category: r.category,
            ipAddress: r.ipAddress,
            locationId: r.locationId,
            locationName: r.location?.name ?? null,
            upstreamDeviceId: r.upstreamDeviceId,
            connectivity,
            downSince:
              connectivity === 'DOWN'
                ? (r.deviceState?.downSince ?? null)
                : null
          };
        })
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail(
        `Database error reading the topology: ${errorMessage}`
      );
    }
  }

  // Same reading as the device list: a device behind an agent that is not
  // reporting is UNKNOWN whatever its stored state (MON-006).
  private connectivityOf(r: {
    monitoringEnabled: boolean;
    agentId: string | null;
    agent: { status: string; offlineSince: Date | null } | null;
    deviceState: { status: string } | null;
  }): ConnectivityStatus | null {
    if (!r.monitoringEnabled) return null;
    if (!r.deviceState) return 'UNKNOWN';
    if (isUnmeasured(r, this.serverOnSite)) return 'UNKNOWN';
    return r.deviceState.status as ConnectivityStatus;
  }
}
