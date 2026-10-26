import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Bill } from 'domain/billing/aggregates';
import {
  BillFilters,
  IBillRepository
} from 'domain/billing/repository';
import {
  BillId,
  ContractedServiceId,
  CustomerId
} from 'domain/shared/ids';
import { BillingPeriod } from 'domain/billing/value-objects';
import { Result, EventDispatcher } from 'domain/shared/core';
import { BillPrismaMapper } from '../mappers';
import {
  isForeignKeyViolation,
  isUniqueViolation
} from '../../persistence/prisma-errors';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export class PrismaBillRepository implements IBillRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(bill: Bill): Promise<Result<Bill>> {
    try {
      const {
        bill: billData,
        lineItems,
        payment
      } = BillPrismaMapper.toPersistence(bill);

      await this.prisma.$transaction([
        this.prisma.bill.upsert({
          where: { id: billData.id },
          create: billData,
          update: {
            status: billData.status,
            issueDate: billData.issueDate,
            dueDate: billData.dueDate,
            paidAt: billData.paidAt,
            updatedAt: billData.updatedAt
          }
        }),
        this.prisma.billLineItem.deleteMany({
          where: { billId: billData.id }
        }),
        this.prisma.billLineItem.createMany({ data: lineItems }),
        // A payment is never changed once recorded.
        ...(payment === null
          ? []
          : [
              this.prisma.billPayment.upsert({
                where: { billId: billData.id },
                create: payment,
                update: {}
              })
            ])
      ]);

      EventDispatcher.markAggregateForDispatch(bill);
      EventDispatcher.dispatchEventsForAggregate(bill.id);

      return Result.ok<Bill>(bill);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isUniqueViolation(error)) {
        return Result.fail<Bill>(
          'A bill for this service and period already exists'
        );
      }
      if (isForeignKeyViolation(error)) {
        return Result.fail<Bill>(
          'Referenced customer does not exist'
        );
      }

      return Result.fail<Bill>(
        `Database error saving bill: ${errorMessage}`
      );
    }
  }

  public async findById(id: BillId): Promise<Result<Bill | null>> {
    try {
      const raw = await this.prisma.bill.findUnique({
        where: { id: id.toString() },
        include: { lineItems: true, payment: true }
      });

      if (!raw) return Result.ok<Bill | null>(null);

      const domainResult = BillPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Bill | null>(
          `Failed to map bill: ${domainResult.error}`
        );
      }

      return Result.ok<Bill | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Bill | null>(
        `Database error finding bill: ${errorMessage}`
      );
    }
  }

  public async findByCustomerId(
    customerId: CustomerId,
    limit: number = DEFAULT_LIMIT,
    offset: number = DEFAULT_OFFSET
  ): Promise<Result<Bill[]>> {
    try {
      const rawRecords = await this.prisma.bill.findMany({
        where: { customerId: customerId.toString() },
        include: { lineItems: true, payment: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Bill[]>(
        `Database error finding bills by customer: ${errorMessage}`
      );
    }
  }

  public async findAll(
    filters: BillFilters = {},
    limit: number = DEFAULT_LIMIT,
    offset: number = DEFAULT_OFFSET
  ): Promise<Result<Bill[]>> {
    try {
      const rawRecords = await this.prisma.bill.findMany({
        where: this.buildWhere(filters),
        include: { lineItems: true, payment: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Bill[]>(
        `Database error finding bills: ${errorMessage}`
      );
    }
  }

  public async count(
    filters: BillFilters = {}
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.bill.count({
        where: this.buildWhere(filters)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting bills: ${errorMessage}`
      );
    }
  }

  public async existsForServiceAndPeriod(
    contractedServiceId: ContractedServiceId,
    period: BillingPeriod
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.bill.count({
        where: {
          lineItems: {
            some: {
              contractedServiceId: contractedServiceId.toString()
            }
          },
          periodYear: period.year,
          periodMonth: period.month,
          status: { not: 'CANCELLED' }
        }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking bill existence for service and period: ${errorMessage}`
      );
    }
  }

  public async exists(id: BillId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.bill.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking bill existence: ${errorMessage}`
      );
    }
  }

  public async findPendingDueBefore(
    instant: Date
  ): Promise<Result<Bill[]>> {
    try {
      const rawRecords = await this.prisma.bill.findMany({
        where: { status: 'PENDING', dueDate: { lt: instant } },
        include: { lineItems: true, payment: true },
        orderBy: { dueDate: 'asc' }
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Bill[]>(
        `Database error finding bills past due: ${errorMessage}`
      );
    }
  }

  public async findOverdueDueBetween(
    from: Date,
    to: Date
  ): Promise<Result<Bill[]>> {
    try {
      const rawRecords = await this.prisma.bill.findMany({
        where: { status: 'OVERDUE', dueDate: { gte: from, lte: to } },
        include: { lineItems: true, payment: true },
        orderBy: { dueDate: 'asc' }
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Bill[]>(
        `Database error finding overdue bills: ${errorMessage}`
      );
    }
  }

  public async findServicesOverdueBefore(
    instant: Date
  ): Promise<Result<ContractedServiceId[]>> {
    try {
      const rows = await this.prisma.billLineItem.findMany({
        where: {
          bill: { status: 'OVERDUE', dueDate: { lt: instant } }
        },
        select: { contractedServiceId: true },
        distinct: ['contractedServiceId'],
        orderBy: { contractedServiceId: 'asc' }
      });

      const ids: ContractedServiceId[] = [];
      for (const row of rows) {
        const id = ContractedServiceId.parse(row.contractedServiceId);
        if (id.isFailure) return Result.fail(id.error);
        ids.push(id.value);
      }
      return Result.ok(ids);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedServiceId[]>(
        `Database error finding overdue services: ${errorMessage}`
      );
    }
  }

  private buildWhere(filters: BillFilters): Prisma.BillWhereInput {
    const where: Prisma.BillWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId.toString();
    }
    if (filters.contractedServiceId) {
      where.lineItems = {
        some: {
          contractedServiceId: filters.contractedServiceId.toString()
        }
      };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.period) {
      where.periodYear = filters.period.year;
      where.periodMonth = filters.period.month;
    }

    return where;
  }

  private mapMany(
    rawRecords: Parameters<typeof BillPrismaMapper.toDomain>[0][]
  ): Result<Bill[]> {
    const bills: Bill[] = [];
    for (const raw of rawRecords) {
      const domainResult = BillPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Bill[]>(
          `Failed to map bill: ${domainResult.error}`
        );
      }
      bills.push(domainResult.value);
    }
    return Result.ok<Bill[]>(bills);
  }
}
