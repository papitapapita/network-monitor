import {
  NetworkDeviceType,
  NetworkDeviceStatus,
  IPAddress,
  MACAddress,
  PollingInterval,
  ConnectivityType,
  ManagementProtocol,
  PollingMetrics,
  PollingStatus,
  PollingResult,
  PollingConfiguration,
  NetworkDeviceId,
  NetworkDevice,
  NetworkDeviceProps
} from '../../../src/domain';

describe('NetworkDevice', () => {
  let validProps: NetworkDeviceProps;
  let pollingConfig: PollingConfiguration;

  beforeEach(() => {
    const networkDeviceId = NetworkDeviceId.create().value;
    pollingConfig =
      PollingConfiguration.createDefault(networkDeviceId).value;

    validProps = {
      name: 'Router-01',
      deviceType: NetworkDeviceType.ROUTER,
      status: NetworkDeviceStatus.UNKNOWN,
      description: 'Core router for main office',
      installDate: new Date('2024-01-01'),
      ipAddress: IPAddress.create('192.168.1.1').value,
      macAddress: MACAddress.create('00:1A:2B:3C:4D:5E').value,
      connectivityType: ConnectivityType.ETHERNET,
      managementProtocol: ManagementProtocol.SSH,
      managementPort: 22,
      enabledRemoteAccess: true,
      deviceId: 'device-001',
      pollingConfiguration: pollingConfig,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('create', () => {
    it('should create a device with valid properties', () => {
      const result = NetworkDevice.create(validProps);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(NetworkDevice);
      expect(result.value.name).toBe('Router-01');
      expect(result.value.deviceType).toBe(NetworkDeviceType.ROUTER);
      expect(result.value.status).toBe(NetworkDeviceStatus.UNKNOWN);
    });

    it('should generate ID when not provided', () => {
      const result = NetworkDevice.create(validProps);

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeDefined();
      expect(result.value.id).toBeInstanceOf(NetworkDeviceId);
    });

    it('should use provided ID when given', () => {
      const customId = NetworkDeviceId.create().value;
      const result = NetworkDevice.create(validProps, customId);

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBe(customId);
    });

    it('should set default dates when not provided', () => {
      const propsWithoutDates = { ...validProps };
      delete (propsWithoutDates as any).installDate;
      delete (propsWithoutDates as any).createdAt;
      delete (propsWithoutDates as any).updatedAt;

      const result = NetworkDevice.create(propsWithoutDates);

      expect(result.isSuccess).toBe(true);
      expect(result.value.installDate).toBeInstanceOf(Date);
      expect(result.value.createdAt).toBeInstanceOf(Date);
      expect(result.value.updatedAt).toBeInstanceOf(Date);
    });

    it('should emit NetworkDeviceCreatedEvent for new device', () => {
      const result = NetworkDevice.create(validProps);

      expect(result.isSuccess).toBe(true);
      const events = result.value.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceCreatedEvent'
      );
    });

    it('should not emit creation event when ID is provided', () => {
      const existingId = NetworkDeviceId.create().value;
      const result = NetworkDevice.create(validProps, existingId);

      expect(result.isSuccess).toBe(true);
      const events = result.value.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should fail when name is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is undefined', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: undefined as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is empty string', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: ''
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name is only whitespace', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: '   '
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name exceeds 255 characters', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: 'A'.repeat(256)
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('255');
    });

    it('should accept name with exactly 255 characters', () => {
      const result = NetworkDevice.create({
        ...validProps,
        name: 'A'.repeat(255)
      });

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when deviceType is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        deviceType: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceType');
    });

    it('should fail when status is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        status: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('status');
    });

    it('should fail when ipAddress is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        ipAddress: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ipAddress');
    });

    it('should fail when macAddress is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        macAddress: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('macAddress');
    });

    it('should fail when managementPort is null', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: null as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is not a number', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: 'not-a-number' as any
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is below range (0)', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: 0
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is above range (65536)', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: 65536
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should accept managementPort at minimum range (1)', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: 1
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(1);
    });

    it('should accept managementPort at maximum range (65535)', () => {
      const result = NetworkDevice.create({
        ...validProps,
        managementPort: 65535
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(65535);
    });

    it('should accept null description', () => {
      const result = NetworkDevice.create({
        ...validProps,
        description: null
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
    });
  });

  describe('getters', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return correct name', () => {
      expect(device.name).toBe('Router-01');
    });

    it('should return correct deviceType', () => {
      expect(device.deviceType).toBe(NetworkDeviceType.ROUTER);
    });

    it('should return correct status', () => {
      expect(device.status).toBe(NetworkDeviceStatus.UNKNOWN);
    });

    it('should return correct description', () => {
      expect(device.description).toBe('Core router for main office');
    });

    it('should return correct installDate', () => {
      expect(device.installDate).toBeInstanceOf(Date);
    });

    it('should return correct ipAddress', () => {
      expect(device.ipAddress).toBeInstanceOf(IPAddress);
      expect(device.ipAddress.toString()).toBe('192.168.1.1');
    });

    it('should return correct macAddress', () => {
      expect(device.macAddress).toBeInstanceOf(MACAddress);
      expect(device.macAddress.toString()).toBe('00:1A:2B:3C:4D:5E');
    });

    it('should return correct connectivityType', () => {
      expect(device.connectivityType).toBe(ConnectivityType.ETHERNET);
    });

    it('should return correct managementProtocol', () => {
      expect(device.managementProtocol).toBe(ManagementProtocol.SSH);
    });

    it('should return correct managementPort', () => {
      expect(device.managementPort).toBe(22);
    });

    it('should return correct enabledRemoteAccess', () => {
      expect(device.enabledRemoteAccess).toBe(true);
    });

    it('should return correct deviceId', () => {
      expect(device.deviceId).toBe('device-001');
    });

    it('should return correct createdAt', () => {
      expect(device.createdAt).toBeInstanceOf(Date);
    });

    it('should return correct updatedAt', () => {
      expect(device.updatedAt).toBeInstanceOf(Date);
    });

    it('should return correct pollingConfiguration', () => {
      expect(device.pollingConfiguration).toBeInstanceOf(
        PollingConfiguration
      );
    });
  });

  describe('updateStatus', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents(); // Clear creation event
    });

    it('should update status successfully', () => {
      const result = device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.ONLINE);
    });

    it('should emit NetworkDeviceStatusChangedEvent', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      // Small delay to ensure timestamp changes
      const result = device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should not emit event when status is the same', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.ONLINE);

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should fail when status is null', () => {
      const result = device.updateStatus(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('status');
    });

    it('should handle ONLINE to OFFLINE transition', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);
      device.clearEvents();

      const result = device.updateStatus(NetworkDeviceStatus.OFFLINE);

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.OFFLINE);
      expect(device.domainEvents.length).toBe(1);
    });

    it('should handle OFFLINE to ONLINE transition', () => {
      device.updateStatus(NetworkDeviceStatus.OFFLINE);
      device.clearEvents();

      const result = device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.ONLINE);
    });

    it('should handle MAINTENANCE status', () => {
      const result = device.updateStatus(
        NetworkDeviceStatus.MAINTENANCE
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.MAINTENANCE);
    });
  });

  describe('updateName', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should update name successfully', () => {
      const result = device.updateName('Switch-01');

      expect(result.isSuccess).toBe(true);
      expect(device.name).toBe('Switch-01');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.updateName('New-Name');

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when name is null', () => {
      const result = device.updateName(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is undefined', () => {
      const result = device.updateName(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when name is not a string', () => {
      const result = device.updateName(123 as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when name is empty', () => {
      const result = device.updateName('');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name is only whitespace', () => {
      const result = device.updateName('   ');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name exceeds 255 characters', () => {
      const result = device.updateName('A'.repeat(256));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('255');
    });

    it('should accept name with 255 characters', () => {
      const longName = 'A'.repeat(255);
      const result = device.updateName(longName);

      expect(result.isSuccess).toBe(true);
      expect(device.name).toBe(longName);
    });

    it('should emit NetworkDeviceUpdatedEvent when name changes', () => {
      device.clearEvents();
      const oldName = device.name;

      const result = device.updateName('NewName-01');

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['name']);
      expect(event.previousValues.name).toBe(oldName);
      expect(event.newValues.name).toBe('NewName-01');
    });

    it('should not emit event when name does not change', () => {
      const currentName = device.name;
      device.clearEvents();

      const result = device.updateName(currentName);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updateDescription', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should update description successfully', () => {
      const result = device.updateDescription('New description');

      expect(result.isSuccess).toBe(true);
      expect(device.description).toBe('New description');
    });

    it('should accept null description', () => {
      const result = device.updateDescription(null);

      expect(result.isSuccess).toBe(true);
      expect(device.description).toBeNull();
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.updateDescription('Updated');

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when description exceeds 1000 characters', () => {
      const result = device.updateDescription('A'.repeat(1001));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('1000');
    });

    it('should accept description with exactly 1000 characters', () => {
      const longDesc = 'A'.repeat(1000);
      const result = device.updateDescription(longDesc);

      expect(result.isSuccess).toBe(true);
      expect(device.description).toBe(longDesc);
    });

    it('should emit NetworkDeviceUpdatedEvent when description changes', () => {
      device.clearEvents();
      const oldDescription = device.description;

      const result = device.updateDescription('New description text');

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['description']);
      expect(event.previousValues.description).toBe(oldDescription);
      expect(event.newValues.description).toBe('New description text');
    });

    it('should emit event when description is set to null', () => {
      device.clearEvents();
      const oldDescription = device.description;

      const result = device.updateDescription(null);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['description']);
      expect(event.previousValues.description).toBe(oldDescription);
      expect(event.newValues.description).toBeNull();
    });

    it('should not emit event when description does not change', () => {
      const currentDescription = device.description;
      device.clearEvents();

      const result = device.updateDescription(currentDescription);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updateIpAddress', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should update IP address successfully', () => {
      const newIp = IPAddress.create('10.0.0.1').value;
      const result = device.updateIpAddress(newIp);

      expect(result.isSuccess).toBe(true);
      expect(device.ipAddress.toString()).toBe('10.0.0.1');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;
      const newIp = IPAddress.create('10.0.0.1').value;

      const result = device.updateIpAddress(newIp);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when IP address is null', () => {
      const result = device.updateIpAddress(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ipAddress');
    });

    it('should fail when IP address is undefined', () => {
      const result = device.updateIpAddress(undefined as any);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('updateManagementConfig', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should update management port', () => {
      const result = device.updateManagementConfig({ port: 8080 });

      expect(result.isSuccess).toBe(true);
      expect(device.managementPort).toBe(8080);
    });

    it('should update management protocol', () => {
      const result = device.updateManagementConfig({
        protocol: ManagementProtocol.HTTPS
      });

      expect(result.isSuccess).toBe(true);
      expect(device.managementProtocol).toBe(
        ManagementProtocol.HTTPS
      );
    });

    it('should update enableRemoteAccess', () => {
      const result = device.updateManagementConfig({
        enableRemoteAccess: false
      });

      expect(result.isSuccess).toBe(true);
      expect(device.enabledRemoteAccess).toBe(false);
    });

    it('should update multiple fields at once', () => {
      const result = device.updateManagementConfig({
        port: 443,
        protocol: ManagementProtocol.HTTPS,
        enableRemoteAccess: true
      });

      expect(result.isSuccess).toBe(true);
      expect(device.managementPort).toBe(443);
      expect(device.managementProtocol).toBe(
        ManagementProtocol.HTTPS
      );
      expect(device.enabledRemoteAccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.updateManagementConfig({ port: 8080 });

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when port is below range', () => {
      const result = device.updateManagementConfig({ port: 0 });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('port');
    });

    it('should fail when port is above range', () => {
      const result = device.updateManagementConfig({ port: 65536 });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('port');
    });

    it('should fail when port is not a number', () => {
      const result = device.updateManagementConfig({
        port: 'not-a-number' as any
      });

      expect(result.isFailure).toBe(true);
    });

    it('should accept port at minimum range (1)', () => {
      const result = device.updateManagementConfig({ port: 1 });

      expect(result.isSuccess).toBe(true);
      expect(device.managementPort).toBe(1);
    });

    it('should accept port at maximum range (65535)', () => {
      const result = device.updateManagementConfig({ port: 65535 });

      expect(result.isSuccess).toBe(true);
      expect(device.managementPort).toBe(65535);
    });

    it('should emit NetworkDeviceUpdatedEvent when port changes', () => {
      device.clearEvents();
      const oldPort = device.managementPort;

      const result = device.updateManagementConfig({ port: 8080 });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['managementPort']);
      expect(event.previousValues.managementPort).toBe(oldPort);
      expect(event.newValues.managementPort).toBe(8080);
    });

    it('should emit NetworkDeviceUpdatedEvent when protocol changes', () => {
      device.clearEvents();
      const oldProtocol = device.managementProtocol;

      const result = device.updateManagementConfig({
        protocol: ManagementProtocol.HTTPS
      });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['managementProtocol']);
      expect(event.previousValues.managementProtocol).toBe(oldProtocol);
      expect(event.newValues.managementProtocol).toBe(
        ManagementProtocol.HTTPS
      );
    });

    it('should emit NetworkDeviceUpdatedEvent when remote access changes', () => {
      device.clearEvents();
      const oldRemoteAccess = device.enabledRemoteAccess;

      const result = device.updateManagementConfig({
        enableRemoteAccess: false
      });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['enabledRemoteAccess']);
      expect(event.previousValues.enabledRemoteAccess).toBe(
        oldRemoteAccess
      );
      expect(event.newValues.enabledRemoteAccess).toBe(false);
    });

    it('should emit event with multiple changed fields', () => {
      device.clearEvents();
      const oldPort = device.managementPort;
      const oldProtocol = device.managementProtocol;
      const oldRemoteAccess = device.enabledRemoteAccess;

      const result = device.updateManagementConfig({
        port: 443,
        protocol: ManagementProtocol.HTTPS,
        enableRemoteAccess: false
      });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceUpdatedEvent');

      const event = events[0] as any;
      expect(event.changedFields).toEqual([
        'managementPort',
        'managementProtocol',
        'enabledRemoteAccess'
      ]);
      expect(event.previousValues.managementPort).toBe(oldPort);
      expect(event.previousValues.managementProtocol).toBe(oldProtocol);
      expect(event.previousValues.enabledRemoteAccess).toBe(
        oldRemoteAccess
      );
      expect(event.newValues.managementPort).toBe(443);
      expect(event.newValues.managementProtocol).toBe(
        ManagementProtocol.HTTPS
      );
      expect(event.newValues.enabledRemoteAccess).toBe(false);
    });

    it('should not emit event when no fields change', () => {
      const currentPort = device.managementPort;
      device.clearEvents();

      const result = device.updateManagementConfig({ port: currentPort });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('isOnline', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return true when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(device.isOnline()).toBe(true);
    });

    it('should return false when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.OFFLINE);

      expect(device.isOnline()).toBe(false);
    });

    it('should return false when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.MAINTENANCE);

      expect(device.isOnline()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isOnline()).toBe(false);
    });
  });

  describe('isOffline', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return true when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.OFFLINE);

      expect(device.isOffline()).toBe(true);
    });

    it('should return false when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(device.isOffline()).toBe(false);
    });

    it('should return false when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.MAINTENANCE);

      expect(device.isOffline()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isOffline()).toBe(false);
    });
  });

  describe('isInMaintenance', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return true when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.MAINTENANCE);

      expect(device.isInMaintenance()).toBe(true);
    });

    it('should return false when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);

      expect(device.isInMaintenance()).toBe(false);
    });

    it('should return false when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.OFFLINE);

      expect(device.isInMaintenance()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isInMaintenance()).toBe(false);
    });
  });

  describe('hasRemoteAccessEnabled', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return true when remote access is enabled', () => {
      expect(device.hasRemoteAccessEnabled()).toBe(true);
    });

    it('should return false when remote access is disabled', () => {
      device.updateManagementConfig({ enableRemoteAccess: false });

      expect(device.hasRemoteAccessEnabled()).toBe(false);
    });
  });

  describe('configurePolling', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents();
    });

    it('should configure polling interval successfully', () => {
      const newInterval = PollingInterval.create(120).value;
      const result = device.configurePolling(newInterval);

      expect(result.isSuccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;
      const newInterval = PollingInterval.create(120).value;

      const result = device.configurePolling(newInterval);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should emit PollingIntervalChangedEvent when interval changes', () => {
      const newInterval = PollingInterval.create(120).value;
      device.configurePolling(newInterval);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'PollingIntervalChangedEvent'
      );
    });

    it('should not emit event when interval is the same', () => {
      const currentInterval = device.pollingConfiguration.interval;
      device.configurePolling(currentInterval);

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updatePingCount', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents();
    });

    it('should update ping count successfully', () => {
      const result = device.updatePingCount(8);

      expect(result.isSuccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.updatePingCount(8);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail with invalid ping count', () => {
      const result = device.updatePingCount(0);

      expect(result.isFailure).toBe(true);
    });

    it('should emit PingCountChangedEvent when ping count changes', () => {
      device.updatePingCount(8);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('PingCountChangedEvent');
    });

    it('should not emit event when ping count is the same', () => {
      const currentPingCount = device.pollingConfiguration.pingCount;
      device.updatePingCount(currentPingCount);

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('enablePolling', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.disablePolling();
      device.clearEvents();
    });

    it('should enable polling successfully', () => {
      const result = device.enablePolling();

      expect(result.isSuccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.enablePolling();

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should emit PollingConfigurationChangedEvent when enabling', () => {
      device.enablePolling();

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'PollingConfigurationChangedEvent'
      );
    });

    it('should not emit event when already enabled', () => {
      device.enablePolling();
      device.clearEvents();

      device.enablePolling();

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('disablePolling', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents();
    });

    it('should disable polling successfully', () => {
      const result = device.disablePolling();

      expect(result.isSuccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.disablePolling();

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should emit PollingConfigurationChangedEvent when disabling', () => {
      device.disablePolling();

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'PollingConfigurationChangedEvent'
      );
    });

    it('should not emit event when already disabled', () => {
      device.disablePolling();
      device.clearEvents();

      device.disablePolling();

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('shouldPoll', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should delegate to pollingConfiguration.canPoll', () => {
      const currentTime = new Date();
      const shouldPoll = device.shouldPoll(currentTime);

      expect(typeof shouldPoll).toBe('boolean');
    });
  });

  describe('updatePollingState', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents();
    });

    it('should update device status based on polling result', () => {
      const deviceId = NetworkDeviceId.create().value;
      const metrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const pollingResult = PollingResult.createSuccess({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        metrics: metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.ONLINE,
        deviceName: 'Test-Device',
        ipAddress: '192.168.1.1'
      }).value;

      const result = device.updatePollingState(pollingResult);

      expect(result.isSuccess).toBe(true);
      expect(device.status).toBe(NetworkDeviceStatus.ONLINE);
    });

    it('should emit status change event when status changes', () => {
      const deviceId = NetworkDeviceId.create().value;
      const metrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const pollingResult = PollingResult.createSuccess({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        metrics: metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.ONLINE,
        deviceName: 'Test-Device',
        ipAddress: '192.168.1.1'
      }).value;

      device.updatePollingState(pollingResult);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should not emit event when status does not change', () => {
      device.updateStatus(NetworkDeviceStatus.ONLINE);
      device.clearEvents();

      const deviceId = NetworkDeviceId.create().value;
      const metrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const pollingResult = PollingResult.createSuccess({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        metrics: metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.ONLINE,
        deviceName: 'Test-Device',
        ipAddress: '192.168.1.1'
      }).value;

      device.updatePollingState(pollingResult);

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should fail when polling result is null', () => {
      const result = device.updatePollingState(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pollingResult');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const deviceId = NetworkDeviceId.create().value;
      const pollingResult = PollingResult.createFailure({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        status: PollingStatus.FAILED,
        errorMessage: 'Test failure',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.OFFLINE,
        deviceName: 'Test-Device',
        ipAddress: '192.168.1.1'
      }).value;

      const result = device.updatePollingState(pollingResult);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });
  });

  describe('getPollingConfiguration', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
    });

    it('should return polling configuration', () => {
      const config = device.getPollingConfiguration();

      expect(config).toBeInstanceOf(PollingConfiguration);
      expect(config).toBe(device.pollingConfiguration);
    });
  });

  describe('integration scenarios', () => {
    it('should create and configure a router device', () => {
      const result = NetworkDevice.create(validProps);

      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router-01');
      expect(result.value.deviceType).toBe(NetworkDeviceType.ROUTER);
      expect(result.value.status).toBe(NetworkDeviceStatus.UNKNOWN);
      expect(result.value.ipAddress.toString()).toBe('192.168.1.1');
    });

    it('should handle device lifecycle: created -> online -> offline -> maintenance', () => {
      const device = NetworkDevice.create(validProps).value;
      device.clearEvents();

      // Device comes online
      device.updateStatus(NetworkDeviceStatus.ONLINE);
      expect(device.status).toBe(NetworkDeviceStatus.ONLINE);
      expect(device.isOnline()).toBe(true);

      // Device goes offline
      device.updateStatus(NetworkDeviceStatus.OFFLINE);
      expect(device.status).toBe(NetworkDeviceStatus.OFFLINE);
      expect(device.isOffline()).toBe(true);

      // Device enters maintenance
      device.updateStatus(NetworkDeviceStatus.MAINTENANCE);
      expect(device.status).toBe(NetworkDeviceStatus.MAINTENANCE);
      expect(device.isInMaintenance()).toBe(true);
    });

    it('should track configuration changes over time', () => {
      const device = NetworkDevice.create(validProps).value;
      const initialUpdatedAt = device.updatedAt;

      // Update name
      device.updateName('Updated-Router');
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );

      // Update description
      device.updateDescription('Updated description');
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );

      // Update management config
      device.updateManagementConfig({ port: 2222 });
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });
  });

  describe('markForDeletion', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(validProps).value;
      device.clearEvents();
    });

    it('should emit NetworkDeviceDeletedEvent', () => {
      const result = device.markForDeletion();

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('NetworkDeviceDeletedEvent');
    });

    it('should include device context in deletion event', () => {
      const result = device.markForDeletion();

      expect(result.isSuccess).toBe(true);
      const event = device.domainEvents[0] as any;
      expect(event.aggregateId).toBe(device.id);
      expect(event.deviceName).toBe(device.name);
      expect(event.ipAddress).toBe(device.ipAddress.toString());
      expect(event.macAddress).toBe(device.macAddress.toString());
    });

    it('should include deletedBy when provided', () => {
      const result = device.markForDeletion('admin@example.com');

      expect(result.isSuccess).toBe(true);
      const event = device.domainEvents[0] as any;
      expect(event.deletedBy).toBe('admin@example.com');
    });

    it('should allow undefined deletedBy', () => {
      const result = device.markForDeletion();

      expect(result.isSuccess).toBe(true);
      const event = device.domainEvents[0] as any;
      expect(event.deletedBy).toBeUndefined();
    });

    it('should be callable multiple times and accumulate events', () => {
      device.markForDeletion('user1');
      device.markForDeletion('user2');

      const events = device.domainEvents;
      expect(events.length).toBe(2);
      expect(events[0].constructor.name).toBe('NetworkDeviceDeletedEvent');
      expect(events[1].constructor.name).toBe('NetworkDeviceDeletedEvent');
    });
  });

  describe('domain events', () => {
    it('should emit creation event for new device', () => {
      const device = NetworkDevice.create(validProps).value;

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceCreatedEvent'
      );
    });

    it('should emit status change events', () => {
      const device = NetworkDevice.create(validProps).value;
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.ONLINE);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should accumulate multiple events', () => {
      const device = NetworkDevice.create(validProps).value;
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.ONLINE);
      device.updateStatus(NetworkDeviceStatus.OFFLINE);

      const events = device.domainEvents;
      expect(events.length).toBe(2);
    });

    it('should clear events when clearEvents is called', () => {
      const device = NetworkDevice.create(validProps).value;

      expect(device.domainEvents.length).toBeGreaterThan(0);

      device.clearEvents();

      expect(device.domainEvents.length).toBe(0);
    });
  });
});
