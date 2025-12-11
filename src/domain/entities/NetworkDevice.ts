import {
  AggregateRoot,
  Result,
  Guard,
  NetworkDeviceId,
  PollingConfiguration,
  PollingResult,
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  PollingInterval,
  NetworkDeviceCreatedEvent,
  NetworkDeviceStatusChangedEvent,
  PollingIntervalChangedEvent,
  PingCountChangedEvent,
  PollingConfigurationChangedEvent,
  ConnectivityType,
  ManagementProtocol,
  NetworkDeviceProps,
  NetworkDeviceDeletedEvent,
  NetworkDeviceUpdatedEvent
} from '../';
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
export class NetworkDevice extends AggregateRoot<
  NetworkDeviceProps,
  NetworkDeviceId
> {
  private constructor(
    props: NetworkDeviceProps,
    id: NetworkDeviceId
  ) {
    super(props, id);
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

  /**
   * Creates a new NetworkDevice aggregate.
   *
   * @param props - Network device properties
   * @param id - Optional ID (for reconstitution from database)
   * @returns Result containing NetworkDevice or error message
   */
  public static create(
    props: NetworkDeviceProps,
    id?: NetworkDeviceId
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

    const deviceId = id || NetworkDeviceId.create().value;

    // Set default dates if not provided
    const networkDevice = new NetworkDevice(
      {
        ...props,
        installDate: props.installDate || new Date(),
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      deviceId
    );

    // Emit creation event if this is a new device (no ID provided)
    if (!id) {
      networkDevice.addDomainEvent(
        new NetworkDeviceCreatedEvent(
          networkDevice.id,
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
        this.id,
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

    const oldName = this.props.name;
    this.props.name = newName;
    this.props.updatedAt = new Date();

    // Emit update event if name actually changed
    if (oldName !== newName) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent(
          this.id,
          this.name,
          ['name'],
          { name: oldName },
          { name: newName }
        )
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates the device description.
   *
   * @param description - New description (can be null)
   * @returns Result indicating success or failure
   */
  public updateDescription(description: string | null): Result<void> {
    if (description) {
      const guardResult = Guard.combine([
        Guard.isString(description, 'description'),
        Guard.againstAtMost(description!.length, 1000, 'description')
      ]);

      if (!guardResult.succeeded) {
        return Result.fail<void>(guardResult.message!);
      }
    }

    const oldDescription = this.props.description;
    this.props.description = description;
    this.props.updatedAt = new Date();

    // Emit update event if description actually changed
    if (oldDescription !== description) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent(
          this.id,
          this.name,
          ['description'],
          { description: oldDescription },
          { description: description }
        )
      );
    }

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
    const changedFields: string[] = [];
    const previousValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (config.port !== undefined) {
      const portGuard = Guard.combine([
        Guard.isNumber(config.port, 'port'),
        Guard.inRange(config.port, 1, 65535, 'port')
      ]);

      if (!portGuard.succeeded) {
        return Result.fail<void>(portGuard.message!);
      }

      if (this.props.managementPort !== config.port) {
        changedFields.push('managementPort');
        previousValues.managementPort = this.props.managementPort;
        newValues.managementPort = config.port;
        this.props.managementPort = config.port;
      }
    }

    if (config.protocol !== undefined) {
      if (this.props.managementProtocol !== config.protocol) {
        changedFields.push('managementProtocol');
        previousValues.managementProtocol =
          this.props.managementProtocol;
        newValues.managementProtocol = config.protocol;
        this.props.managementProtocol = config.protocol;
      }
    }

    if (config.enableRemoteAccess !== undefined) {
      if (
        this.props.enabledRemoteAccess !== config.enableRemoteAccess
      ) {
        changedFields.push('enabledRemoteAccess');
        previousValues.enabledRemoteAccess =
          this.props.enabledRemoteAccess;
        newValues.enabledRemoteAccess = config.enableRemoteAccess;
        this.props.enabledRemoteAccess = config.enableRemoteAccess;
      }
    }

    this.props.updatedAt = new Date();

    // Emit event if anything actually changed
    if (changedFields.length > 0) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent(
          this.id,
          this.name,
          changedFields,
          previousValues,
          newValues
        )
      );
    }

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
    if (updateResult.isFailure) {
      return Result.fail<void>(updateResult.error!);
    }

    const { previousInterval } = updateResult.value;

    // Emit event if interval actually changed
    if (!previousInterval.equals(interval)) {
      this.addDomainEvent(
        new PollingIntervalChangedEvent(
          this.props.pollingConfiguration.id,
          this.id,
          previousInterval,
          interval,
          this.name
        )
      );
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
    if (updateResult.isFailure) {
      return Result.fail<void>(updateResult.error!);
    }

    const { previousPingCount } = updateResult.value;

    // Emit event if ping count actually changed
    if (previousPingCount !== count) {
      this.addDomainEvent(
        new PingCountChangedEvent(
          this.props.pollingConfiguration.id,
          this.id,
          previousPingCount,
          count,
          this.name
        )
      );
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Enables polling for this device.
   */
  public enablePolling(): Result<void> {
    const enableResult = this.props.pollingConfiguration.enable();
    if (enableResult.isFailure) {
      return Result.fail<void>(enableResult.error!);
    }

    const { stateChanged } = enableResult.value;

    // Emit event if state actually changed
    if (stateChanged) {
      this.addDomainEvent(
        new PollingConfigurationChangedEvent(
          this.props.pollingConfiguration.id,
          this.id,
          this.name,
          'Polling enabled'
        )
      );
    }

    this.props.updatedAt = new Date();
    return Result.ok<void>();
  }

  /**
   * Disables polling for this device.
   */
  public disablePolling(): Result<void> {
    const disableResult = this.props.pollingConfiguration.disable();
    if (disableResult.isFailure) {
      return Result.fail<void>(disableResult.error!);
    }

    const { stateChanged } = disableResult.value;

    // Emit event if state actually changed
    if (stateChanged) {
      this.addDomainEvent(
        new PollingConfigurationChangedEvent(
          this.props.pollingConfiguration.id,
          this.id,
          this.name,
          'Polling disabled'
        )
      );
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

  /**
   * Marks the device for deletion and emits deletion event.
   * Call this BEFORE physically deleting from repository.
   *
   * This ensures the deletion event is emitted with full device context
   * before the data is permanently removed.
   *
   * @param deletedBy - Optional identifier of who/what requested deletion
   * @returns Result indicating success or failure
   */
  public markForDeletion(deletedBy?: string): Result<void> {
    // Emit deletion event with current device state
    this.addDomainEvent(
      new NetworkDeviceDeletedEvent(
        this.id,
        this.name,
        this.ipAddress.toString(),
        this.macAddress.toString(),
        deletedBy
      )
    );

    return Result.ok<void>();
  }
}
