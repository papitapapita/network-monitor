import { PrismaClient } from 'generated/prisma/client';
import { Technician, ITechnicianRepository } from 'domain/tickets';
import { TechnicianId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { TechnicianMapper } from '../mappers';
import {
  isRecordNotFound,
  isUniqueViolation,
  isForeignKeyViolation
} from '../../persistence/prisma-errors';

export class PrismaTechnicianRepository
  implements ITechnicianRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    technician: Technician
  ): Promise<Result<Technician>> {
    try {
      const data = TechnicianMapper.toPersistence(technician);

      await this.prisma.technician.upsert({
        where: { id: data.id },
        create: data,
        update: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          userId: data.userId,
          isActive: data.isActive,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(technician.id);

      return Result.ok<Technician>(technician);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isUniqueViolation(error)) {
        return Result.fail<Technician>(
          'A technician with this phone, email or user account already exists'
        );
      }

      if (isForeignKeyViolation(error)) {
        return Result.fail<Technician>(
          'The referenced user account does not exist'
        );
      }

      return Result.fail<Technician>(
        `Database error saving technician: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: TechnicianId
  ): Promise<Result<Technician | null>> {
    try {
      const raw = await this.prisma.technician.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) return Result.ok<Technician | null>(null);

      const domainResult = TechnicianMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Technician | null>(
          `Failed to map technician: ${domainResult.error}`
        );
      }

      return Result.ok<Technician | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Technician | null>(
        `Database error finding technician: ${errorMessage}`
      );
    }
  }

  public async findByPhone(
    phone: string
  ): Promise<Result<Technician | null>> {
    try {
      const raw = await this.prisma.technician.findUnique({
        where: { phone }
      });

      if (!raw) return Result.ok<Technician | null>(null);

      const domainResult = TechnicianMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Technician | null>(
          `Failed to map technician: ${domainResult.error}`
        );
      }

      return Result.ok<Technician | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Technician | null>(
        `Database error finding technician by phone: ${errorMessage}`
      );
    }
  }

  public async findAll(
    activeOnly?: boolean,
    limit?: number,
    offset?: number
  ): Promise<Result<Technician[]>> {
    try {
      const rawRecords = await this.prisma.technician.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        take: limit,
        skip: offset,
        orderBy: { fullName: 'asc' }
      });

      const technicians: Technician[] = [];
      for (const raw of rawRecords) {
        const domainResult = TechnicianMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Technician[]>(
            `Failed to map technician: ${domainResult.error}`
          );
        }
        technicians.push(domainResult.value);
      }

      return Result.ok<Technician[]>(technicians);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Technician[]>(
        `Database error finding all technicians: ${errorMessage}`
      );
    }
  }

  public async delete(id: TechnicianId): Promise<Result<void>> {
    try {
      await this.prisma.technician.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isRecordNotFound(error)) {
        return Result.fail<void>('Technician not found');
      }

      return Result.fail<void>(
        `Database error deleting technician: ${errorMessage}`
      );
    }
  }

  public async exists(id: TechnicianId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.technician.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking technician existence: ${errorMessage}`
      );
    }
  }

  public async existsByPhone(
    phone: string
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.technician.count({
        where: { phone }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking technician phone existence: ${errorMessage}`
      );
    }
  }

  public async existsByEmail(
    email: string
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.technician.count({
        where: { email }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking technician email existence: ${errorMessage}`
      );
    }
  }

  public async count(activeOnly?: boolean): Promise<Result<number>> {
    try {
      const count = await this.prisma.technician.count({
        where: activeOnly ? { isActive: true } : undefined
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting technicians: ${errorMessage}`
      );
    }
  }
}
