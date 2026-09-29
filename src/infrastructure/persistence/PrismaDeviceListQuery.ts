import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  DeviceListCriteria,
  IDeviceListQuery
} from 'application/device-inventory/interfaces';
import {
  ConnectivityStatus,
  DeviceConnectivityDTO,
  DeviceListItemDTO
} from 'application/device-inventory/dtos';
import { DeviceMapper as DeviceDTOMapper } from 'application/device-inventory/mappers';
import { DeviceMapper } from '../mappers';
import {
  DEVICE_LINEAGE_INCLUDE,
  buildDeviceFilterWhere,
  buildDeviceOrderBy
} from './device-listing';
import {
  DEVICE_BEHIND_SILENT_AGENT,
  isBehindSilentAgent
} from '../probe-agents/queries';

const INCLUDE = {
  ...DEVICE_LINEAGE_INCLUDE,
  deviceState: {
    select: { status: true, downSince: true, lastSeen: true }
  },
  agent: { select: { status: true, offlineSince: true } }
} as const;

type DeviceListRecord = Prisma.DeviceGetPayload<{
  include: typeof INCLUDE;
}>;

export class PrismaDeviceListQuery implements IDeviceListQuery {
  constructor(private readonly prisma: PrismaClient) {}

  public async list(
    criteria: DeviceListCriteria
  ): Promise<Result<DeviceListItemDTO[]>> {
    try {
      const rawRecords = await this.prisma.device.findMany({
        where: this.buildWhere(criteria),
        include: INCLUDE,
        orderBy: this.buildOrderBy(criteria),
        take: criteria.limit,
        skip: criteria.offset
      });

      const items: DeviceListItemDTO[] = [];
      for (const raw of rawRecords) {
        const deviceResult = DeviceMapper.toDomain(raw);
        if (deviceResult.isFailure) {
          return Result.fail<DeviceListItemDTO[]>(
            `Failed to map device: ${deviceResult.error}`
          );
        }
        items.push({
          ...DeviceDTOMapper.toDTO(deviceResult.value),
          connectivity: this.toConnectivity(raw)
        });
      }

      return Result.ok<DeviceListItemDTO[]>(items);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceListItemDTO[]>(
        `Database error listing devices: ${errorMessage}`
      );
    }
  }

  public async count(
    criteria: DeviceListCriteria
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.device.count({
        where: this.buildWhere(criteria)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting devices: ${errorMessage}`
      );
    }
  }

  private buildWhere(
    criteria: DeviceListCriteria
  ): Prisma.DeviceWhereInput {
    const where = buildDeviceFilterWhere(criteria);
    const connectivity = criteria.connectivity;

    if (connectivity === undefined) {
      return where;
    }

    // AND rather than assigning monitoringEnabled directly: a caller asking
    // for monitoringEnabled=false and a connectivity at the same time must get
    // nothing, not have one filter silently overwrite the other.
    // A device behind an agent that is not reporting is UNKNOWN whatever its
    // stored state says (ADR 0002, R7), and never UP or DOWN.
    const stateMatch: Prisma.DeviceWhereInput =
      connectivity === 'UNKNOWN'
        ? {
            OR: [
              { deviceState: { is: null } },
              { deviceState: { is: { status: 'UNKNOWN' } } },
              DEVICE_BEHIND_SILENT_AGENT
            ]
          }
        : {
            deviceState: { is: { status: connectivity } },
            NOT: DEVICE_BEHIND_SILENT_AGENT
          };

    return {
      ...where,
      AND: [{ monitoringEnabled: true }, stateMatch]
    };
  }

  private buildOrderBy(
    criteria: DeviceListCriteria
  ): Prisma.DeviceOrderByWithRelationInput[] {
    if (criteria.sortBy !== 'downSince') {
      return [
        buildDeviceOrderBy(criteria.sortBy, criteria.sortOrder)
      ];
    }

    // Unmonitored devices go last whatever the direction: a stale downSince
    // left behind when monitoring was switched off is not an outage.
    return [
      { monitoringEnabled: 'desc' },
      {
        deviceState: {
          downSince: {
            sort: criteria.sortOrder === 'DESC' ? 'desc' : 'asc',
            nulls: 'last'
          }
        }
      },
      { createdAt: 'desc' }
    ];
  }

  private toConnectivity(
    raw: DeviceListRecord
  ): DeviceConnectivityDTO | null {
    if (!raw.monitoringEnabled) {
      return null;
    }

    const state = raw.deviceState;
    if (!state) {
      return { status: 'UNKNOWN', downSince: null, lastSeen: null };
    }
    if (isBehindSilentAgent(raw)) {
      return {
        status: 'UNKNOWN',
        downSince: null,
        lastSeen: state.lastSeen ? state.lastSeen.toISOString() : null
      };
    }

    return {
      status: state.status as ConnectivityStatus,
      downSince: state.downSince
        ? state.downSince.toISOString()
        : null,
      lastSeen: state.lastSeen ? state.lastSeen.toISOString() : null
    };
  }
}
