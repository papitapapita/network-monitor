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
import {
  CreateCustomerRequestDTO,
  CustomerResponseDTO
} from '../dtos';

export class CreateCustomerUseCase extends UseCase<
  CreateCustomerRequestDTO,
  CustomerResponseDTO
> {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateCustomerUseCase');
  }

  protected async beforeExecute(
    request: CreateCustomerRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.fullName || request.fullName.trim().length === 0) {
      return Result.fail('Customer name is required');
    }
    if (!request.phone || request.phone.trim().length === 0) {
      return Result.fail('Customer phone is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateCustomerRequestDTO
  ): Promise<Result<CustomerResponseDTO>> {
    const data = CustomerMapper.extractCreateData(request);

    const phoneResult = PhoneNumber.create(data.phone);
    if (phoneResult.isFailure) {
      return this.fail(phoneResult.error!);
    }

    let email: EmailAddress | null = null;
    if (data.email !== null) {
      const emailResult = EmailAddress.create(data.email);
      if (emailResult.isFailure) {
        return this.fail(emailResult.error!);
      }
      email = emailResult.value;
    }

    let cedula: Cedula | null = null;
    if (data.cedula !== null) {
      const cedulaResult = Cedula.create(data.cedula);
      if (cedulaResult.isFailure) {
        return this.fail(cedulaResult.error!);
      }
      cedula = cedulaResult.value;
    }

    const uniqueCheck = await this.ensureUnique(
      phoneResult.value,
      email,
      cedula
    );
    if (uniqueCheck.isFailure) {
      return this.fail(uniqueCheck.error!);
    }

    const customerResult = Customer.create({
      fullName: data.fullName.trim(),
      phone: phoneResult.value,
      email,
      cedula
    });
    if (customerResult.isFailure) {
      return this.fail(customerResult.error!);
    }

    const saveResult = await this.customerRepository.save(
      customerResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist customer: ${saveResult.error}`
      );
    }

    return this.ok(CustomerMapper.toDTO(saveResult.value));
  }

  private async ensureUnique(
    phone: PhoneNumber,
    email: EmailAddress | null,
    cedula: Cedula | null
  ): Promise<Result<void>> {
    const phoneExists = await this.customerRepository.existsByPhone(
      phone.toString()
    );
    if (phoneExists.isFailure) return Result.fail(phoneExists.error!);
    if (phoneExists.value) {
      return Result.fail(
        `A customer with phone "${phone.toString()}" already exists`
      );
    }

    if (email !== null) {
      const emailExists = await this.customerRepository.existsByEmail(
        email.toString()
      );
      if (emailExists.isFailure)
        return Result.fail(emailExists.error!);
      if (emailExists.value) {
        return Result.fail(
          `A customer with email "${email.toString()}" already exists`
        );
      }
    }

    if (cedula !== null) {
      const cedulaExists =
        await this.customerRepository.existsByCedula(
          cedula.toString()
        );
      if (cedulaExists.isFailure)
        return Result.fail(cedulaExists.error!);
      if (cedulaExists.value) {
        return Result.fail(
          `A customer with cedula "${cedula.toString()}" already exists`
        );
      }
    }

    return Result.ok();
  }
}
