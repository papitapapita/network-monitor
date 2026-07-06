import { CustomerId } from 'domain/shared/ids';
import {
  Customer,
  PhoneNumber,
  Cedula,
  EmailAddress
} from 'domain/customers';
import { ICustomerRepository } from 'domain/customers/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CustomerMapper } from '../mappers';
import { UpdateCustomerRequestDTO, CustomerResponseDTO } from '../dtos';

export class UpdateCustomerUseCase extends UseCase<
  UpdateCustomerRequestDTO,
  CustomerResponseDTO
> {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateCustomerUseCase');
  }

  protected async beforeExecute(
    request: UpdateCustomerRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Customer ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateCustomerRequestDTO
  ): Promise<Result<CustomerResponseDTO>> {
    const idResult = CustomerId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid customer ID: ${idResult.error}`);
    }

    const findResult = await this.customerRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Customer not found: ${request.id}`);
    }

    const customer = findResult.value;
    const data = CustomerMapper.extractUpdateData(request);

    if (data.fullName !== undefined) {
      const renameResult = customer.rename(data.fullName);
      if (renameResult.isFailure) {
        return this.fail(renameResult.error!);
      }
    }

    if (data.phone !== undefined) {
      const phoneResult = PhoneNumber.create(data.phone);
      if (phoneResult.isFailure) {
        return this.fail(phoneResult.error!);
      }
      const uniqueResult = await this.ensureUnique(
        'phone',
        phoneResult.value.toString(),
        customer
      );
      if (uniqueResult.isFailure) {
        return this.fail(uniqueResult.error!);
      }
      const changeResult = customer.changePhone(phoneResult.value);
      if (changeResult.isFailure) {
        return this.fail(changeResult.error!);
      }
    }

    if (data.email !== undefined) {
      let email: EmailAddress | null = null;
      if (data.email !== null) {
        const emailResult = EmailAddress.create(data.email);
        if (emailResult.isFailure) {
          return this.fail(emailResult.error!);
        }
        email = emailResult.value;
        const uniqueResult = await this.ensureUnique(
          'email',
          email.toString(),
          customer
        );
        if (uniqueResult.isFailure) {
          return this.fail(uniqueResult.error!);
        }
      }
      const changeResult = customer.changeEmail(email);
      if (changeResult.isFailure) {
        return this.fail(changeResult.error!);
      }
    }

    if (data.cedula !== undefined) {
      let cedula: Cedula | null = null;
      if (data.cedula !== null) {
        const cedulaResult = Cedula.create(data.cedula);
        if (cedulaResult.isFailure) {
          return this.fail(cedulaResult.error!);
        }
        cedula = cedulaResult.value;
        const uniqueResult = await this.ensureUnique(
          'cedula',
          cedula.toString(),
          customer
        );
        if (uniqueResult.isFailure) {
          return this.fail(uniqueResult.error!);
        }
      }
      const changeResult = customer.changeCedula(cedula);
      if (changeResult.isFailure) {
        return this.fail(changeResult.error!);
      }
    }

    const saveResult = await this.customerRepository.save(customer);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist customer: ${saveResult.error}`);
    }

    return this.ok(CustomerMapper.toDTO(saveResult.value));
  }

  // Ensures no *other* customer already owns the given unique value.
  private async ensureUnique(
    field: 'phone' | 'email' | 'cedula',
    value: string,
    customer: Customer
  ): Promise<Result<void>> {
    const lookup =
      field === 'phone'
        ? this.customerRepository.findByPhone(value)
        : field === 'email'
          ? this.customerRepository.findByEmail(value)
          : this.customerRepository.findByCedula(value);

    const existing = await lookup;
    if (existing.isFailure) return Result.fail(existing.error!);
    if (
      existing.value !== null &&
      !existing.value.id.equals(customer.id)
    ) {
      return Result.fail(
        `A customer with ${field} "${value}" already exists`
      );
    }
    return Result.ok();
  }
}
