import { PrismaClient } from '../../generated/prisma/client';
import { Location } from '../../domain/device-inventory/aggregates';
import { LocationId } from '../../domain/shared/ids';
import { LocationType } from '../../domain/device-inventory/enums';
import { Result, EventDispatcher } from '../../domain/shared/core';
import { ILocationRepository } from '../../domain/device-inventory/repository';
import { LocationMapper } from '../mappers';

/**
 * Prisma implementation of ILocationRepository.
 *
 * Handles persistence of Location aggregates using Prisma ORM.
 * Implements all CRUD and query operations defined by the domain interface.
 *
 * Key Features:
 * - Upsert-based save (create or update in a single operation)
 * - Event dispatching after successful commits
 * - Error wrapping: Prisma errors are translated into Result.fail() at the
 *   repository boundary — infrastructure exceptions never bubble upward
 * - Type-filtered queries via findByType
 *
 * @example
 * ```typescript
 * const repository = new PrismaLocationRepository(prisma);
 *
 * // Create location
 * const result = await repository.save(location);
 *
 * // Find by ID
 * const found = await repository.findById(locationId);
 *
 * // List with pagination
 * const all = await repository.findAll(20, 0);
 * ```
 */
export class PrismaLocationRepository implements ILocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Saves a Location aggregate (creates or updates).
   * Dispatches domain events AFTER successful commit.
   */
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
      EventDispatcher.dispatchEventsForAggregate(location.id);

      return Result.ok<Location>(location);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle Prisma unique constraint violations
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

  /**
   * Finds a Location by its unique identifier.
   */
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

  /**
   * Finds all Locations with optional pagination.
   * Results are ordered by name ascending for stable, predictable output.
   */
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

  /**
   * Finds all Locations that match a given LocationType.
   * Results are ordered by name ascending.
   */
  public async findByType(
    type: LocationType
  ): Promise<Result<Location[]>> {
    try {
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

  /**
   * Deletes a Location by its unique identifier.
   * Hard delete — Location has no soft-delete semantics in the domain model.
   */
  public async delete(id: LocationId): Promise<Result<void>> {
    try {
      await this.prisma.location.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle record not found
      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Location not found');
      }

      return Result.fail<void>(
        `Database error deleting location: ${errorMessage}`
      );
    }
  }

  /**
   * Checks whether a Location with the given ID exists.
   */
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

  /**
   * Counts the total number of Locations in the store.
   */
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
