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
  NetworkDeviceProps,
  ActivationStatus
} from '../../../src/domain';

describe('NetworkDevice', () => {
  let validProps: NetworkDeviceProps;
  let pollingConfig: PollingConfiguration;

  beforeEach(() => {
    const networkDeviceId = NetworkDeviceId.create().value;
    pollingConfig = PollingConfiguration.createDefault(
      networkDeviceId,
      NetworkDeviceId.create().value
    ).value;

    validProps = {
      name: 'Router-01',
      deviceType: NetworkDeviceType.createRouter(),
      status: NetworkDeviceStatus.createUnknown(),
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
      // REQ-002 fields
      activationStatus: ActivationStatus.ACTIVE,
      activatedAt: null,
      activatedBy: null,
      deletedAt: null,
      deletedBy: null,
      replacedByDeviceId: null,
      replacedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('create', () => {
    it('should create a device with valid properties', () => {
      const result = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(NetworkDevice);
      expect(result.value.name).toBe('Router-01');
      expect(result.value.deviceType.toString()).toBe(
        NetworkDeviceType.ROUTER
      );
      expect(result.value.status.toString()).toBe(
        NetworkDeviceStatus.UNKNOWN
      );
    });

    it('should require mandatory ID parameter', () => {
      const id = NetworkDeviceId.create().value;
      const result = NetworkDevice.create(validProps, id);

      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeDefined();
      expect(result.value.id).toBe(id);
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

      const result = NetworkDevice.create(
        propsWithoutDates,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.installDate).toBeInstanceOf(Date);
      expect(result.value.createdAt).toBeInstanceOf(Date);
      expect(result.value.updatedAt).toBeInstanceOf(Date);
    });

    it('should emit NetworkDeviceCreatedEvent for new device', () => {
      const result = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      const events = result.value.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceCreatedEvent'
      );
    });

    it('should fail when name is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is undefined', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: undefined as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is empty string', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: ''
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name is only whitespace', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: '   '
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when name exceeds 255 characters', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: 'A'.repeat(256)
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('255');
    });

    it('should accept name with exactly 255 characters', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          name: 'A'.repeat(255)
        },
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when deviceType is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          deviceType: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceType');
    });

    it('should fail when status is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          status: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('status');
    });

    it('should fail when ipAddress is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          ipAddress: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ipAddress');
    });

    it('should fail when macAddress is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          macAddress: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('macAddress');
    });

    it('should fail when managementPort is null', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: null as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is not a number', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: 'not-a-number' as any
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is below range (0)', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: 0
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should fail when managementPort is above range (65536)', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: 65536
        },
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('managementPort');
    });

    it('should accept managementPort at minimum range (1)', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: 1
        },
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(1);
    });

    it('should accept managementPort at maximum range (65535)', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          managementPort: 65535
        },
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(65535);
    });

    it('should accept null description', () => {
      const result = NetworkDevice.create(
        {
          ...validProps,
          description: null
        },
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
    });
  });

  describe('getters', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return correct name', () => {
      expect(device.name).toBe('Router-01');
    });

    it('should return correct deviceType', () => {
      expect(
        device.deviceType.equals(NetworkDeviceType.createRouter())
      ).toBe(true);
    });

    it('should return correct status', () => {
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.UNKNOWN
      );
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents(); // Clear creation event
    });

    it('should update status successfully', () => {
      const result = device.updateStatus(
        NetworkDeviceStatus.createOnline()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
    });

    it('should emit NetworkDeviceStatusChangedEvent', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      // Small delay to ensure timestamp changes
      const result = device.updateStatus(
        NetworkDeviceStatus.createOnline()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should not emit event when status is the same', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.createOnline());

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should fail when status is null', () => {
      const result = device.updateStatus(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('status');
    });

    it('should handle ONLINE to OFFLINE transition', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());
      device.clearEvents();

      const result = device.updateStatus(
        NetworkDeviceStatus.createOffline()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.OFFLINE
      );
      expect(device.domainEvents.length).toBe(1);
    });

    it('should handle OFFLINE to ONLINE transition', () => {
      device.updateStatus(NetworkDeviceStatus.createOffline());
      device.clearEvents();

      const result = device.updateStatus(
        NetworkDeviceStatus.createOnline()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
    });

    it('should handle MAINTENANCE status', () => {
      const result = device.updateStatus(
        NetworkDeviceStatus.createMaintenance()
      );

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.MAINTENANCE
      );
    });
  });

  describe('updateName', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['description']);
      expect(event.previousValues.description).toBe(oldDescription);
      expect(event.newValues.description).toBe(
        'New description text'
      );
    });

    it('should emit event when description is set to null', () => {
      device.clearEvents();
      const oldDescription = device.description;

      const result = device.updateDescription(null);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['managementProtocol']);
      expect(event.previousValues.managementProtocol).toBe(
        oldProtocol
      );
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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

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
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual([
        'managementPort',
        'managementProtocol',
        'enabledRemoteAccess'
      ]);
      expect(event.previousValues.managementPort).toBe(oldPort);
      expect(event.previousValues.managementProtocol).toBe(
        oldProtocol
      );
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

      const result = device.updateManagementConfig({
        port: currentPort
      });

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('isOnline', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return true when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());

      expect(device.isOnline()).toBe(true);
    });

    it('should return false when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOffline());

      expect(device.isOnline()).toBe(false);
    });

    it('should return false when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.createMaintenance());

      expect(device.isOnline()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isOnline()).toBe(false);
    });
  });

  describe('isOffline', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return true when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOffline());

      expect(device.isOffline()).toBe(true);
    });

    it('should return false when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());

      expect(device.isOffline()).toBe(false);
    });

    it('should return false when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.createMaintenance());

      expect(device.isOffline()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isOffline()).toBe(false);
    });
  });

  describe('isInMaintenance', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return true when status is MAINTENANCE', () => {
      device.updateStatus(NetworkDeviceStatus.createMaintenance());

      expect(device.isInMaintenance()).toBe(true);
    });

    it('should return false when status is ONLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());

      expect(device.isInMaintenance()).toBe(false);
    });

    it('should return false when status is OFFLINE', () => {
      device.updateStatus(NetworkDeviceStatus.createOffline());

      expect(device.isInMaintenance()).toBe(false);
    });

    it('should return false when status is UNKNOWN', () => {
      expect(device.isInMaintenance()).toBe(false);
    });
  });

  describe('hasRemoteAccessEnabled', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return true when remote access is enabled', () => {
      expect(device.hasRemoteAccessEnabled()).toBe(true);
    });

    it('should return false when remote access is disabled', () => {
      device.updateManagementConfig({ enableRemoteAccess: false });

      expect(device.hasRemoteAccessEnabled()).toBe(false);
    });
  });

  describe('configurePollingInterval', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();
    });

    it('should configure polling interval successfully', () => {
      const newInterval = PollingInterval.create(120).value;
      const result = device.configurePollingInterval(newInterval);

      expect(result.isSuccess).toBe(true);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;
      const newInterval = PollingInterval.create(120).value;

      const result = device.configurePollingInterval(newInterval);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should emit PollingIntervalChangedEvent when interval changes', () => {
      const newInterval = PollingInterval.create(120).value;
      device.configurePollingInterval(newInterval);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'PollingIntervalChangedEvent'
      );
    });

    it('should not emit event when interval is the same', () => {
      const currentInterval = device.pollingConfiguration.interval;
      device.configurePollingInterval(currentInterval);

      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updatePingCount', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      expect(events[0].constructor.name).toBe(
        'PingCountChangedEvent'
      );
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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
        deviceStatus: NetworkDeviceStatus.createOnline(),
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const result = device.updatePollingState(pollingResult);

      expect(result.isSuccess).toBe(true);
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
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
        deviceStatus: NetworkDeviceStatus.createOnline(),
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      device.updatePollingState(pollingResult);

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should not emit event when status does not change', () => {
      device.updateStatus(NetworkDeviceStatus.createOnline());
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
        deviceStatus: NetworkDeviceStatus.createOnline(),
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
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
        status: PollingStatus.createFailed(),
        errorMessage: 'Test failure',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline(),
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const result = device.updatePollingState(pollingResult);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });
  });

  describe('integration scenarios', () => {
    it('should create and configure a router device', () => {
      const result = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router-01');
      expect(result.value.deviceType.toString()).toBe(
        NetworkDeviceType.ROUTER
      );
      expect(result.value.status.toString()).toBe(
        NetworkDeviceStatus.UNKNOWN
      );
      expect(result.value.ipAddress.toString()).toBe('192.168.1.1');
    });

    it('should handle device lifecycle: created -> online -> offline -> maintenance', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();

      // Device comes online
      device.updateStatus(NetworkDeviceStatus.createOnline());
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
      expect(device.isOnline()).toBe(true);

      // Device goes offline
      device.updateStatus(NetworkDeviceStatus.createOffline());
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.OFFLINE
      );
      expect(device.isOffline()).toBe(true);

      // Device enters maintenance
      device.updateStatus(NetworkDeviceStatus.createMaintenance());
      expect(device.status.toString()).toBe(
        NetworkDeviceStatus.MAINTENANCE
      );
      expect(device.isInMaintenance()).toBe(true);
    });

    it('should track configuration changes over time', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
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

  // ========== REQ-002: Activation Workflow Tests ==========

  describe('REQ-002: create with DRAFT activation status', () => {
    it('should create a DRAFT device with only IP and MAC address', () => {
      const draftProps: NetworkDeviceProps = {
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
        activationStatus: ActivationStatus.DRAFT,
        name: null as any,
        deviceType: null as any,
        status: null as any,
        description: null,
        installDate: new Date(),
        connectivityType: null as any,
        managementProtocol: null as any,
        managementPort: null as any,
        enabledRemoteAccess: false,
        deviceId: null as any,
        pollingConfiguration: null as any,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.DRAFT
      );
      expect(result.value.ipAddress.toString()).toBe('192.168.1.100');
      expect(result.value.macAddress.toString()).toBe(
        'AA:BB:CC:DD:EE:FF'
      );
    });

    it('should default to DRAFT status when not provided', () => {
      const propsWithoutStatus = { ...validProps };
      delete (propsWithoutStatus as any).activationStatus;
      propsWithoutStatus.name = null as any;
      propsWithoutStatus.deviceType = null as any;
      propsWithoutStatus.status = null as any;
      propsWithoutStatus.connectivityType = null as any;
      propsWithoutStatus.managementProtocol = null as any;
      propsWithoutStatus.managementPort = null as any;
      propsWithoutStatus.deviceId = null as any;
      propsWithoutStatus.pollingConfiguration = null as any;

      const result = NetworkDevice.create(
        propsWithoutStatus,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.DRAFT
      );
    });

    it('should fail to create ACTIVE device without required fields', () => {
      const incompleteProps = {
        ...validProps,
        name: null as any,
        activationStatus: ActivationStatus.ACTIVE
      };

      const result = NetworkDevice.create(
        incompleteProps,
        NetworkDeviceId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should create ACTIVE device with all required fields', () => {
      const result = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
    });
  });

  describe('REQ-002: activate', () => {
    let draftDevice: NetworkDevice;

    beforeEach(() => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT,
        name: 'Device-001',
        deviceType: NetworkDeviceType.createRouter(),
        status: NetworkDeviceStatus.createUnknown(),
        connectivityType: ConnectivityType.ETHERNET,
        managementProtocol: ManagementProtocol.SSH,
        managementPort: 22,
        deviceId: 'device-001',
        pollingConfiguration: PollingConfiguration.createDefault(
          NetworkDeviceId.create().value,
          NetworkDeviceId.create().value
        ).value
      };
      draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();
    });

    it('should activate a DRAFT device successfully', () => {
      const result = draftDevice.activate('user-123');

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
      expect(draftDevice.activatedAt).toBeInstanceOf(Date);
      expect(draftDevice.activatedBy).toBe('user-123');
    });

    it('should emit NetworkDeviceActivatedEvent', () => {
      draftDevice.activate('user-123');

      const events = draftDevice.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceActivatedEvent'
      );

      const event = events[0] as any;
      expect(event.aggregateId).toBe(draftDevice.id);
      expect(event.deviceName).toBe(draftDevice.name);
      expect(event.activatedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = draftDevice.updatedAt;

      draftDevice.activate('user-123');

      expect(draftDevice.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail to activate already ACTIVE device', () => {
      draftDevice.activate('user-123');
      draftDevice.clearEvents();

      const result = draftDevice.activate('user-456');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already in ACTIVE state');
    });

    it('should fail to activate when activatedBy is null', () => {
      const result = draftDevice.activate(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('activatedBy');
    });

    it('should fail to activate when activatedBy is undefined', () => {
      const result = draftDevice.activate(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail to activate when activatedBy is not a string', () => {
      const result = draftDevice.activate(123 as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail to activate device with missing required fields', () => {
      const incompleteDraftProps = {
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
        activationStatus: ActivationStatus.DRAFT,
        name: null as any,
        deviceType: null as any,
        status: null as any,
        description: null,
        installDate: new Date(),
        connectivityType: null as any,
        managementProtocol: null as any,
        managementPort: null as any,
        enabledRemoteAccess: false,
        deviceId: null as any,
        pollingConfiguration: null as any,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const incompleteDevice = NetworkDevice.create(
        incompleteDraftProps,
        NetworkDeviceId.create().value
      ).value;
      const result = incompleteDevice.activate('user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('REQ-002: canActivate', () => {
    it('should return success when all required fields are present', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      const result = device.canActivate();

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when name is missing', () => {
      const draftProps = {
        ...validProps,
        name: null as any,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      const result = device.canActivate();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name');
    });

    it('should fail when name is empty string', () => {
      const draftProps = {
        ...validProps,
        name: '   ',
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      const result = device.canActivate();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name cannot be empty');
    });

    it('should fail when deviceType is missing', () => {
      const draftProps = {
        ...validProps,
        deviceType: null as any,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      const result = device.canActivate();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceType');
    });

    it('should fail when multiple fields are missing', () => {
      const draftProps = {
        ipAddress: IPAddress.create('192.168.1.100').value,
        macAddress: MACAddress.create('AA:BB:CC:DD:EE:FF').value,
        activationStatus: ActivationStatus.DRAFT,
        name: null as any,
        deviceType: null as any,
        status: null as any,
        description: null,
        installDate: new Date(),
        connectivityType: null as any,
        managementProtocol: null as any,
        managementPort: null as any,
        enabledRemoteAccess: false,
        deviceId: null as any,
        pollingConfiguration: null as any,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      const result = device.canActivate();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('REQ-002: isDraft and isActive', () => {
    it('should return true for isDraft when device is in DRAFT state', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      expect(device.isDraft()).toBe(true);
      expect(device.isActive()).toBe(false);
    });

    it('should return true for isActive when device is in ACTIVE state', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;

      expect(device.isActive()).toBe(true);
      expect(device.isDraft()).toBe(false);
    });

    it('should update state after activation', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      expect(device.isDraft()).toBe(true);

      device.activate('user-123');

      expect(device.isDraft()).toBe(false);
      expect(device.isActive()).toBe(true);
    });
  });

  describe('REQ-002: getters for activation fields', () => {
    it('should return activation status', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      expect(device.activationStatus).toBe(ActivationStatus.ACTIVE);
    });

    it('should return null for activatedAt when not activated', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      expect(device.activatedAt).toBeNull();
    });

    it('should return activatedAt after activation', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const device = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;

      device.activate('user-123');

      expect(device.activatedAt).toBeInstanceOf(Date);
      expect(device.activatedBy).toBe('user-123');
    });
  });

  // ========== REQ-002: Soft Delete & Restore Tests ==========

  describe('REQ-002: markForDeletion', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();
    });

    it('should mark device for deletion successfully', () => {
      const result = device.markForDeletion('admin@example.com');

      expect(result.isSuccess).toBe(true);
      expect(device.deletedAt).toBeInstanceOf(Date);
      expect(device.deletedBy).toBe('admin@example.com');
    });

    it('should mark device for deletion without deletedBy', () => {
      const result = device.markForDeletion();

      expect(result.isSuccess).toBe(true);
      expect(device.deletedAt).toBeInstanceOf(Date);
      expect(device.deletedBy).toBeNull();
    });

    it('should emit NetworkDeviceDeletedEvent', () => {
      const result = device.markForDeletion('user-123');

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceDeletedEvent'
      );

      const event = events[0] as any;
      expect(event.aggregateId).toBe(device.id);
      expect(event.deviceName).toBe(device.name);
      expect(event.ipAddress).toBe(device.ipAddress);
      expect(event.macAddress).toBe(device.macAddress);
      expect(event.deletedBy).toBe('user-123');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      device.markForDeletion('user-123');

      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when device is already deleted', () => {
      device.markForDeletion('user-123');

      const result = device.markForDeletion('user-456');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already marked for deletion');
    });
  });

  describe('REQ-002: isDeleted', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return false when device is not deleted', () => {
      expect(device.isDeleted()).toBe(false);
    });

    it('should return true when device is marked for deletion', () => {
      device.markForDeletion();

      expect(device.isDeleted()).toBe(true);
    });

    it('should return false after restore', () => {
      device.markForDeletion('user-123');
      device.restore('user-456');

      expect(device.isDeleted()).toBe(false);
    });
  });

  describe('REQ-002: restore', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.markForDeletion('user-delete');
      device.clearEvents();
    });

    it('should restore deleted device successfully', () => {
      const result = device.restore('user-restore');

      expect(result.isSuccess).toBe(true);
      expect(device.deletedAt).toBeNull();
      expect(device.deletedBy).toBeNull();
    });

    it('should emit NetworkDeviceRestoredEvent', () => {
      device.restore('user-restore');

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceRestoredEvent'
      );

      const event = events[0] as any;
      expect(event.aggregateId).toBe(device.id);
      expect(event.deviceName).toBe(device.name);
      expect(event.restoredBy).toBe('user-restore');
      expect(event.deletedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      device.restore('user-restore');

      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail to restore when restoredBy is null', () => {
      const result = device.restore(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('restoredBy');
    });

    it('should fail to restore when restoredBy is undefined', () => {
      const result = device.restore(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail to restore when restoredBy is not a string', () => {
      const result = device.restore(123 as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail to restore device that is not deleted', () => {
      device.restore('user-restore');

      const result = device.restore('user-restore-again');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not in deleted state');
    });
  });

  describe('REQ-002: isWithinGracePeriod', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return false when device is not deleted', () => {
      expect(device.isWithinGracePeriod()).toBe(false);
    });

    it('should return true when device is just deleted', () => {
      device.markForDeletion();

      expect(device.isWithinGracePeriod()).toBe(true);
    });

    it('should return true for device deleted less than 7 days ago', () => {
      device.markForDeletion('user-123');

      // Simulate deletion 6 days ago
      const sixDaysAgo = new Date(
        Date.now() - 6 * 24 * 60 * 60 * 1000
      );
      (device as any).props.deletedAt = sixDaysAgo;

      expect(device.isWithinGracePeriod()).toBe(true);
    });

    it('should return false for device deleted more than 7 days ago', () => {
      device.markForDeletion('user-123');

      // Simulate deletion 8 days ago
      const eightDaysAgo = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000
      );
      (device as any).props.deletedAt = eightDaysAgo;

      expect(device.isWithinGracePeriod()).toBe(false);
    });

    it('should return true exactly at 7 days', () => {
      device.markForDeletion('user-123');

      // Simulate deletion exactly 7 days ago
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      );
      (device as any).props.deletedAt = sevenDaysAgo;

      expect(device.isWithinGracePeriod()).toBe(true);
    });
  });

  describe('REQ-002: canRestore', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return success when device is deleted and within grace period', () => {
      device.markForDeletion();

      const result = device.canRestore();

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when device is not deleted', () => {
      const result = device.canRestore();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not in deleted state');
    });

    it('should fail when grace period has expired', () => {
      device.markForDeletion('user-123');

      // Simulate deletion 8 days ago
      const eightDaysAgo = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000
      );
      (device as any).props.deletedAt = eightDaysAgo;

      const result = device.canRestore();

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('grace period has expired');
    });
  });

  describe('REQ-002: getters for soft delete fields', () => {
    it('should return null for deletedAt when not deleted', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      expect(device.deletedAt).toBeNull();
      expect(device.deletedBy).toBeNull();
    });

    it('should return deletedAt and deletedBy after deletion', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.markForDeletion('user-123');

      expect(device.deletedAt).toBeInstanceOf(Date);
      expect(device.deletedBy).toBe('user-123');
    });
  });

  // ========== REQ-002: Device Replacement Tests ==========

  describe('REQ-002: markAsReplaced', () => {
    let oldDevice: NetworkDevice;
    let newDeviceId: NetworkDeviceId;
    let newMacAddress: MACAddress;

    beforeEach(() => {
      oldDevice = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      oldDevice.markForDeletion('user-delete');
      oldDevice.clearEvents();
      newDeviceId = NetworkDeviceId.create().value;
      newMacAddress = MACAddress.create('FF:EE:DD:CC:BB:AA').value;
    });

    it('should mark device as replaced successfully', () => {
      const result = oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(result.isSuccess).toBe(true);
      expect(oldDevice.replacedByDeviceId).toBe(newDeviceId);
      expect(oldDevice.replacedAt).toBeInstanceOf(Date);
    });

    it('should emit DeviceReplacedEvent', () => {
      oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        false
      );

      const events = oldDevice.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe('DeviceReplacedEvent');

      const event = events[0] as any;
      expect(event.oldDeviceId).toBe(oldDevice.id);
      expect(event.newDeviceId).toBe(newDeviceId);
      expect(event.oldMacAddress).toBe(oldDevice.macAddress);
      expect(event.newMacAddress).toBe(newMacAddress);
      expect(event.configMigrated).toBe(true);
      expect(event.metadataMigrated).toBe(false);
      expect(event.replacedBy).toBe('user-replace');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = oldDevice.updatedAt;

      oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(oldDevice.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when device is not deleted', () => {
      const activeDevice = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;

      const result = activeDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must be in deleted state');
    });

    it('should fail when device is already replaced', () => {
      oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      const anotherDeviceId = NetworkDeviceId.create().value;
      const result = oldDevice.markAsReplaced(
        anotherDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already marked as replaced');
    });

    it('should fail when newDeviceId is null', () => {
      const result = oldDevice.markAsReplaced(
        null as any,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('newDeviceId');
    });

    it('should fail when newMacAddress is null', () => {
      const result = oldDevice.markAsReplaced(
        newDeviceId,
        null as any,
        'user-replace',
        true,
        true
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('newMacAddress');
    });

    it('should fail when replacedBy is null', () => {
      const result = oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        null as any,
        true,
        true
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('replacedBy');
    });

    it('should fail when replacedBy is not a string', () => {
      const result = oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        123 as any,
        true,
        true
      );

      expect(result.isFailure).toBe(true);
    });

    it('should track migration flags correctly', () => {
      oldDevice.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        false,
        true
      );

      const event = oldDevice.domainEvents[0] as any;
      expect(event.configMigrated).toBe(false);
      expect(event.metadataMigrated).toBe(true);
    });
  });

  describe('REQ-002: isReplaced', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
    });

    it('should return false when device is not replaced', () => {
      expect(device.isReplaced()).toBe(false);
    });

    it('should return true when device is marked as replaced', () => {
      device.markForDeletion('user-delete');
      const newDeviceId = NetworkDeviceId.create().value;
      const newMacAddress = MACAddress.create(
        'FF:EE:DD:CC:BB:AA'
      ).value;

      device.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(device.isReplaced()).toBe(true);
    });
  });

  describe('REQ-002: getters for replacement fields', () => {
    it('should return null for replacement fields when not replaced', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      expect(device.replacedByDeviceId).toBeNull();
      expect(device.replacedAt).toBeNull();
    });

    it('should return replacement fields after being replaced', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.markForDeletion('user-delete');

      const newDeviceId = NetworkDeviceId.create().value;
      const newMacAddress = MACAddress.create(
        'FF:EE:DD:CC:BB:AA'
      ).value;

      device.markAsReplaced(
        newDeviceId,
        newMacAddress,
        'user-replace',
        true,
        true
      );

      expect(device.replacedByDeviceId).toBe(newDeviceId);
      expect(device.replacedAt).toBeInstanceOf(Date);
    });
  });

  // ========== REQ-002: Property Update Methods Tests ==========

  describe('updateMacAddress', () => {
    let draftDevice: NetworkDevice;
    let activeDevice: NetworkDevice;

    beforeEach(() => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();

      activeDevice = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      activeDevice.clearEvents();
    });

    it('should update MAC address successfully when device is in DRAFT status', () => {
      const newMac = MACAddress.create('FF:EE:DD:CC:BB:AA').value;
      const result = draftDevice.updateMacAddress(newMac);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.macAddress.toString()).toBe(
        'FF:EE:DD:CC:BB:AA'
      );
    });

    it('should fail when device is in ACTIVE status', () => {
      const newMac = MACAddress.create('FF:EE:DD:CC:BB:AA').value;
      const result = activeDevice.updateMacAddress(newMac);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DRAFT status');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = draftDevice.updatedAt;
      const newMac = MACAddress.create('FF:EE:DD:CC:BB:AA').value;

      const result = draftDevice.updateMacAddress(newMac);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when MAC address is null', () => {
      const result = draftDevice.updateMacAddress(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('macAddress');
    });

    it('should fail when MAC address is undefined', () => {
      const result = draftDevice.updateMacAddress(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should emit NetworkDeviceUpdatedEvent when MAC changes', () => {
      const oldMac = draftDevice.macAddress.toString();
      const newMac = MACAddress.create('FF:EE:DD:CC:BB:AA').value;

      const result = draftDevice.updateMacAddress(newMac);

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['macAddress']);
      expect(event.previousValues.macAddress).toBe(oldMac);
      expect(event.newValues.macAddress).toBe('FF:EE:DD:CC:BB:AA');
    });

    it('should not emit event when MAC address does not change', () => {
      const currentMac = draftDevice.macAddress;

      const result = draftDevice.updateMacAddress(currentMac);

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updateDeviceType', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();
    });

    it('should update device type successfully', () => {
      const newType = NetworkDeviceType.createSwitch();
      const result = device.updateDeviceType(newType);

      expect(result.isSuccess).toBe(true);
      expect(device.deviceType.toString()).toBe(
        NetworkDeviceType.SWITCH
      );
    });

    it('should allow updating device type on ACTIVE device', () => {
      expect(device.isActive()).toBe(true);

      const newType = NetworkDeviceType.createFirewall();
      const result = device.updateDeviceType(newType);

      expect(result.isSuccess).toBe(true);
      expect(device.deviceType.toString()).toBe(
        NetworkDeviceType.FIREWALL
      );
    });

    it('should allow updating device type on DRAFT device', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();

      const newType = NetworkDeviceType.createAccessPoint();
      const result = draftDevice.updateDeviceType(newType);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.deviceType.toString()).toBe(
        NetworkDeviceType.ACCESS_POINT
      );
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;
      const newType = NetworkDeviceType.createSwitch();

      const result = device.updateDeviceType(newType);

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when device type is null', () => {
      const result = device.updateDeviceType(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceType');
    });

    it('should fail when device type is undefined', () => {
      const result = device.updateDeviceType(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should emit NetworkDeviceUpdatedEvent when device type changes', () => {
      const oldType = device.deviceType.toString();
      const newType = NetworkDeviceType.createSwitch();

      const result = device.updateDeviceType(newType);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['deviceType']);
      expect(event.previousValues.deviceType).toBe(oldType);
      expect(event.newValues.deviceType).toBe(
        NetworkDeviceType.SWITCH
      );
    });

    it('should not emit event when device type does not change', () => {
      const currentType = device.deviceType;

      const result = device.updateDeviceType(currentType);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should handle all device type transitions', () => {
      const deviceTypes = [
        NetworkDeviceType.createSwitch(),
        NetworkDeviceType.createAccessPoint(),
        NetworkDeviceType.createStation(),
        NetworkDeviceType.createPtpRadio(),
        NetworkDeviceType.createPtmpRadio(),
        NetworkDeviceType.createFirewall(),
        NetworkDeviceType.createServer(),
        NetworkDeviceType.createUnknown()
      ];

      for (const newType of deviceTypes) {
        const result = device.updateDeviceType(newType);
        expect(result.isSuccess).toBe(true);
        expect(device.deviceType.equals(newType)).toBe(true);
      }
    });
  });

  describe('updateConnectivityType', () => {
    let device: NetworkDevice;

    beforeEach(() => {
      device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();
    });

    it('should update connectivity type successfully', () => {
      const result = device.updateConnectivityType(
        ConnectivityType.FIBER_OPTIC
      );

      expect(result.isSuccess).toBe(true);
      expect(device.connectivityType).toBe(
        ConnectivityType.FIBER_OPTIC
      );
    });

    it('should allow updating connectivity type on ACTIVE device', () => {
      expect(device.isActive()).toBe(true);

      const result = device.updateConnectivityType(
        ConnectivityType.WIRELESS
      );

      expect(result.isSuccess).toBe(true);
      expect(device.connectivityType).toBe(ConnectivityType.WIRELESS);
    });

    it('should allow updating connectivity type on DRAFT device', () => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      const draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();

      const result = draftDevice.updateConnectivityType(
        ConnectivityType.DSL
      );

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.connectivityType).toBe(ConnectivityType.DSL);
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = device.updatedAt;

      const result = device.updateConnectivityType(
        ConnectivityType.FIBER_OPTIC
      );

      expect(result.isSuccess).toBe(true);
      expect(device.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when connectivity type is null', () => {
      const result = device.updateConnectivityType(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('connectivityType');
    });

    it('should fail when connectivity type is undefined', () => {
      const result = device.updateConnectivityType(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should emit NetworkDeviceUpdatedEvent when connectivity type changes', () => {
      const oldType = device.connectivityType;

      const result = device.updateConnectivityType(
        ConnectivityType.FIBER_OPTIC
      );

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['connectivityType']);
      expect(event.previousValues.connectivityType).toBe(oldType);
      expect(event.newValues.connectivityType).toBe(
        ConnectivityType.FIBER_OPTIC
      );
    });

    it('should not emit event when connectivity type does not change', () => {
      const currentType = device.connectivityType;

      const result = device.updateConnectivityType(currentType);

      expect(result.isSuccess).toBe(true);
      const events = device.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should handle all connectivity type transitions', () => {
      const connectivityTypes = [
        ConnectivityType.ETHERNET,
        ConnectivityType.FIBER_OPTIC,
        ConnectivityType.WIRELESS,
        ConnectivityType.DSL,
        ConnectivityType.SATELLITE,
        ConnectivityType.OTHER
      ];

      for (const newType of connectivityTypes) {
        const result = device.updateConnectivityType(newType);
        expect(result.isSuccess).toBe(true);
        expect(device.connectivityType).toBe(newType);
      }
    });
  });

  describe('updateDeviceId', () => {
    let draftDevice: NetworkDevice;
    let activeDevice: NetworkDevice;

    beforeEach(() => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();

      activeDevice = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      activeDevice.clearEvents();
    });

    it('should update device ID successfully when device is in DRAFT status', () => {
      const result = draftDevice.updateDeviceId('new-device-id-123');

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.deviceId).toBe('new-device-id-123');
    });

    it('should fail when device is in ACTIVE status', () => {
      const result = activeDevice.updateDeviceId('new-device-id-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DRAFT status');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = draftDevice.updatedAt;

      const result = draftDevice.updateDeviceId('new-device-id-123');

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when device ID is null', () => {
      const result = draftDevice.updateDeviceId(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceId');
    });

    it('should fail when device ID is undefined', () => {
      const result = draftDevice.updateDeviceId(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when device ID is not a string', () => {
      const result = draftDevice.updateDeviceId(123 as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when device ID is empty string', () => {
      const result = draftDevice.updateDeviceId('');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should fail when device ID is only whitespace', () => {
      const result = draftDevice.updateDeviceId('   ');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('empty');
    });

    it('should emit NetworkDeviceUpdatedEvent when device ID changes', () => {
      const oldDeviceId = draftDevice.deviceId;

      const result = draftDevice.updateDeviceId('new-device-id-123');

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['deviceId']);
      expect(event.previousValues.deviceId).toBe(oldDeviceId);
      expect(event.newValues.deviceId).toBe('new-device-id-123');
    });

    it('should not emit event when device ID does not change', () => {
      const currentDeviceId = draftDevice.deviceId;

      const result = draftDevice.updateDeviceId(currentDeviceId);

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(0);
    });
  });

  describe('updateInstallDate', () => {
    let draftDevice: NetworkDevice;
    let activeDevice: NetworkDevice;

    beforeEach(() => {
      const draftProps = {
        ...validProps,
        activationStatus: ActivationStatus.DRAFT
      };
      draftDevice = NetworkDevice.create(
        draftProps,
        NetworkDeviceId.create().value
      ).value;
      draftDevice.clearEvents();

      activeDevice = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      activeDevice.clearEvents();
    });

    it('should update install date successfully when device is in DRAFT status', () => {
      const newDate = new Date('2025-06-15');
      const result = draftDevice.updateInstallDate(newDate);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.installDate.getTime()).toBe(
        newDate.getTime()
      );
    });

    it('should fail when device is in ACTIVE status', () => {
      const newDate = new Date('2025-06-15');
      const result = activeDevice.updateInstallDate(newDate);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('DRAFT status');
    });

    it('should update updatedAt timestamp', () => {
      const oldUpdatedAt = draftDevice.updatedAt;
      const newDate = new Date('2025-06-15');

      const result = draftDevice.updateInstallDate(newDate);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime()
      );
    });

    it('should fail when install date is null', () => {
      const result = draftDevice.updateInstallDate(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('installDate');
    });

    it('should fail when install date is undefined', () => {
      const result = draftDevice.updateInstallDate(undefined as any);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when install date is not a valid Date', () => {
      const result = draftDevice.updateInstallDate(
        'not-a-date' as any
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('valid date');
    });

    it('should fail when install date is an invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = draftDevice.updateInstallDate(invalidDate);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('valid date');
    });

    it('should emit NetworkDeviceUpdatedEvent when install date changes', () => {
      const oldInstallDate = draftDevice.installDate;
      const newDate = new Date('2025-06-15');

      const result = draftDevice.updateInstallDate(newDate);

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceUpdatedEvent'
      );

      const event = events[0] as any;
      expect(event.changedFields).toEqual(['installDate']);
      expect(event.previousValues.installDate).toBe(
        oldInstallDate.toISOString()
      );
      expect(event.newValues.installDate).toBe(newDate.toISOString());
    });

    it('should not emit event when install date does not change', () => {
      const currentInstallDate = draftDevice.installDate;

      const result = draftDevice.updateInstallDate(
        new Date(currentInstallDate.getTime())
      );

      expect(result.isSuccess).toBe(true);
      const events = draftDevice.domainEvents;
      expect(events.length).toBe(0);
    });

    it('should accept future dates', () => {
      const futureDate = new Date('2030-01-01');
      const result = draftDevice.updateInstallDate(futureDate);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.installDate.getTime()).toBe(
        futureDate.getTime()
      );
    });

    it('should accept past dates', () => {
      const pastDate = new Date('2010-01-01');
      const result = draftDevice.updateInstallDate(pastDate);

      expect(result.isSuccess).toBe(true);
      expect(draftDevice.installDate.getTime()).toBe(
        pastDate.getTime()
      );
    });
  });

  describe('domain events', () => {
    it('should emit creation event for new device', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceCreatedEvent'
      );
    });

    it('should emit status change events', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.createOnline());

      const events = device.domainEvents;
      expect(events.length).toBe(1);
      expect(events[0].constructor.name).toBe(
        'NetworkDeviceStatusChangedEvent'
      );
    });

    it('should accumulate multiple events', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;
      device.clearEvents();

      device.updateStatus(NetworkDeviceStatus.createOnline());
      device.updateStatus(NetworkDeviceStatus.createOffline());

      const events = device.domainEvents;
      expect(events.length).toBe(2);
    });

    it('should clear events when clearEvents is called', () => {
      const device = NetworkDevice.create(
        validProps,
        NetworkDeviceId.create().value
      ).value;

      expect(device.domainEvents.length).toBeGreaterThan(0);

      device.clearEvents();

      expect(device.domainEvents.length).toBe(0);
    });
  });
});
