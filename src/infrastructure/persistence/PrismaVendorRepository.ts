import { PrismaClient } from 'generated/prisma/client';
import { Vendor } from 'domain/device-inventory/aggregates';
import { VendorId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { IVendorRepository } from 'domain/device-inventory/repository';
import { VendorMapper } from '../mappers';
import { isRecordNotFound, isUniqueViolation } from './prisma-errors';

export class PrismaVendorRepository implements IVendorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(vendor: Vendor): Promise<Result<Vendor>> {
    try {
      const data = VendorMapper.toPersistence(vendor);

      await this.prisma.vendor.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(vendor.id);

      return Result.ok<Vendor>(vendor);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isUniqueViolation(error)) {
        return Result.fail<Vendor>(
          'A vendor with this name or slug already exists'
        );
      }

      return Result.fail<Vendor>(
        `Database error saving vendor: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: VendorId
  ): Promise<Result<Vendor | null>> {
    try {
      const raw = await this.prisma.vendor.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) return Result.ok<Vendor | null>(null);

      const domainResult = VendorMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Vendor | null>(
          `Failed to map vendor: ${domainResult.error}`
        );
      }

      return Result.ok<Vendor | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Vendor | null>(
        `Database error finding vendor: ${errorMessage}`
      );
    }
  }

  public async findBySlug(
    slug: string
  ): Promise<Result<Vendor | null>> {
    try {
      const raw = await this.prisma.vendor.findUnique({
        where: { slug }
      });

      if (!raw) return Result.ok<Vendor | null>(null);

      const domainResult = VendorMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Vendor | null>(
          `Failed to map vendor: ${domainResult.error}`
        );
      }

      return Result.ok<Vendor | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Vendor | null>(
        `Database error finding vendor by slug: ${errorMessage}`
      );
    }
  }

  public async findByName(
    name: string
  ): Promise<Result<Vendor | null>> {
    try {
      const raw = await this.prisma.vendor.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } }
      });

      if (!raw) return Result.ok<Vendor | null>(null);

      const domainResult = VendorMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Vendor | null>(
          `Failed to map vendor: ${domainResult.error}`
        );
      }

      return Result.ok<Vendor | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Vendor | null>(
        `Database error finding vendor by name: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Vendor[]>> {
    try {
      const rawRecords = await this.prisma.vendor.findMany({
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' }
      });

      const vendors: Vendor[] = [];
      for (const raw of rawRecords) {
        const domainResult = VendorMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Vendor[]>(
            `Failed to map vendor: ${domainResult.error}`
          );
        }
        vendors.push(domainResult.value);
      }

      return Result.ok<Vendor[]>(vendors);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Vendor[]>(
        `Database error finding all vendors: ${errorMessage}`
      );
    }
  }

  public async delete(id: VendorId): Promise<Result<void>> {
    try {
      await this.prisma.vendor.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isRecordNotFound(error)) {
        return Result.fail<void>('Vendor not found');
      }

      return Result.fail<void>(
        `Database error deleting vendor: ${errorMessage}`
      );
    }
  }

  public async exists(id: VendorId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.vendor.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking vendor existence: ${errorMessage}`
      );
    }
  }

  public async existsBySlug(slug: string): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.vendor.count({
        where: { slug }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking vendor slug existence: ${errorMessage}`
      );
    }
  }

  public async existsByName(name: string): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.vendor.count({
        where: { name: { equals: name, mode: 'insensitive' } }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking vendor name existence: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.vendor.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting vendors: ${errorMessage}`
      );
    }
  }
}
