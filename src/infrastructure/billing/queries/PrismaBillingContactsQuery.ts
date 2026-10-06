import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  BillingContact,
  IBillingContactsQuery
} from 'application/billing/interfaces';

export class PrismaBillingContactsQuery
  implements IBillingContactsQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async findContact(
    customerId: string
  ): Promise<Result<BillingContact | null>> {
    try {
      const row = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { fullName: true, phone: true, email: true }
      });
      return Result.ok(row);
    } catch (error) {
      return Result.fail(
        `Database error reading the customer's contact: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
