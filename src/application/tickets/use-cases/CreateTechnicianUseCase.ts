import {
  Technician,
  ITechnicianRepository,
  ContactPhone
} from 'domain/tickets';
import { UserId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TechnicianMapper } from '../mappers';
import {
  CreateTechnicianRequestDTO,
  TechnicianResponseDTO
} from '../dtos';

export class CreateTechnicianUseCase extends UseCase<
  CreateTechnicianRequestDTO,
  TechnicianResponseDTO
> {
  constructor(
    private readonly technicianRepository: ITechnicianRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateTechnicianUseCase');
  }

  protected async beforeExecute(
    request: CreateTechnicianRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.fullName || request.fullName.trim().length === 0) {
      return Result.fail('Technician name is required');
    }
    if (!request.phone || request.phone.trim().length === 0) {
      return Result.fail('Technician phone is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateTechnicianRequestDTO
  ): Promise<Result<TechnicianResponseDTO>> {
    const phoneResult = ContactPhone.create(request.phone);
    if (phoneResult.isFailure) {
      return this.fail(phoneResult.error!);
    }

    const phoneExists = await this.technicianRepository.existsByPhone(
      phoneResult.value.toString()
    );
    if (phoneExists.isFailure) {
      return this.fail(phoneExists.error!);
    }
    if (phoneExists.value) {
      return this.fail(
        `A technician with phone "${phoneResult.value.toString()}" already exists`
      );
    }

    const email =
      request.email === undefined || request.email === null
        ? null
        : request.email.trim().toLowerCase();

    if (email !== null && email.length > 0) {
      const emailExists =
        await this.technicianRepository.existsByEmail(email);
      if (emailExists.isFailure) {
        return this.fail(emailExists.error!);
      }
      if (emailExists.value) {
        return this.fail(
          `A technician with email "${email}" already exists`
        );
      }
    }

    let userId: UserId | null = null;
    if (request.userId !== undefined && request.userId !== null) {
      const userIdResult = UserId.parse(request.userId);
      if (userIdResult.isFailure) {
        return this.fail(`Invalid user ID: ${userIdResult.error}`);
      }
      userId = userIdResult.value;
    }

    const technicianResult = Technician.create({
      fullName: request.fullName,
      phone: phoneResult.value,
      email: email !== null && email.length > 0 ? email : null,
      userId,
      isActive: request.isActive
    });
    if (technicianResult.isFailure) {
      return this.fail(technicianResult.error!);
    }

    const saveResult = await this.technicianRepository.save(
      technicianResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist technician: ${saveResult.error}`
      );
    }

    return this.ok(TechnicianMapper.toDTO(saveResult.value));
  }
}
