import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  BillableService,
  IBillableServicesQuery
} from 'application/billing/interfaces';

export class PrismaBillableServicesQuery
  implements IBillableServicesQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async listBillable(): Promise<Result<BillableService[]>> {
    try {
      const rows = await this.prisma.contractedService.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          customerId: true,
          paymentDay: true,
          startDate: true
        },
        orderBy: { createdAt: 'asc' }
      });
      return Result.ok(
        rows.map((r) => ({
          contractedServiceId: r.id,
          customerId: r.customerId,
          paymentDay: r.paymentDay,
          startDate: r.startDate.toISOString()
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing billable services: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
