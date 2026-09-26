import { PrismaClient } from 'generated/prisma/client';
import {
  CollectionAccount,
  CollectionAccountStatus
} from 'domain/billing';
import {
  ICollectionAccountRepository,
  CollectionAccountFilters
} from 'domain/billing/repository';
import { CollectionAccountId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { CollectionAccountPrismaMapper } from '../mappers';
import { isForeignKeyViolation } from '../../persistence/prisma-errors';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

export class PrismaCollectionAccountRepository
  implements ICollectionAccountRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    collectionAccount: CollectionAccount
  ): Promise<Result<CollectionAccount>> {
    try {
      const {
        collectionAccount: data,
        lineItems,
        paymentAccounts
      } = CollectionAccountPrismaMapper.toPersistence(
        collectionAccount
      );

      await this.prisma.$transaction([
        this.prisma.collectionAccount.upsert({
          where: { id: data.id },
          create: data,
          update: {
            status: data.status,
            paidAt: data.paidAt,
            cancelledAt: data.cancelledAt,
            updatedAt: data.updatedAt
          }
        }),
        this.prisma.collectionAccountLineItem.deleteMany({
          where: { collectionAccountId: data.id }
        }),
        this.prisma.collectionAccountLineItem.createMany({
          data: lineItems
        }),
        this.prisma.collectionAccountPaymentAccount.deleteMany({
          where: { collectionAccountId: data.id }
        }),
        this.prisma.collectionAccountPaymentAccount.createMany({
          data: paymentAccounts
        })
      ]);

      EventDispatcher.dispatchEventsForAggregate(
        collectionAccount.id
      );

      // Re-fetch: `code` is assigned by the database sequence and is only
      // known once the row is read back after save.
      const raw = await this.prisma.collectionAccount.findUnique({
        where: { id: data.id },
        include: { lineItems: true, paymentAccounts: true }
      });
      if (!raw) {
        return Result.fail<CollectionAccount>(
          'Collection account not found after save'
        );
      }

      const domainResult =
        CollectionAccountPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<CollectionAccount>(
          `Failed to map collection account: ${domainResult.error}`
        );
      }

      return Result.ok<CollectionAccount>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isForeignKeyViolation(error)) {
        return Result.fail<CollectionAccount>(
          'Referenced customer does not exist'
        );
      }

      return Result.fail<CollectionAccount>(
        `Database error saving collection account: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: CollectionAccountId
  ): Promise<Result<CollectionAccount | null>> {
    try {
      const raw = await this.prisma.collectionAccount.findUnique({
        where: { id: id.toString() },
        include: { lineItems: true, paymentAccounts: true }
      });

      if (!raw) return Result.ok<CollectionAccount | null>(null);

      const domainResult =
        CollectionAccountPrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<CollectionAccount | null>(
          `Failed to map collection account: ${domainResult.error}`
        );
      }

      return Result.ok<CollectionAccount | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<CollectionAccount | null>(
        `Database error finding collection account: ${errorMessage}`
      );
    }
  }

  public async findAll(
    filters: CollectionAccountFilters = {},
    limit: number = DEFAULT_LIMIT,
    offset: number = DEFAULT_OFFSET
  ): Promise<Result<CollectionAccount[]>> {
    try {
      const rawRecords = await this.prisma.collectionAccount.findMany(
        {
          where: this.buildWhere(filters),
          include: { lineItems: true, paymentAccounts: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }
      );

      const collectionAccounts: CollectionAccount[] = [];
      for (const raw of rawRecords) {
        const domainResult =
          CollectionAccountPrismaMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<CollectionAccount[]>(
            `Failed to map collection account: ${domainResult.error}`
          );
        }
        collectionAccounts.push(domainResult.value);
      }
      return Result.ok<CollectionAccount[]>(collectionAccounts);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<CollectionAccount[]>(
        `Database error finding collection accounts: ${errorMessage}`
      );
    }
  }

  public async count(
    filters: CollectionAccountFilters = {}
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.collectionAccount.count({
        where: this.buildWhere(filters)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting collection accounts: ${errorMessage}`
      );
    }
  }

  private buildWhere(filters: CollectionAccountFilters): {
    customerId?: string;
    status?: CollectionAccountStatus;
  } {
    const where: {
      customerId?: string;
      status?: CollectionAccountStatus;
    } = {};

    if (filters.customerId) {
      where.customerId = filters.customerId.toString();
    }
    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }
}
