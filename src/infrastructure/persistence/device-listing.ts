import {
  Prisma,
  DeviceStatus as PrismaDeviceStatus,
  DeviceCategory as PrismaDeviceCategory,
  DeviceOwnerType as PrismaDeviceOwnerType
} from 'generated/prisma/client';
import { DeviceFilters } from 'domain/device-inventory/repository';

// `replacedByDeviceId` is not a column — it is the back-reference of the
// successor's `replacesDeviceId`. Reads that skip this include leave it null.
// A unit put back into service can be replaced again, so there may be several
// successors; the newest is the one that succeeds it now.
export const DEVICE_LINEAGE_INCLUDE = {
  replacedBy: {
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 1
  }
} as const;

// The repository and the device-list read query both page over the same
// filters, and a page and its total must agree on what "matching" means — so
// every `where` for a device listing is built here.
export function buildDeviceFilterWhere(
  filters: Omit<
    DeviceFilters,
    'sortBy' | 'sortOrder' | 'limit' | 'offset'
  >
): Prisma.DeviceWhereInput {
  const where: Prisma.DeviceWhereInput = {};

  // 'any' adds no predicate at all — that is the only case where a tombstone
  // and a live device can appear in the same page.
  if (filters.deleted === 'only') {
    where.deletedAt = { not: null };
  } else if (filters.deleted !== 'any') {
    where.deletedAt = null;
  }

  if (filters.status !== undefined) {
    where.status = filters.status.toString() as PrismaDeviceStatus;
  }

  if (filters.category !== undefined) {
    where.category =
      filters.category.toString() as PrismaDeviceCategory;
  }

  if (filters.owner !== undefined) {
    where.owner = filters.owner.toString() as PrismaDeviceOwnerType;
  }

  if (filters.locationId !== undefined) {
    where.locationId = filters.locationId.toString();
  }

  if (filters.deviceModelId !== undefined) {
    where.deviceModelId = filters.deviceModelId.toString();
  }

  if (filters.monitoringEnabled !== undefined) {
    where.monitoringEnabled = filters.monitoringEnabled;
  }

  if (filters.search !== undefined) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      {
        macAddress: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        ipAddress: {
          contains: filters.search,
          mode: 'insensitive'
        }
      },
      {
        serialNumber: {
          contains: filters.search,
          mode: 'insensitive'
        }
      }
    ];
  }

  return where;
}

export function buildDeviceOrderBy(
  sortBy: DeviceFilters['sortBy'],
  sortOrder: DeviceFilters['sortOrder']
): Prisma.DeviceOrderByWithRelationInput {
  if (sortBy === undefined) {
    return { createdAt: 'desc' };
  }

  // ip_sort_key is a generated column (migration 20260903130000) that
  // orders by address value; ipAddress itself is a plain VARCHAR and
  // would sort lexicographically ("10.0.0.1" before "9.0.0.1").
  const column = sortBy === 'ipAddress' ? 'ipSortKey' : sortBy;
  return { [column]: sortOrder === 'ASC' ? 'asc' : 'desc' };
}
