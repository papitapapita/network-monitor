import { PrismaClient } from 'generated/prisma/client';
import { Customer } from 'domain/customers/aggregates';
import { CustomerId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { ICustomerRepository } from 'domain/customers/repository';
import { CustomerPrismaMapper } from '../mappers';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(customer: Customer): Promise<Result<Customer>> {
    try {
      const data = CustomerPrismaMapper.toPersistence(customer);

      await this.prisma.customer.upsert({
        where: { id: data.id },
        create: data,
        update: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          cedula: data.cedula,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(customer.id);

      return Result.ok<Customer>(customer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<Customer>(
          'A customer with this phone, email or cedula already exists'
        );
      }

      return Result.fail<Customer>(
        `Database error saving customer: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: CustomerId
  ): Promise<Result<Customer | null>> {
    try {
      const raw = await this.prisma.customer.findUnique({
        where: { id: id.toString() }
      });
      return this.toDomainResult(raw);
    } catch (error) {
      return this.findError('id', error);
    }
  }

  public async findByPhone(
    phone: string
  ): Promise<Result<Customer | null>> {
    try {
      const raw = await this.prisma.customer.findUnique({
        where: { phone }
      });
      return this.toDomainResult(raw);
    } catch (error) {
      return this.findError('phone', error);
    }
  }

  public async findByCedula(
    cedula: string
  ): Promise<Result<Customer | null>> {
    try {
      const raw = await this.prisma.customer.findUnique({
        where: { cedula }
      });
      return this.toDomainResult(raw);
    } catch (error) {
      return this.findError('cedula', error);
    }
  }

  public async findByEmail(
    email: string
  ): Promise<Result<Customer | null>> {
    try {
      const raw = await this.prisma.customer.findUnique({
        where: { email }
      });
      return this.toDomainResult(raw);
    } catch (error) {
      return this.findError('email', error);
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<Customer[]>> {
    try {
      const rawRecords = await this.prisma.customer.findMany({
        take: limit,
        skip: offset,
        orderBy: { fullName: 'asc' }
      });

      const customers: Customer[] = [];
      for (const raw of rawRecords) {
        const domainResult = CustomerPrismaMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<Customer[]>(
            `Failed to map customer: ${domainResult.error}`
          );
        }
        customers.push(domainResult.value);
      }

      return Result.ok<Customer[]>(customers);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Customer[]>(
        `Database error finding all customers: ${errorMessage}`
      );
    }
  }

  public async delete(id: CustomerId): Promise<Result<void>> {
    try {
      await this.prisma.customer.delete({
        where: { id: id.toString() }
      });
      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Customer not found');
      }
      if (errorMessage.includes('P2003')) {
        return Result.fail<void>(
          'Cannot delete a customer with contracted services'
        );
      }

      return Result.fail<void>(
        `Database error deleting customer: ${errorMessage}`
      );
    }
  }

  public async exists(id: CustomerId): Promise<Result<boolean>> {
    return this.countWhere({ id: id.toString() }, 'existence');
  }

  public async existsByPhone(phone: string): Promise<Result<boolean>> {
    return this.countWhere({ phone }, 'phone existence');
  }

  public async existsByCedula(
    cedula: string
  ): Promise<Result<boolean>> {
    return this.countWhere({ cedula }, 'cedula existence');
  }

  public async existsByEmail(email: string): Promise<Result<boolean>> {
    return this.countWhere({ email }, 'email existence');
  }

  private toDomainResult(
    raw: Parameters<typeof CustomerPrismaMapper.toDomain>[0] | null
  ): Result<Customer | null> {
    if (!raw) return Result.ok<Customer | null>(null);

    const domainResult = CustomerPrismaMapper.toDomain(raw);
    if (domainResult.isFailure) {
      return Result.fail<Customer | null>(
        `Failed to map customer: ${domainResult.error}`
      );
    }
    return Result.ok<Customer | null>(domainResult.value);
  }

  private findError(
    label: string,
    error: unknown
  ): Result<Customer | null> {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return Result.fail<Customer | null>(
      `Database error finding customer by ${label}: ${errorMessage}`
    );
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.customer.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting customers: ${errorMessage}`
      );
    }
  }

  private async countWhere(
    where: {
      id?: string;
      phone?: string;
      cedula?: string;
      email?: string;
    },
    label: string
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.customer.count({ where });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking customer ${label}: ${errorMessage}`
      );
    }
  }
}
