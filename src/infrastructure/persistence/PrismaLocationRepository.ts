import { PrismaClient } from 'generated/prisma/client';
import { Location } from 'domain/device-inventory/aggregates';
import { LocationId } from 'domain/shared/ids';
import { LocationType } from 'domain/device-inventory/enums';
import { Result, EventDispatcher } from 'domain/shared/core';
import { ILocationRepository } from 'domain/device-inventory/repository';
import { LocationMapper } from '../mappers';

export class PrismaLocationRepository implements ILocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(location: Location): Promise<Result<Location>> {
    try {
      const data = LocationMapper.toPersistence(location);

      await this.prisma.location.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          type: data.type,
          municipality: data.municipality,
          neighborhood: data.neighborhood,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          updatedAt: data.updatedAt
        }
      });

      // Dispatch domain events AFTER successful commit
      EventDispatcher.markAggregateForDispatch(location);
      EventDispatcher.dispatchEventsForAggregate(location.id);

      return Result.ok<Location>(location);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<Location>(
          'A location with these unique values already exists'
        );
      }

      return Result.fail<Location>(
        `Database error saving location: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: LocationId
  ): Promise<Result<Location | null>> {
    try {
      const raw = await this.prisma.location.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) {
        return Result.ok<Location | null>(null);
      }

      const domainResult = LocationMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Location | null>(
          `Failed to map location: ${domainResult.error}`
        );
      }

      return Result.ok<Location | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Location | null>(
        `Database error finding location: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Location[]>> {
    try {
      const rawRecords = await this.prisma.location.findMany({
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' }
      });

      const locations: Location[] = [];
      for (const raw of rawRecords) {
        const domainResult = LocationMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Location[]>(
            `Failed to map location: ${domainResult.error}`
          );
        }
        locations.push(domainResult.value);
      }

      return Result.ok<Location[]>(locations);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Location[]>(
        `Database error finding all locations: ${errorMessage}`
      );
    }
  }

  public async findByType(
    type: LocationType
  ): Promise<Result<Location[]>> {
    try {
      // Prisma's generated type expects enum literal, not string — string cast required
      const rawRecords = await this.prisma.location.findMany({
        where: { type: type as any },
        orderBy: { name: 'asc' }
      });

      const locations: Location[] = [];
      for (const raw of rawRecords) {
        const domainResult = LocationMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Location[]>(
            `Failed to map location: ${domainResult.error}`
          );
        }
        locations.push(domainResult.value);
      }

      return Result.ok<Location[]>(locations);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Location[]>(
        `Database error finding locations by type: ${errorMessage}`
      );
    }
  }

  public async findAllWithCoordinates(): Promise<Result<Location[]>> {
    try {
      const rawRecords = await this.prisma.location.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null }
        },
        orderBy: { name: 'asc' }
      });

      const locations: Location[] = [];
      for (const raw of rawRecords) {
        const domainResult = LocationMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Location[]>(
            `Failed to map location: ${domainResult.error}`
          );
        }
        locations.push(domainResult.value);
      }

      return Result.ok<Location[]>(locations);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Location[]>(
        `Database error finding geolocated locations: ${errorMessage}`
      );
    }
  }

  public async delete(id: LocationId): Promise<Result<void>> {
    try {
      await this.prisma.location.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Location not found');
      }

      return Result.fail<void>(
        `Database error deleting location: ${errorMessage}`
      );
    }
  }

  public async exists(id: LocationId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.location.count({
        where: { id: id.toString() }
      });

      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking location existence: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.location.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting locations: ${errorMessage}`
      );
    }
  }
}
