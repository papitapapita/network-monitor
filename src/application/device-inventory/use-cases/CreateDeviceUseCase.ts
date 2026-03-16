import { IPAddress } from 'domain/shared';
import { Device } from 'domain/device-inventory/aggregates';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { DeviceModelId, LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { CreateDeviceRequestDTO, DeviceResponseDTO } from '../dtos';
import { DeviceMapper } from '../mappers';
import {
  DeviceStatus,
  DeviceCategory,
  SerialNumber,
  MACAddress,
  DeviceName
} from 'domain/device-inventory/value-objects';

/**
 * CreateDeviceUseCase
 *
 * Business Intent: Register a new physical device asset in the inventory system.
 *
 * Flow:
 * 1. beforeExecute: Validate required fields and enum membership for ownerType,
 *    status, and category. Prevents corrupted aggregates from reaching the domain.
 * 2. executeImpl: Parse IDs, build value objects, enforce MAC/IP uniqueness,
 *    delegate aggregate construction to Device.create(), persist via
 *    IDeviceRepository, and return a DeviceResponseDTO.
 *
 * Business Rules:
 * - deviceModelId, name, and ownerType are required.
 * - status defaults to INVENTORY when omitted.
 * - monitoringEnabled defaults to false when omitted.
 * - MAC address must be unique across all devices (enforced before save).
 * - IP address must be unique across all devices (enforced before save).
 * - Domain events (DeviceCreatedEvent) are dispatched by the repository
 *   after the aggregate is persisted.
 *
 * Dependencies:
 * - IDeviceRepository: Persist the Device aggregate and check uniqueness.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example
 * ```typescript
 * const useCase = new CreateDeviceUseCase(deviceRepository, logger);
 * const result = await useCase.execute({
 *   deviceModelId: '550e8400-e29b-41d4-a716-446655440000',
 *   name: 'Core-Router-01',
 *   ownerType: 'COMPANY',
 *   status: 'ACTIVE',
 *   category: 'CORE',
 *   macAddress: 'AA:BB:CC:DD:EE:FF',
 *   ipAddress: '192.168.1.1',
 *   monitoringEnabled: true
 * });
 * ```
 */
export class CreateDeviceUseCase extends UseCase<
  CreateDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateDeviceUseCase');
  }

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  /**
   * Validates the inbound DTO before domain construction begins.
   *
   * Checks performed here (not in executeImpl) because they are
   * boundary-level rejections that do not require domain object creation:
   * - Required field presence (deviceModelId, name, ownerType)
   * - Enum membership for ownerType, status, and category
   *
   * The domain's own Guard clauses (inside Device.create) provide a second
   * layer of defence; both layers are intentional (defence-in-depth).
   */
  protected async beforeExecute(
    request: CreateDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (
      !request.deviceModelId ||
      request.deviceModelId.trim().length === 0
    ) {
      return Result.fail('deviceModelId is required');
    }

    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Device name is required');
    }

    if (!request.ownerType) {
      return Result.fail('ownerType is required');
    }

    const validOwnerTypes = Object.values(
      DeviceOwnerType
    ) as string[];
    if (!validOwnerTypes.includes(request.ownerType.toUpperCase())) {
      return Result.fail(
        `Invalid ownerType: "${request.ownerType}". Must be one of: ${validOwnerTypes.join(', ')}`
      );
    }

    if (request.status) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return Result.fail(statusResult.error!);
      }
    }

    if (request.category) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return Result.fail(categoryResult.error!);
      }
    }

    return null; // Validation passed
  }

  // ============================================================================
  // Main execution
  // ============================================================================

  /**
   * Orchestrates device creation.
   *
   * Steps:
   * 1. Parse deviceModelId and optional locationId UUIDs.
   * 2. Build required value objects (DeviceName, DeviceStatus).
   * 3. Build optional value objects (DeviceCategory, SerialNumber, MACAddress, IPAddress).
   * 4. Enforce MAC and IP uniqueness against the repository.
   * 5. Parse optional installedDate.
   * 6. Delegate aggregate construction to Device.create().
   * 7. Persist the aggregate via IDeviceRepository.
   * 8. Transform the persisted aggregate to a response DTO via DeviceMapper.
   *
   * No domain logic lives here — all invariants are enforced inside the
   * Device aggregate and its value objects.
   */
  protected async executeImpl(
    request: CreateDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    // Parse deviceModelId UUID
    const deviceModelIdResult = DeviceModelId.parse(
      request.deviceModelId.trim()
    );
    if (deviceModelIdResult.isFailure) {
      return this.fail(
        `Invalid deviceModelId: ${deviceModelIdResult.error}`
      );
    }

    // Parse optional locationId UUID
    let locationId: LocationId | null = null;
    if (request.locationId) {
      const locationIdResult = LocationId.parse(
        request.locationId.trim()
      );
      if (locationIdResult.isFailure) {
        return this.fail(
          `Invalid locationId: ${locationIdResult.error}`
        );
      }
      locationId = locationIdResult.value;
    }

    // Build DeviceName value object
    const nameResult = DeviceName.create(request.name);
    if (nameResult.isFailure) {
      return this.fail(nameResult.error!);
    }

    // Build DeviceStatus value object — defaults to INVENTORY
    const statusResult = DeviceStatus.create(
      request.status ?? DeviceStatus.INVENTORY
    );
    if (statusResult.isFailure) {
      return this.fail(statusResult.error!);
    }

    // Build optional DeviceCategory value object
    let category: DeviceCategory | null = null;
    if (request.category) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return this.fail(categoryResult.error!);
      }
      category = categoryResult.value;
    }

    // Build optional SerialNumber value object
    let serialNumber: SerialNumber | null = null;
    if (request.serialNumber) {
      const serialNumberResult = SerialNumber.create(
        request.serialNumber
      );
      if (serialNumberResult.isFailure) {
        return this.fail(serialNumberResult.error!);
      }
      serialNumber = serialNumberResult.value;
    }

    // Build optional MACAddress and enforce uniqueness
    let macAddress: MACAddress | null = null;
    if (request.macAddress) {
      const macResult = MACAddress.create(request.macAddress);
      if (macResult.isFailure) {
        return this.fail(macResult.error!);
      }
      macAddress = macResult.value;

      const macExistsResult =
        await this.deviceRepository.existsByMacAddress(macAddress);
      if (macExistsResult.isFailure) {
        return this.fail(
          `Failed to check MAC address uniqueness: ${macExistsResult.error}`
        );
      }
      if (macExistsResult.value) {
        return this.fail(
          `MAC address "${request.macAddress}" is already assigned to another device`
        );
      }
    }

    // Build optional IPAddress and enforce uniqueness
    let ipAddress: IPAddress | null = null;
    if (request.ipAddress) {
      const ipResult = IPAddress.create(request.ipAddress);
      if (ipResult.isFailure) {
        return this.fail(ipResult.error!);
      }
      ipAddress = ipResult.value;

      const ipExistsResult =
        await this.deviceRepository.existsByIpAddress(ipAddress);
      if (ipExistsResult.isFailure) {
        return this.fail(
          `Failed to check IP address uniqueness: ${ipExistsResult.error}`
        );
      }
      if (ipExistsResult.value) {
        return this.fail(
          `IP address "${request.ipAddress}" is already assigned to another device`
        );
      }
    }

    // Parse optional installedDate from ISO 8601 string
    let installedDate: Date | null = null;
    if (request.installedDate) {
      const parsed = new Date(request.installedDate);
      if (isNaN(parsed.getTime())) {
        return this.fail(
          `Invalid installedDate: "${request.installedDate}". Must be a valid ISO 8601 date string.`
        );
      }
      installedDate = parsed;
    }

    // Delegate aggregate construction to the domain — no business logic here
    const deviceResult = Device.create({
      deviceModelId: deviceModelIdResult.value,
      locationId,
      name: nameResult.value,
      status: statusResult.value,
      category,
      ownerType: request.ownerType.toUpperCase() as DeviceOwnerType,
      serialNumber,
      macAddress,
      ipAddress,
      description: request.description ?? null,
      installedDate,
      monitoringEnabled: request.monitoringEnabled ?? false
    });

    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error!);
    }

    const device = deviceResult.value;

    // Persist — domain events are dispatched by the repository implementation
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist device: ${saveResult.error}`
      );
    }

    return this.ok(DeviceMapper.toDTO(saveResult.value));
  }
}
