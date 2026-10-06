import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  BillableCustomer,
  IBillableCustomersQuery
} from 'application/billing/interfaces';

export class PrismaBillableCustomersQuery
  implements IBillableCustomersQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async listBillable(): Promise<Result<BillableCustomer[]>> {
    try {
      const rows = await this.prisma.customer.findMany({
        where: { contractedServices: { some: { status: 'ACTIVE' } } },
        select: { id: true, paymentDay: true },
        orderBy: { createdAt: 'asc' }
      });
      return Result.ok(
        rows.map((r) => ({
          customerId: r.id,
          paymentDay: r.paymentDay
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing billable customers: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
