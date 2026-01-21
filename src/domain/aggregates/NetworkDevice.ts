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
  NetworkDeviceUpdatedEvent,
  ActivationStatus,
  NetworkDeviceActivatedEvent,
  NetworkDeviceRestoredEvent,
  DeviceReplacedEvent
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

  // REQ-002: Getters for new properties
  get activationStatus(): ActivationStatus {
    return this.props.activationStatus;
  }

  get activatedAt(): Date | null {
    return this.props.activatedAt;
  }

  get activatedBy(): string | null {
    return this.props.activatedBy;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get deletedBy(): string | null {
    return this.props.deletedBy;
  }

  get replacedByDeviceId(): NetworkDeviceId | null {
    return this.props.replacedByDeviceId;
  }

  get replacedAt(): Date | null {
    return this.props.replacedAt;
  }

  /**
   * Creates a new NetworkDevice aggregate.
   *
   * REQ-002: Supports DRAFT and ACTIVE activation states with conditional validation:
   * - DRAFT: Requires only IP + MAC (for device discovery/enrichment workflow)
   * - ACTIVE: Requires full device information (IP, MAC, name, deviceType, deviceId)
   *
   * @param props - Network device properties
   * @param id - Optional ID (for reconstitution from database)
   * @returns Result containing NetworkDevice or error message
   */
  public static create(
    props: NetworkDeviceProps,
    id: NetworkDeviceId
  ): Result<NetworkDevice> {
    // Set default activationStatus if not provided
    const activationStatus =
      props.activationStatus || ActivationStatus.DRAFT;

    // Base validation: Always require IP + MAC
    const baseGuards = [
      Guard.againstNullOrUndefined(props.ipAddress, 'ipAddress'),
      Guard.againstNullOrUndefined(props.macAddress, 'macAddress')
    ];

    // Conditional validation based on activation status
    let guards = baseGuards;

    if (activationStatus === ActivationStatus.ACTIVE) {
      // ACTIVE state requires full device information
      guards = [
        ...baseGuards,
        Guard.againstNullOrUndefinedBulk([
          { argument: props.name, argumentName: 'name' },
          { argument: props.deviceType, argumentName: 'deviceType' },
          { argument: props.status, argumentName: 'status' },
          {
            argument: props.connectivityType,
            argumentName: 'connectivityType'
          },
          {
            argument: props.managementProtocol,
            argumentName: 'managementProtocol'
          },
          {
            argument: props.managementPort,
            argumentName: 'managementPort'
          },
          { argument: props.deviceId, argumentName: 'deviceId' },
          {
            argument: props.pollingConfiguration,
            argumentName: 'pollingConfiguration'
          },
          { argument: id, argumentName: 'networkDeviceId' }
        ]),
        Guard.isNumber(props.managementPort, 'managementPort'),
        Guard.inRange(
          props.managementPort,
          1,
          65535,
          'managementPort'
        )
      ];

      // Validate name length for ACTIVE devices
      if (props.name !== null && props.name !== undefined) {
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
      }
    }

    const guardResult = Guard.combine(guards);

    if (!guardResult.succeeded) {
      return Result.fail<NetworkDevice>(guardResult.message!);
    }

    // Set defaults for new REQ-002 fields
    const networkDevice = new NetworkDevice(
      {
        ...props,
        activationStatus,
        deletedAt: props.deletedAt ?? null,
        deletedBy: props.deletedBy ?? null,
        activatedAt: props.activatedAt ?? null,
        activatedBy: props.activatedBy ?? null,
        replacedByDeviceId: props.replacedByDeviceId ?? null,
        replacedAt: props.replacedAt ?? null,
        installDate: props.installDate || new Date(),
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      id
    );

    // Emit creation event if this is a new device
    networkDevice.addDomainEvent(
      new NetworkDeviceCreatedEvent({
        aggregateId: networkDevice.id,
        deviceName: networkDevice.name,
        ipAddress: networkDevice.ipAddress,
        macAddress: networkDevice.macAddress,
        dateTimeOccurred: new Date()
      })
    );

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

    if (oldStatus.equals(newStatus)) {
      return Result.ok<void>();
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    // Emit status changed event
    this.addDomainEvent(
      new NetworkDeviceStatusChangedEvent({
        aggregateId: this.id,
        deviceName: this.name,
        previousStatus: oldStatus,
        ipAddress: this.ipAddress,
        newStatus,
        dateTimeOccurred: new Date()
      })
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
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['name'],
          previousValues: { name: oldName },
          newValues: { name: newName },
          dateTimeOccurred: new Date()
        })
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
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['description'],
          previousValues: { description: oldDescription },
          newValues: { description: description },
          dateTimeOccurred: new Date()
        })
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
   * Updates the device MAC address.
   *
   * REQ-002: MAC address can only be changed while device is in DRAFT status.
   * Once activated, MAC address is immutable (represents physical hardware identity).
   *
   * @param newMacAddress - New MAC address
   * @returns Result indicating success or failure
   */
  public updateMacAddress(newMacAddress: MACAddress): Result<void> {
    // Guard: DRAFT only constraint
    if (this.props.activationStatus !== ActivationStatus.DRAFT) {
      return Result.fail<void>(
        'MAC address can only be changed while device is in DRAFT status'
      );
    }

    const guardResult = Guard.againstNullOrUndefined(
      newMacAddress,
      'macAddress'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldMacAddress = this.props.macAddress;
    this.props.macAddress = newMacAddress;
    this.props.updatedAt = new Date();

    // Emit update event if MAC actually changed
    if (!oldMacAddress.equals(newMacAddress)) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['macAddress'],
          previousValues: { macAddress: oldMacAddress.toString() },
          newValues: { macAddress: newMacAddress.toString() },
          dateTimeOccurred: new Date()
        })
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates the device type.
   *
   * Device type can be changed at any time (e.g., UNKNOWN → ROUTER after
   * proper identification, or correction of misclassification).
   *
   * @param newDeviceType - New device type
   * @returns Result indicating success or failure
   */
  public updateDeviceType(
    newDeviceType: NetworkDeviceType
  ): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newDeviceType,
      'deviceType'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldDeviceType = this.props.deviceType;
    this.props.deviceType = newDeviceType;
    this.props.updatedAt = new Date();

    // Emit update event if device type actually changed
    if (!oldDeviceType.equals(newDeviceType)) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['deviceType'],
          previousValues: { deviceType: oldDeviceType.toString() },
          newValues: { deviceType: newDeviceType.toString() },
          dateTimeOccurred: new Date()
        })
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates the connectivity type.
   *
   * Connectivity type can be changed at any time (e.g., device upgraded
   * from Ethernet to Fiber).
   *
   * @param newConnectivityType - New connectivity type
   * @returns Result indicating success or failure
   */
  public updateConnectivityType(
    newConnectivityType: ConnectivityType
  ): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      newConnectivityType,
      'connectivityType'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    const oldConnectivityType = this.props.connectivityType;
    this.props.connectivityType = newConnectivityType;
    this.props.updatedAt = new Date();

    // Emit update event if connectivity type actually changed
    if (oldConnectivityType !== newConnectivityType) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['connectivityType'],
          previousValues: { connectivityType: oldConnectivityType },
          newValues: { connectivityType: newConnectivityType },
          dateTimeOccurred: new Date()
        })
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates the device ID (external/physical identifier).
   *
   * REQ-002: Device ID can only be changed while device is in DRAFT status.
   * Once activated, device ID is immutable.
   *
   * @param newDeviceId - New device ID
   * @returns Result indicating success or failure
   */
  public updateDeviceId(newDeviceId: string): Result<void> {
    // Guard: DRAFT only constraint
    if (this.props.activationStatus !== ActivationStatus.DRAFT) {
      return Result.fail<void>(
        'Device ID can only be changed while device is in DRAFT status'
      );
    }

    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newDeviceId, 'deviceId'),
      Guard.isString(newDeviceId, 'deviceId')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (newDeviceId.trim().length === 0) {
      return Result.fail<void>('Device ID cannot be empty');
    }

    const oldDeviceId = this.props.deviceId;
    this.props.deviceId = newDeviceId;
    this.props.updatedAt = new Date();

    // Emit update event if device ID actually changed
    if (oldDeviceId !== newDeviceId) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['deviceId'],
          previousValues: { deviceId: oldDeviceId },
          newValues: { deviceId: newDeviceId },
          dateTimeOccurred: new Date()
        })
      );
    }

    return Result.ok<void>();
  }

  /**
   * Updates the installation date.
   *
   * REQ-002: Install date can only be changed while device is in DRAFT status.
   * Once activated, install date is immutable.
   *
   * @param newInstallDate - New installation date
   * @returns Result indicating success or failure
   */
  public updateInstallDate(newInstallDate: Date): Result<void> {
    // Guard: DRAFT only constraint
    if (this.props.activationStatus !== ActivationStatus.DRAFT) {
      return Result.fail<void>(
        'Install date can only be changed while device is in DRAFT status'
      );
    }

    const guardResult = Guard.againstNullOrUndefined(
      newInstallDate,
      'installDate'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    if (
      !(newInstallDate instanceof Date) ||
      isNaN(newInstallDate.getTime())
    ) {
      return Result.fail<void>('Install date must be a valid date');
    }

    const oldInstallDate = this.props.installDate;
    this.props.installDate = newInstallDate;
    this.props.updatedAt = new Date();

    // Emit update event if install date actually changed
    if (oldInstallDate.getTime() !== newInstallDate.getTime()) {
      this.addDomainEvent(
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields: ['installDate'],
          previousValues: {
            installDate: oldInstallDate.toISOString()
          },
          newValues: { installDate: newInstallDate.toISOString() },
          dateTimeOccurred: new Date()
        })
      );
    }

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
    const previousValues: Record<
      string,
      ManagementProtocol | number | boolean
    > = {};
    const newValues: Record<
      string,
      ManagementProtocol | number | boolean
    > = {};

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
        new NetworkDeviceUpdatedEvent({
          aggregateId: this.id,
          deviceName: this.name,
          changedFields,
          previousValues,
          newValues,
          dateTimeOccurred: new Date()
        })
      );
    }

    return Result.ok<void>();
  }

  /**
   * Checks if the device is currently online.
   */
  public isOnline(): boolean {
    return this.props.status.isOnline();
  }

  /**
   * Checks if the device is currently offline.
   */
  public isOffline(): boolean {
    return this.props.status.isOffline();
  }

  /**
   * Checks if the device is in maintenance mode.
   */
  public isInMaintenance(): boolean {
    return this.props.status.isMaintenance();
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
  public configurePollingInterval(
    interval: PollingInterval
  ): Result<void> {
    const updateResult =
      this.props.pollingConfiguration.updateInterval(interval);
    if (updateResult.isFailure) {
      return Result.fail<void>(updateResult.error!);
    }

    const { previousInterval } = updateResult.value;

    // Emit event if interval actually changed
    if (!previousInterval.equals(interval)) {
      this.addDomainEvent(
        new PollingIntervalChangedEvent({
          aggregateId: this.id,
          pollingConfigurationId: this.props.pollingConfiguration.id,
          previousInterval,
          newInterval: interval,
          deviceName: this.name,
          dateTimeOccurred: new Date()
        })
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
        new PingCountChangedEvent({
          aggregateId: this.id,
          pollingConfigurationId: this.props.pollingConfiguration.id,
          previousPingCount,
          newPingCount: count,
          deviceName: this.name,
          dateTimeOccurred: new Date()
        })
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
        new PollingConfigurationChangedEvent({
          aggregateId: this.id,
          pollingConfigurationId: this.props.pollingConfiguration.id,
          deviceName: this.name,
          changeDescription: 'Polling enabled',
          dateTimeOccurred: new Date()
        })
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
        new PollingConfigurationChangedEvent({
          aggregateId: this.id,
          pollingConfigurationId: this.props.pollingConfiguration.id,
          deviceName: this.name,
          changeDescription: 'Polling disabled',
          dateTimeOccurred: new Date()
        })
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

  // ========== REQ-002: Activation Workflow Methods ==========

  /**
   * Activates a DRAFT device, transitioning it to ACTIVE state.
   *
   * REQ-002 AC-002.2: Device activation workflow
   * - Device must be in DRAFT state
   * - All required fields must be populated
   * - Emits NetworkDeviceActivatedEvent
   *
   * @param activatedBy - User ID who performed the activation
   * @returns Result indicating success or failure
   */
  public activate(activatedBy: string): Result<void> {
    // Guard: Check if already active
    if (this.props.activationStatus === ActivationStatus.ACTIVE) {
      return Result.fail<void>('Device is already in ACTIVE state');
    }

    // Guard: Validate activatedBy
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(activatedBy, 'activatedBy'),
      Guard.isString(activatedBy, 'activatedBy')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Guard: Check if device can be activated (all required fields present)
    const canActivateResult = this.canActivate();
    if (!canActivateResult.isSuccess) {
      return canActivateResult;
    }

    // Perform activation
    this.props.activationStatus = ActivationStatus.ACTIVE;
    this.props.activatedAt = new Date();
    this.props.activatedBy = activatedBy;
    this.props.updatedAt = new Date();

    // Emit NetworkDeviceActivatedEvent
    this.addDomainEvent(
      new NetworkDeviceActivatedEvent({
        aggregateId: this.id,
        deviceName: this.props.name,
        ipAddress: this.props.ipAddress,
        macAddress: this.props.macAddress,
        activatedBy,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Validates whether the device can be activated.
   *
   * Checks that all required fields for ACTIVE state are present:
   * - name, deviceType, deviceId, status
   * - connectivityType, managementProtocol, managementPort
   * - pollingConfiguration
   *
   * @returns Result indicating whether device can be activated
   */
  public canActivate(): Result<void> {
    const requiredFields: Array<{
      value: unknown;
      fieldName: string;
    }> = [
      { value: this.props.name, fieldName: 'name' },
      { value: this.props.deviceType, fieldName: 'deviceType' },
      { value: this.props.deviceId, fieldName: 'deviceId' },
      { value: this.props.status, fieldName: 'status' },
      {
        value: this.props.connectivityType,
        fieldName: 'connectivityType'
      },
      {
        value: this.props.managementProtocol,
        fieldName: 'managementProtocol'
      },
      {
        value: this.props.managementPort,
        fieldName: 'managementPort'
      },
      {
        value: this.props.pollingConfiguration,
        fieldName: 'pollingConfiguration'
      }
    ];

    const missingFields = requiredFields
      .filter(
        (field) => field.value === null || field.value === undefined
      )
      .map((field) => field.fieldName);

    if (missingFields.length > 0) {
      return Result.fail<void>(
        `Cannot activate device. Missing required fields: ${missingFields.join(', ')}`
      );
    }

    // Validate name is not empty
    if (this.props.name && this.props.name.trim().length === 0) {
      return Result.fail<void>(
        'Cannot activate device. Device name cannot be empty'
      );
    }

    return Result.ok<void>();
  }

  /**
   * Checks if the device is in DRAFT state.
   *
   * @returns True if device is in DRAFT state
   */
  public isDraft(): boolean {
    return this.props.activationStatus === ActivationStatus.DRAFT;
  }

  /**
   * Checks if the device is in ACTIVE state.
   *
   * @returns True if device is in ACTIVE state
   */
  public isActive(): boolean {
    return this.props.activationStatus === ActivationStatus.ACTIVE;
  }

  // ========== REQ-002: Soft Delete & Restore Methods ==========

  /**
   * Marks the device for soft deletion.
   *
   * REQ-002 AC-002.6: Soft delete with 7-day grace period
   * - Sets deletedAt and deletedBy fields
   * - Device remains in database but excluded from normal queries
   * - Can be restored within 7 days
   * - Emits NetworkDeviceDeletedEvent
   *
   * @param deletedBy - User ID who performed the deletion
   * @returns Result indicating success or failure
   */
  public markForDeletion(deletedBy?: string): Result<void> {
    // Guard: Check if already deleted
    if (this.isDeleted()) {
      return Result.fail<void>(
        'Device is already marked for deletion'
      );
    }

    // Perform soft delete
    this.props.deletedAt = new Date();
    this.props.deletedBy = deletedBy || null;
    this.props.updatedAt = new Date();

    // Emit deletion event with current device state
    this.addDomainEvent(
      new NetworkDeviceDeletedEvent({
        aggregateId: this.id,
        deviceName: this.name,
        ipAddress: this.ipAddress,
        macAddress: this.macAddress,
        deletedBy,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Restores a soft-deleted device within the grace period.
   *
   * REQ-002 AC-002.7: Restore deleted devices within grace period
   * - Device must be in soft-deleted state
   * - Must be within 7-day grace period
   * - Clears deletedAt and deletedBy fields
   * - Emits NetworkDeviceRestoredEvent
   *
   * @param restoredBy - User ID who performed the restoration
   * @returns Result indicating success or failure
   */
  public restore(restoredBy: string): Result<void> {
    // Guard: Validate restoredBy
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(restoredBy, 'restoredBy'),
      Guard.isString(restoredBy, 'restoredBy')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Guard: Check if device can be restored
    const canRestoreResult = this.canRestore();
    if (canRestoreResult.isFailure) {
      return canRestoreResult;
    }

    // Store original deletedAt for event
    const originalDeletedAt = this.props.deletedAt!;

    // Perform restoration
    this.props.deletedAt = null;
    this.props.deletedBy = null;
    this.props.updatedAt = new Date();

    // Emit NetworkDeviceRestoredEvent
    this.addDomainEvent(
      new NetworkDeviceRestoredEvent({
        aggregateId: this.id,
        deviceName: this.name,
        ipAddress: this.ipAddress,
        restoredBy,
        deletedAt: originalDeletedAt,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Validates whether the device can be restored.
   *
   * Checks:
   * - Device must be in soft-deleted state (deletedAt is not null)
   * - Must be within 7-day grace period
   *
   * @returns Result indicating whether device can be restored
   */
  public canRestore(): Result<void> {
    if (!this.isDeleted()) {
      return Result.fail<void>('Device is not in deleted state');
    }

    if (!this.isWithinGracePeriod()) {
      return Result.fail<void>(
        'Restoration grace period has expired (7 days maximum)'
      );
    }

    return Result.ok<void>();
  }

  /**
   * Checks if the device is in soft-deleted state.
   *
   * @returns True if device is marked for deletion (deletedAt is not null)
   */
  public isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /**
   * Checks if the device is within the 7-day grace period for restoration.
   *
   * @returns True if device is deleted and within 7 days of deletion
   */
  public isWithinGracePeriod(): boolean {
    if (!this.isDeleted()) {
      return false;
    }

    const daysSinceDeletion =
      (Date.now() - this.props.deletedAt!.getTime()) /
      (1000 * 60 * 60 * 24);

    return daysSinceDeletion <= 7;
  }

  // ========== REQ-002: Device Replacement Methods ==========

  /**
   * Marks this device as replaced by a new device.
   *
   * REQ-002 AC-002.9: Device replacement workflow
   * - Old device must be in deleted state
   * - Links old device to new replacement device
   * - Emits DeviceReplacedEvent with migration details
   *
   * @param newDeviceId - ID of the new replacement device
   * @param newMacAddress - MAC address of the new device
   * @param replacedBy - User ID who confirmed the replacement
   * @param configMigrated - Whether polling/management config was migrated
   * @param metadataMigrated - Whether name/description/location was migrated
   * @returns Result indicating success or failure
   */
  public markAsReplaced(
    newDeviceId: NetworkDeviceId,
    newMacAddress: MACAddress,
    replacedBy: string,
    configMigrated: boolean,
    metadataMigrated: boolean
  ): Result<void> {
    // Guard: Device must be deleted
    if (!this.isDeleted()) {
      return Result.fail<void>(
        'Device must be in deleted state to mark as replaced'
      );
    }

    // Guard: Check if already replaced
    if (this.isReplaced()) {
      return Result.fail<void>(
        'Device is already marked as replaced'
      );
    }

    // Guard: Validate parameters
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(newDeviceId, 'newDeviceId'),
      Guard.againstNullOrUndefined(newMacAddress, 'newMacAddress'),
      Guard.againstNullOrUndefined(replacedBy, 'replacedBy'),
      Guard.isString(replacedBy, 'replacedBy')
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    // Perform replacement tracking
    this.props.replacedByDeviceId = newDeviceId;
    this.props.replacedAt = new Date();
    this.props.updatedAt = new Date();

    // Emit DeviceReplacedEvent
    this.addDomainEvent(
      new DeviceReplacedEvent({
        oldDeviceId: this.id,
        newDeviceId,
        ipAddress: this.ipAddress,
        oldMacAddress: this.macAddress,
        newMacAddress,
        configMigrated,
        metadataMigrated,
        replacedBy,
        dateTimeOccurred: new Date()
      })
    );

    return Result.ok<void>();
  }

  /**
   * Checks if the device has been replaced by another device.
   *
   * @returns True if device has been marked as replaced
   */
  public isReplaced(): boolean {
    return this.props.replacedByDeviceId !== null;
  }
}
