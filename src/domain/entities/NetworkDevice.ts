import {
  AggregateRoot,
  UniqueEntityID,
  Result,
  Guard
} from '../shared/kernel';
import {
  NetworkDeviceId,
  PollingConfiguration,
  PollingResult
} from './';
import {
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  PollingInterval
} from '../value-objects';
import {
  NetworkDeviceCreatedEvent,
  NetworkDeviceStatusChangedEvent
} from '../events';

/**
 * NetworkDevice Aggregate Root
 *
 * Represents a network device in the system (router, switch, access point, etc.).
 * This is an aggregate root that manages its own consistency boundaries and
 * raises domain events when significant changes occur.
 *
 * Responsibilities:
 * - Enforce business invariants for network devices
 * - Manage device identification (IP, MAC addresses)
 * - Track device status and type
 * - Emit domain events for polling and status changes
 */

// Enums from database schema
export enum ConnectivityType {
  ETHERNET = 'ETHERNET',
  FIBER_OPTIC = 'FIBER_OPTIC',
  WIRELESS = 'WIRELESS',
  DSL = 'DSL',
  SATELLITE = 'SATELLITE',
  OTHER = 'OTHER'
}

export enum ManagementProtocol {
  SNMP = 'SNMP',
  SSH = 'SSH',
  TELNET = 'TELNET',
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  OTHER = 'OTHER'
}

export interface NetworkDeviceProps {
  name: string;
  deviceType: NetworkDeviceType;
  status: NetworkDeviceStatus;
  description: string | null;
  installDate: Date;
  ipAddress: IPAddress;
  macAddress: MACAddress;
  connectivityType: ConnectivityType;
  managementProtocol: ManagementProtocol;
  managementPort: number;
  enabledRemoteAccess: boolean;
  deviceId: string; // Reference to Device entity
  pollingConfiguration: PollingConfiguration; // Polling configuration entity
  createdAt: Date;
  updatedAt: Date;
}

export class NetworkDevice extends AggregateRoot<NetworkDeviceProps> {
  // Getters for all properties
  get networkDeviceId(): NetworkDeviceId {
    return new NetworkDeviceId(this._id.toValue());
  }

  get name(): string {
    return this.props.name;
  }

  get deviceType(): NetworkDeviceType {
    return this.props.deviceType;
  }

  get status(): NetworkDeviceStatus {
    return this.props.status;
  }

  get description(): string | null {
    return this.props.description;
  }

  get installDate(): Date {
    return this.props.installDate;
  }

  get ipAddress(): IPAddress {
    return this.props.ipAddress;
  }

  get macAddress(): MACAddress {
    return this.props.macAddress;
  }

  get connectivityType(): ConnectivityType {
    return this.props.connectivityType;
  }

  get managementProtocol(): ManagementProtocol {
    return this.props.managementProtocol;
  }

  get managementPort(): number {
    return this.props.managementPort;
  }

  get enabledRemoteAccess(): boolean {
    return this.props.enabledRemoteAccess;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get pollingConfiguration(): PollingConfiguration {
    return this.props.pollingConfiguration;
  }

  private constructor(
    props: NetworkDeviceProps,
    id?: UniqueEntityID
  ) {
    super(props, id);
  }

  /**
   * Creates a new NetworkDevice aggregate.
   *
   * @param props - Network device properties
   * @param id - Optional ID (for reconstitution from database)
   * @returns Result containing NetworkDevice or error message
   */
  public static create(
    props: NetworkDeviceProps,
    id?: UniqueEntityID
  ): Result<NetworkDevice> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.name, 'name'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.againstNullOrUndefined(props.status, 'status'),
      Guard.againstNullOrUndefined(props.ipAddress, 'ipAddress'),
      Guard.againstNullOrUndefined(props.macAddress, 'macAddress'),
      Guard.againstNullOrUndefined(
        props.connectivityType,
        'connectivityType'
      ),
      Guard.againstNullOrUndefined(
        props.managementProtocol,
        'managementProtocol'
      ),
      Guard.againstNullOrUndefined(
        props.managementPort,
        'managementPort'
      ),
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(
        props.pollingConfiguration,
        'pollingConfiguration'
      ),
      Guard.isNumber(props.managementPort, 'managementPort'),
      Guard.inRange(props.managementPort, 1, 65535, 'managementPort')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDevice>(guardResult.message!);
    }

    // Validate name length
    if (props.name.trim().length === 0) {
      return Result.fail<NetworkDevice>(
        'Device name cannot be empty'
      );
    }

    if (props.name.length > 255) {
      return Result.fail<NetworkDevice>(
        'Device name cannot exceed 255 characters'
      );
    }

    // Set default dates if not provided
    const networkDevice = new NetworkDevice(
      {
        ...props,
        installDate: props.installDate || new Date(),
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      id
    );

    // Emit creation event if this is a new device (no ID provided)
    if (!id) {
      networkDevice.addDomainEvent(
        new NetworkDeviceCreatedEvent(
          networkDevice.networkDeviceId,
          networkDevice.name,
          networkDevice.ipAddress.toString(),
          networkDevice.macAddress.toString()
        )
      );
    }

    return Result.ok<NetworkDevice>(networkDevice);
  }

  /**
   * Updates the device status.
   *
   * @param newStatus - New status to set
   * @returns Result indicating success or failure
   */
  public updateStatus(newStatus: NetworkDeviceStatus): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newStatus,
      'status'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldStatus = this.props.status;

    if (oldStatus === newStatus) {
      return Result.ok<void>();
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    // Emit status changed event
    this.addDomainEvent(
      new NetworkDeviceStatusChangedEvent(
        this.networkDeviceId,
        this.name,
        oldStatus,
        newStatus,
        this.ipAddress.toString()
      )
    );

    return Result.ok<void>();
  }

  /**
   * Updates the device name.
   *
   * @param newName - New name for the device
   * @returns Result indicating success or failure
   */
  public updateName(newName: string): Result<void> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newName, 'name'),
      Guard.isString(newName, 'name')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (newName.trim().length === 0) {
      return Result.fail<void>('Device name cannot be empty');
    }

    if (newName.length > 255) {
      return Result.fail<void>(
        'Device name cannot exceed 255 characters'
      );
    }

    this.props.name = newName;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Updates the device description.
   *
   * @param description - New description (can be null)
   * @returns Result indicating success or failure
   */
  public updateDescription(description: string | null): Result<void> {
    if (description !== null && description.length > 1000) {
      return Result.fail<void>(
        'Description cannot exceed 1000 characters'
      );
    }

    this.props.description = description;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Updates the device IP address.
   *
   * @param newIpAddress - New IP address
   * @returns Result indicating success or failure
   */
  public updateIpAddress(newIpAddress: IPAddress): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newIpAddress,
      'ipAddress'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    this.props.ipAddress = newIpAddress;
    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Updates management configuration.
   *
   * @param config - Management configuration
   * @returns Result indicating success or failure
   */
  public updateManagementConfig(config: {
    protocol?: ManagementProtocol;
    port?: number;
    enableRemoteAccess?: boolean;
  }): Result<void> {
    if (config.port !== undefined) {
      const portGuard = Guard.combine([
        Guard.isNumber(config.port, 'port'),
        Guard.inRange(config.port, 1, 65535, 'port')
      ]);

      if (!portGuard.succeeded) {
        return Result.fail<void>(portGuard.message!);
      }

      this.props.managementPort = config.port;
    }

    if (config.protocol !== undefined) {
      this.props.managementProtocol = config.protocol;
    }

    if (config.enableRemoteAccess !== undefined) {
      this.props.enabledRemoteAccess = config.enableRemoteAccess;
    }

    this.props.updatedAt = new Date();

    return Result.ok<void>();
  }

  /**
   * Checks if the device is currently online.
   */
  public isOnline(): boolean {
    return this.props.status === NetworkDeviceStatus.ONLINE;
  }

  /**
   * Checks if the device is currently offline.
   */
  public isOffline(): boolean {
    return this.props.status === NetworkDeviceStatus.OFFLINE;
  }

  /**
   * Checks if the device is in maintenance mode.
   */
  public isInMaintenance(): boolean {
    return this.props.status === NetworkDeviceStatus.MAINTENANCE;
  }

  /**
   * Checks if remote access is enabled.
   */
  public hasRemoteAccessEnabled(): boolean {
    return this.props.enabledRemoteAccess;
  }

  // ============================================================================
  // Polling-related methods
  // ============================================================================

  /**
   * Configures the polling interval for this device.
   *
   * @param interval - New polling interval
   * @returns Result indicating success or failure
   */
  public configurePolling(interval: PollingInterval): Result<void> {
    const updateResult =
      this.props.pollingConfiguration.updateInterval(interval);
    if (!updateResult.isSuccess) {
      return updateResult;
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Updates the ping count for multi-ping polling.
   *
   * @param count - New ping count (1-10)
   * @returns Result indicating success or failure
   */
  public updatePingCount(count: number): Result<void> {
    const updateResult =
      this.props.pollingConfiguration.updatePingCount(count);
    if (!updateResult.isSuccess) {
      return updateResult;
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Enables polling for this device.
   */
  public enablePolling(): Result<void> {
    const enableResult = this.props.pollingConfiguration.enable();
    if (!enableResult.isSuccess) {
      return enableResult;
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Disables polling for this device.
   */
  public disablePolling(): Result<void> {
    const disableResult = this.props.pollingConfiguration.disable();
    if (!disableResult.isSuccess) {
      return disableResult;
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Checks if the device should be polled at the given time.
   *
   * @param currentTime - Current time to check against
   * @returns True if device should be polled now
   */
  public shouldPoll(currentTime: Date): boolean {
    return this.props.pollingConfiguration.canPoll(currentTime);
  }

  /**
   * Updates the device state based on a polling result.
   * This method is called after each poll to update device status.
   *
   * @param result - The polling result
   * @returns Result indicating success or failure
   */
  public updatePollingState(result: PollingResult): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      result,
      'pollingResult'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Update device status based on poll result
    const oldStatus = this.props.status;
    const newStatus = result.deviceStatus;

    if (oldStatus !== newStatus) {
      const updateStatusResult = this.updateStatus(newStatus);
      if (!updateStatusResult.isSuccess) {
        return updateStatusResult;
      }
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Gets the polling configuration for this device.
   */
  public getPollingConfiguration(): PollingConfiguration {
    return this.props.pollingConfiguration;
  }
}
