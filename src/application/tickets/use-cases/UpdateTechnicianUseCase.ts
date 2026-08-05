import {
  Technician,
  ITechnicianRepository,
  ContactPhone
} from 'domain/tickets';
import { TechnicianId, UserId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TechnicianMapper } from '../mappers';
import {
  UpdateTechnicianRequestDTO,
  TechnicianResponseDTO
} from '../dtos';

export class UpdateTechnicianUseCase extends UseCase<
  UpdateTechnicianRequestDTO,
  TechnicianResponseDTO
> {
  constructor(
    private readonly technicianRepository: ITechnicianRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateTechnicianUseCase');
  }

  protected async beforeExecute(
    request: UpdateTechnicianRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Technician ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateTechnicianRequestDTO
  ): Promise<Result<TechnicianResponseDTO>> {
    const idResult = TechnicianId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid technician ID: ${idResult.error}`);
    }

    const findResult = await this.technicianRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Technician not found: ${request.id}`);
    }

    const technician = findResult.value;

    if (request.fullName !== undefined) {
      const result = technician.rename(request.fullName);
      if (result.isFailure) {
        return this.fail(result.error!);
      }
    }

    if (request.phone !== undefined) {
      const phoneResult = await this.applyPhone(
        technician,
        request.phone
      );
      if (phoneResult.isFailure) {
        return this.fail(phoneResult.error!);
      }
    }

    if (request.email !== undefined) {
      const emailResult = await this.applyEmail(
        technician,
        request.email
      );
      if (emailResult.isFailure) {
        return this.fail(emailResult.error!);
      }
    }

    if (request.userId !== undefined) {
      let userId: UserId | null = null;
      if (request.userId !== null) {
        const parsed = UserId.parse(request.userId);
        if (parsed.isFailure) {
          return this.fail(`Invalid user ID: ${parsed.error}`);
        }
        userId = parsed.value;
      }
      const result = technician.linkUser(userId);
      if (result.isFailure) {
        return this.fail(result.error!);
      }
    }

    if (request.isActive !== undefined) {
      const result = request.isActive
        ? technician.activate()
        : technician.deactivate();
      if (result.isFailure) {
        return this.fail(result.error!);
      }
    }

    const saveResult =
      await this.technicianRepository.save(technician);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist technician: ${saveResult.error}`
      );
    }

    return this.ok(TechnicianMapper.toDTO(saveResult.value));
  }

  private async applyPhone(
    technician: Technician,
    phone: string
  ): Promise<Result<void>> {
    const phoneResult = ContactPhone.create(phone);
    if (phoneResult.isFailure) {
      return Result.fail(phoneResult.error);
    }

    const normalized = phoneResult.value.toString();

    // Keeping your own number is not a collision.
    if (technician.phone.toString() !== normalized) {
      const existing =
        await this.technicianRepository.findByPhone(normalized);
      if (existing.isFailure) {
        return Result.fail(existing.error!);
      }
      if (
        existing.value !== null &&
        !existing.value.id.equals(technician.id)
      ) {
        return Result.fail(
          `A technician with phone "${normalized}" already exists`
        );
      }
    }

    return technician.changePhone(phoneResult.value);
  }

  private async applyEmail(
    technician: Technician,
    email: string | null
  ): Promise<Result<void>> {
    const normalized =
      email === null || email.trim().length === 0
        ? null
        : email.trim().toLowerCase();

    if (normalized !== null && technician.email !== normalized) {
      const exists =
        await this.technicianRepository.existsByEmail(normalized);
      if (exists.isFailure) {
        return Result.fail(exists.error!);
      }
      if (exists.value) {
        return Result.fail(
          `A technician with email "${normalized}" already exists`
        );
      }
    }

    return technician.changeEmail(normalized);
  }
}
