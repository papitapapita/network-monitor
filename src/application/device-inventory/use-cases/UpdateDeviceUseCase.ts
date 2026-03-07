import { IDeviceRepository } from '../../../domain/device-inventory/repository/IDeviceRepository';
import { DeviceStatus } from '../../../domain/device-inventory/value-objects/DeviceStatus';
import { DeviceCategory } from '../../../domain/device-inventory/value-objects/DeviceCategory';
import { MACAddress } from '../../../domain/device-inventory/value-objects/MACAddress';
import { IPAddress } from '../../../domain/device-inventory/value-objects/IPAddress';
import { DeviceOwnerType } from '../../../domain/device-inventory/enums/DeviceOwnerType';
import { DeviceId, LocationId } from '../../../domain/shared/ids';
import { Result } from '../../../domain/shared/core/Result';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { UpdateDeviceRequestDTO } from '../dtos/UpdateDeviceRequestDTO';
import { DeviceResponseDTO } from '../dtos/DeviceResponseDTO';
import { DeviceMapper } from '../mappers/DeviceMapper';

/**
 * UpdateDeviceUseCase
 *
 * Business Intent: Apply a partial update (PATCH semantics) to an existing physical
 * device asset in the inventory. Only fields that are explicitly provided in the
 * request are changed; all omitted fields are left unchanged.
 *
 * Flow:
 * 1. beforeExecute: Validate the id is non-empty and that any provided enum fields
 *    (ownerType, status, category) contain a recognised value. This prevents
 *    corrupted domain calls before any I/O takes place.
 * 2. executeImpl:
 *    a. Parse DeviceId and look up the device — return failure if not found.
 *    b. Apply status change via device.changeStatus() when status is provided.
 *    c. Apply location assignment/unassignment via device.assignLocation() when
 *       locationId is provided (null means unassign).
 *    d. Toggle monitoring via device.enableMonitoring() / device.disableMonitoring()
 *       when monitoringEnabled is provided.
 *    e. Build the updateDetails fields object and enforce MAC/IP uniqueness against
 *       the repository (skipping the check when the address is already held by
 *       this device — same-device change does not violate uniqueness).
 *    f. Call device.updateDetails() when any updatable detail field is present.
 *    g. Persist via IDeviceRepository and return a DeviceResponseDTO.
 *
 * Business Rules:
 * - id is required.
 * - A decommissioned device cannot change its status (terminal state, enforced by domain).
 * - MAC address must be unique — only fails if the MAC is held by a *different* device.
 * - IP address must be unique — only fails if the IP is held by a *different* device.
 * - Passing null for locationId, macAddress, ipAddress, serialNumber, category,
 *   description, or installedDate explicitly clears those fields.
 * - Domain events (DeviceStatusChangedEvent, DeviceLocationAssignedEvent, etc.)
 *   are dispatched by the repository after the aggregate is persisted.
 *
 * Dependencies:
 * - IDeviceRepository: Load, persist, and check uniqueness for the Device aggregate.
 * - ILogger: Structured logging via the base UseCase template.
 *
 * @example
 * ```typescript
 * const useCase = new UpdateDeviceUseCase(deviceRepository, logger);
 * const result = await useCase.execute({
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   status: 'ACTIVE',
 *   locationId: '550e8400-e29b-41d4-a716-446655440001',
 *   monitoringEnabled: true
 * });
 * ```
 */
export class UpdateDeviceUseCase extends UseCase<
  UpdateDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateDeviceUseCase');
  }

  // ============================================================================
  // Pre-execution validation
  // ============================================================================

  /**
   * Validates the inbound DTO before any domain or I/O work begins.
   *
   * Checks performed here (not in executeImpl) because they are
   * boundary-level rejections that do not require loading the aggregate:
   * - id presence (required)
   * - ownerType enum membership (when provided)
   * - status validity via DeviceStatus.create() (when provided)
   * - category validity via DeviceCategory.create() (when provided)
   *
   * The domain's own Guard clauses inside command methods provide a second
   * layer of defence; both layers are intentional (defence-in-depth).
   */
  protected async beforeExecute(
    request: UpdateDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    if (request.ownerType !== undefined) {
      const validOwnerTypes = Object.values(DeviceOwnerType) as string[];
      if (!validOwnerTypes.includes(request.ownerType.toUpperCase())) {
        return Result.fail(
          `Invalid ownerType: "${request.ownerType}". Must be one of: ${validOwnerTypes.join(', ')}`
        );
      }
    }

    if (request.status !== undefined) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return Result.fail(statusResult.error!);
      }
    }

    if (request.category !== undefined && request.category !== null) {
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
   * Orchestrates the device update.
   *
   * Steps:
   * 1. Parse DeviceId from request.id.
   * 2. Load the device from the repository — return failure if not found.
   * 3. Apply status change when provided.
   * 4. Apply location assignment (or unassignment) when locationId is provided.
   * 5. Toggle monitoring when monitoringEnabled is provided.
   * 6. Build MACAddress and IPAddress value objects, enforcing uniqueness while
   *    excluding the current device's own addresses from the conflict check.
   * 7. Build the updateDetails fields and call device.updateDetails() when any
   *    detail field is present.
   * 8. Persist the updated aggregate and return a DeviceResponseDTO.
   *
   * No domain logic lives here — all invariants are enforced inside the
   * Device aggregate and its value objects.
   */
  protected async executeImpl(
    request: UpdateDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    // Parse DeviceId UUID
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    // Load existing device
    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Device not found: ${request.id}`);
    }

    const device = findResult.value;

    // Build updateDetails fields
    // Only populate keys whose corresponding request fields are not undefined.
    const updateFields: Parameters<typeof device.updateDetails>[0] = {};

    if (request.name !== undefined) {
      updateFields.name = request.name;
    }

    if (request.description !== undefined) {
      updateFields.description = request.description;
    }

    if (request.ownerType !== undefined) {
      updateFields.ownerType =
        request.ownerType.toUpperCase() as DeviceOwnerType;
    }

    if (request.installedDate !== undefined) {
      if (request.installedDate === null) {
        updateFields.installedDate = null;
      } else {
        const parsed = new Date(request.installedDate);
        if (isNaN(parsed.getTime())) {
          return this.fail(
            `Invalid installedDate: "${request.installedDate}". Must be a valid ISO 8601 date string.`
          );
        }
        updateFields.installedDate = parsed;
      }
    }

    if (request.category !== undefined) {
      if (request.category === null) {
        updateFields.category = null;
      } else {
        const categoryResult = DeviceCategory.create(request.category);
        if (categoryResult.isFailure) {
          return this.fail(categoryResult.error!);
        }
        updateFields.category = categoryResult.value;
      }
    }

    if (request.serialNumber !== undefined) {
      // Pass raw string (including null) — the aggregate's updateDetails
      // handles SerialNumber construction internally for non-null values.
      updateFields.serialNumber = request.serialNumber;
    }

    // Build MACAddress and check uniqueness (skip if unchanged on this device)
    if (request.macAddress !== undefined) {
      if (request.macAddress === null) {
        updateFields.macAddress = null;
      } else {
        const macResult = MACAddress.create(request.macAddress);
        if (macResult.isFailure) {
          return this.fail(macResult.error!);
        }
        const newMac = macResult.value;

        // Only enforce uniqueness when the MAC differs from the device's current value
        const currentMac = device.macAddress?.value ?? null;
        if (currentMac !== newMac.value) {
          const macExistsResult =
            await this.deviceRepository.existsByMacAddress(newMac);
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

        updateFields.macAddress = newMac;
      }
    }

    // Build IPAddress and check uniqueness (skip if unchanged on this device)
    if (request.ipAddress !== undefined) {
      if (request.ipAddress === null) {
        updateFields.ipAddress = null;
      } else {
        const ipResult = IPAddress.create(request.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(ipResult.error!);
        }
        const newIp = ipResult.value;

        // Only enforce uniqueness when the IP differs from the device's current value
        const currentIp = device.ipAddress?.value ?? null;
        if (currentIp !== newIp.value) {
          const ipExistsResult =
            await this.deviceRepository.existsByIpAddress(newIp);
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

        updateFields.ipAddress = newIp;
      }
    }

    // Apply detail updates first so that IP/MAC are set before any
    // status transition is validated by the aggregate.
    if (Object.keys(updateFields).length > 0) {
      const updateResult = device.updateDetails(updateFields);
      if (updateResult.isFailure) {
        return this.fail(updateResult.error!);
      }
    }

    // Apply status change (after updateDetails so IP is present if being set
    // in the same request as an INVENTORY → ACTIVE transition)
    if (request.status !== undefined) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return this.fail(statusResult.error!);
      }
      const changeStatusResult = device.changeStatus(statusResult.value);
      if (changeStatusResult.isFailure) {
        return this.fail(changeStatusResult.error!);
      }
    }

    // Apply location assignment or unassignment
    // locationId in the DTO is `string | null | undefined`:
    //   undefined  → field was not sent; skip
    //   null       → explicit unassign
    //   string     → assign to new location
    if (request.locationId !== undefined) {
      let newLocationId: LocationId | null = null;
      if (request.locationId !== null) {
        const locationIdResult = LocationId.parse(
          request.locationId.trim()
        );
        if (locationIdResult.isFailure) {
          return this.fail(
            `Invalid locationId: ${locationIdResult.error}`
          );
        }
        newLocationId = locationIdResult.value;
      }
      const assignResult = device.assignLocation(newLocationId);
      if (assignResult.isFailure) {
        return this.fail(assignResult.error!);
      }
    }

    // Toggle monitoring
    if (request.monitoringEnabled === true) {
      const enableResult = device.enableMonitoring();
      if (enableResult.isFailure) {
        return this.fail(enableResult.error!);
      }
    } else if (request.monitoringEnabled === false) {
      const disableResult = device.disableMonitoring();
      if (disableResult.isFailure) {
        return this.fail(disableResult.error!);
      }
    }

    // Persist — domain events are dispatched by the repository implementation
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist device: ${saveResult.error}`);
    }

    return this.ok(DeviceMapper.toDTO(saveResult.value));
  }
}
