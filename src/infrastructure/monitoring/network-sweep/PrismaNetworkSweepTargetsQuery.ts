import { PrismaClient } from 'generated/prisma/client';
import { DeviceCategory } from 'generated/prisma/enums';
import { Result } from 'domain/shared/core';
import {
  INetworkSweepTargetsQuery,
  NetworkSweepCandidate,
  NetworkSweepFilter
} from 'application/device-monitoring/interfaces';

export class PrismaNetworkSweepTargetsQuery
  implements INetworkSweepTargetsQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async listInService(
    filter: NetworkSweepFilter
  ): Promise<Result<NetworkSweepCandidate[]>> {
    try {
      const rows = await this.prisma.device.findMany({
        where: {
          deletedAt: null,
          status: { in: ['ACTIVE', 'COMMISSIONING'] },
          ...(filter.locationId && { locationId: filter.locationId }),
          ...(filter.category && {
            category: filter.category as DeviceCategory
          })
        },
        select: {
          id: true,
          name: true,
          category: true,
          locationId: true,
          agentId: true,
          monitoringEnabled: true,
          location: { select: { name: true } },
          agent: { select: { name: true } },
          pollingConfiguration: {
            select: { ipAddress: true, enabled: true }
          }
        }
      });
      return Result.ok(
        rows.map((row) => ({
          deviceId: row.id,
          deviceName: row.name,
          ipAddress: row.pollingConfiguration?.ipAddress ?? null,
          category: row.category,
          locationId: row.locationId,
          locationName: row.location?.name ?? null,
          agentId: row.agentId,
          agentName: row.agent?.name ?? null,
          monitored:
            row.monitoringEnabled &&
            (row.pollingConfiguration?.enabled ?? false)
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing devices to sweep: ${(error as Error).message}`
      );
    }
  }
}
