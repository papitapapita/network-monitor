import { Result } from 'domain/shared/core';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { ContractedService } from 'domain/customers/aggregates';
import { ContractedServiceStatus } from 'domain/customers/enums';
import { ContractedServiceStatus as PrismaContractedServiceStatus } from 'generated/prisma/client';

interface ContractedServiceRecord {
  id: string;
  customerId: string;
  servicePlanId: string;
  deviceId: string | null;
  status: string;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ContractedServicePrismaMapper {
  public static toDomain(
    raw: ContractedServiceRecord
  ): Result<ContractedService> {
    const idResult = ContractedServiceId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<ContractedService>(
        `Invalid contracted service id: ${idResult.error}`
      );
    }

    const customerIdResult = CustomerId.parse(raw.customerId);
    if (customerIdResult.isFailure) {
      return Result.fail<ContractedService>(
        `Invalid customer id: ${customerIdResult.error}`
      );
    }

    const servicePlanIdResult = ServicePlanId.parse(
      raw.servicePlanId
    );
    if (servicePlanIdResult.isFailure) {
      return Result.fail<ContractedService>(
        `Invalid service plan id: ${servicePlanIdResult.error}`
      );
    }

    let deviceId: DeviceId | null = null;
    if (raw.deviceId !== null) {
      const deviceIdResult = DeviceId.parse(raw.deviceId);
      if (deviceIdResult.isFailure) {
        return Result.fail<ContractedService>(
          `Invalid device id: ${deviceIdResult.error}`
        );
      }
      deviceId = deviceIdResult.value;
    }

    return Result.ok<ContractedService>(
      ContractedService.reconstitute(idResult.value, {
        customerId: customerIdResult.value,
        servicePlanId: servicePlanIdResult.value,
        deviceId,
        status: this.mapStatusFromPrisma(raw.status),
        startDate: raw.startDate,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(service: ContractedService): {
    id: string;
    customerId: string;
    servicePlanId: string;
    deviceId: string | null;
    status: PrismaContractedServiceStatus;
    startDate: Date;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: service.id.toString(),
      customerId: service.customerId.toString(),
      servicePlanId: service.servicePlanId.toString(),
      deviceId:
        service.deviceId !== null
          ? service.deviceId.toString()
          : null,
      status: this.mapStatusToPrisma(service.status),
      startDate: service.startDate,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };
  }

  // throws on unrecognised value — the repo's try/catch surfaces it as Result.fail
  private static mapStatusFromPrisma(
    status: string
  ): ContractedServiceStatus {
    switch (status) {
      case 'PENDING':
        return ContractedServiceStatus.PENDING;
      case 'ACTIVE':
        return ContractedServiceStatus.ACTIVE;
      case 'SUSPENDED':
        return ContractedServiceStatus.SUSPENDED;
      case 'CANCELLED':
        return ContractedServiceStatus.CANCELLED;
      default:
        throw new Error(
          `Data integrity violation: unrecognised ContractedServiceStatus "${status}" in persistence store`
        );
    }
  }

  private static mapStatusToPrisma(
    status: ContractedServiceStatus
  ): PrismaContractedServiceStatus {
    switch (status) {
      case ContractedServiceStatus.PENDING:
        return 'PENDING';
      case ContractedServiceStatus.ACTIVE:
        return 'ACTIVE';
      case ContractedServiceStatus.SUSPENDED:
        return 'SUSPENDED';
      case ContractedServiceStatus.CANCELLED:
        return 'CANCELLED';
      default:
        throw new Error(
          `Unknown domain ContractedServiceStatus: ${status}`
        );
    }
  }
}
