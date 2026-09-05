import { PrismaClient } from 'generated/prisma/client';
import { Quotation, QuotationStatus } from 'domain/quoting';
import {
  IQuotationRepository,
  QuotationFilters
} from 'domain/quoting/repository';
import { CustomerId, QuotationId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { QuotationPrismaMapper } from '../mappers';
import { isForeignKeyViolation } from '../../persistence/prisma-errors';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export class PrismaQuotationRepository
  implements IQuotationRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    quotation: Quotation
  ): Promise<Result<Quotation>> {
    try {
      const { quotation: quotationData, lineItems } =
        QuotationPrismaMapper.toPersistence(quotation);

      await this.prisma.$transaction([
        this.prisma.quotation.upsert({
          where: { id: quotationData.id },
          create: quotationData,
          update: {
            status: quotationData.status,
            customerName: quotationData.customerName,
            customerPhone: quotationData.customerPhone,
            customerEmail: quotationData.customerEmail,
            customerAddress: quotationData.customerAddress,
            validUntil: quotationData.validUntil,
            notes: quotationData.notes,
            sentAt: quotationData.sentAt,
            acceptedAt: quotationData.acceptedAt,
            rejectedAt: quotationData.rejectedAt,
            rejectionReason: quotationData.rejectionReason,
            expiredAt: quotationData.expiredAt,
            updatedAt: quotationData.updatedAt
          }
        }),
        this.prisma.quotationLineItem.deleteMany({
          where: { quotationId: quotationData.id }
        }),
        this.prisma.quotationLineItem.createMany({ data: lineItems })
      ]);

      EventDispatcher.dispatchEventsForAggregate(quotation.id);

      // Re-fetch: `code` is assigned by the database sequence and is only
      // known once the row is read back after save.
      const raw = await this.prisma.quotation.findUnique({
        where: { id: quotationData.id },
        include: { lineItems: true }
      });
      if (!raw) {
        return Result.fail<Quotation>(
          'Quotation not found after save'
        );
      }

      const domainResult = QuotationPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Quotation>(
          `Failed to map quotation: ${domainResult.error}`
        );
      }

      return Result.ok<Quotation>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isForeignKeyViolation(error)) {
        return Result.fail<Quotation>(
          'Referenced customer or device model does not exist'
        );
      }

      return Result.fail<Quotation>(
        `Database error saving quotation: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: QuotationId
  ): Promise<Result<Quotation | null>> {
    try {
      const raw = await this.prisma.quotation.findUnique({
        where: { id: id.toString() },
        include: { lineItems: true }
      });

      if (!raw) return Result.ok<Quotation | null>(null);

      const domainResult = QuotationPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Quotation | null>(
          `Failed to map quotation: ${domainResult.error}`
        );
      }

      return Result.ok<Quotation | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Quotation | null>(
        `Database error finding quotation: ${errorMessage}`
      );
    }
  }

  public async findByCustomerId(
    customerId: CustomerId,
    limit: number = DEFAULT_LIMIT,
    offset: number = DEFAULT_OFFSET
  ): Promise<Result<Quotation[]>> {
    try {
      const rawRecords = await this.prisma.quotation.findMany({
        where: { customerId: customerId.toString() },
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Quotation[]>(
        `Database error finding quotations by customer: ${errorMessage}`
      );
    }
  }

  public async findAll(
    filters: QuotationFilters = {},
    limit: number = DEFAULT_LIMIT,
    offset: number = DEFAULT_OFFSET
  ): Promise<Result<Quotation[]>> {
    try {
      const rawRecords = await this.prisma.quotation.findMany({
        where: this.buildWhere(filters),
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Quotation[]>(
        `Database error finding quotations: ${errorMessage}`
      );
    }
  }

  public async count(
    filters: QuotationFilters = {}
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.quotation.count({
        where: this.buildWhere(filters)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting quotations: ${errorMessage}`
      );
    }
  }

  public async exists(id: QuotationId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.quotation.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking quotation existence: ${errorMessage}`
      );
    }
  }

  private buildWhere(filters: QuotationFilters): {
    customerId?: string;
    status?: QuotationStatus;
    createdAt?: { gte?: Date; lte?: Date };
  } {
    const where: {
      customerId?: string;
      status?: QuotationStatus;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (filters.customerId) {
      where.customerId = filters.customerId.toString();
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {
        ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
        ...(filters.createdTo ? { lte: filters.createdTo } : {})
      };
    }

    return where;
  }

  private mapMany(
    rawRecords: Parameters<typeof QuotationPrismaMapper.toDomain>[0][]
  ): Result<Quotation[]> {
    const quotations: Quotation[] = [];
    for (const raw of rawRecords) {
      const domainResult = QuotationPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Quotation[]>(
          `Failed to map quotation: ${domainResult.error}`
        );
      }
      quotations.push(domainResult.value);
    }
    return Result.ok<Quotation[]>(quotations);
  }
}
