import { Result } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import { Customer } from 'domain/customers/aggregates';
import {
  PhoneNumber,
  Cedula,
  EmailAddress
} from 'domain/customers/value-objects';

interface CustomerRecord {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerPrismaMapper {
  public static toDomain(raw: CustomerRecord): Result<Customer> {
    const idResult = CustomerId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Customer>(
        `Invalid customer id: ${idResult.error}`
      );
    }

    return Result.ok<Customer>(
      Customer.reconstitute(idResult.value, {
        fullName: raw.fullName,
        phone: PhoneNumber.reconstitute(raw.phone),
        email:
          raw.email !== null
            ? EmailAddress.reconstitute(raw.email)
            : null,
        cedula:
          raw.cedula !== null
            ? Cedula.reconstitute(raw.cedula)
            : null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(customer: Customer): CustomerRecord {
    return {
      id: customer.id.toString(),
      fullName: customer.fullName,
      phone: customer.phone.toString(),
      email:
        customer.email !== null ? customer.email.toString() : null,
      cedula:
        customer.cedula !== null ? customer.cedula.toString() : null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }
}
