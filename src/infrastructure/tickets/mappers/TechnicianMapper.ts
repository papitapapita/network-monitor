import { Technician, ContactPhone } from 'domain/tickets';
import { TechnicianId, UserId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';

type PrismaTechnicianRecord = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TechnicianPersistenceData = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class TechnicianMapper {
  public static toDomain(
    raw: PrismaTechnicianRecord
  ): Result<Technician> {
    const idResult = TechnicianId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<Technician>(
        `Invalid technician ID: ${idResult.error}`
      );
    }

    let userId: UserId | null = null;
    if (raw.userId !== null) {
      const userIdResult = UserId.parse(raw.userId);
      if (userIdResult.isFailure) {
        return Result.fail<Technician>(
          `Invalid technician user ID: ${userIdResult.error}`
        );
      }
      userId = userIdResult.value;
    }

    const technician = Technician.reconstitute(idResult.value, {
      fullName: raw.fullName,
      phone: ContactPhone.reconstitute(raw.phone),
      email: raw.email,
      userId,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    });

    return Result.ok<Technician>(technician);
  }

  public static toPersistence(
    technician: Technician
  ): TechnicianPersistenceData {
    return {
      id: technician.id.toString(),
      fullName: technician.fullName,
      phone: technician.phone.toString(),
      email: technician.email,
      userId:
        technician.userId !== null
          ? technician.userId.toString()
          : null,
      isActive: technician.isActive,
      createdAt: technician.createdAt,
      updatedAt: technician.updatedAt
    };
  }
}
