import {
  NetworkDeviceDeletedEvent,
  NetworkDeviceDeletedEventProps,
  NetworkDeviceId,
  IPAddress,
  MACAddress
} from '../../../src/domain';

describe('NetworkDeviceDeletedEvent', () => {
  let aggregateId: NetworkDeviceId;
  const deviceName = 'Router-01';
  let ipAddress: IPAddress;
  let macAddress: MACAddress;
  const deletedBy = 'admin@example.com';
  let dateTimeOccurred: Date;

  beforeEach(() => {
    aggregateId = NetworkDeviceId.create().value;
    ipAddress = IPAddress.create('192.168.1.1').value;
    macAddress = MACAddress.create('00:1A:2B:3C:4D:5E').value;
    dateTimeOccurred = new Date();
  });

  const createEventProps = (
    overrides?: Partial<NetworkDeviceDeletedEventProps>
  ): NetworkDeviceDeletedEventProps => ({
    aggregateId,
    deviceName,
    ipAddress,
    macAddress,
    deletedBy,
    dateTimeOccurred,
    ...overrides
  });

  describe('constructor', () => {
    it('should create an event with all required properties', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());

      expect(event).toBeDefined();
      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.ipAddress).toBeInstanceOf(IPAddress);
      expect(event.macAddress).toBe(macAddress);
      expect(event.macAddress).toBeInstanceOf(MACAddress);
      expect(event.deletedBy).toBe(deletedBy);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());

      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should handle optional deletedBy', () => {
      const event = new NetworkDeviceDeletedEvent(
        createEventProps({ deletedBy: undefined })
      );

      expect(event.deletedBy).toBeUndefined();
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());

      expect(() => {
        (event as any).props.deviceName = 'Modified';
      }).toThrow();
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregateId', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.aggregateId).toBeInstanceOf(NetworkDeviceId);
    });
  });

  describe('property getters', () => {
    it('should return all properties', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());

      expect(event.deviceName).toBe(deviceName);
      expect(event.ipAddress).toBe(ipAddress);
      expect(event.macAddress).toBe(macAddress);
      expect(event.deletedBy).toBe(deletedBy);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });
  });

  describe('toString', () => {
    it('should return formatted string representation', () => {
      const event = new NetworkDeviceDeletedEvent(createEventProps());
      const str = event.toString();

      expect(str).toContain('NetworkDeviceDeletedEvent');
      expect(str).toContain(aggregateId.toString());
    });
  });

  describe('real-world scenarios', () => {
    it('should represent manual deletion by administrator', () => {
      const event = new NetworkDeviceDeletedEvent(
        createEventProps({
          deviceName: 'Old-Router-01',
          deletedBy: 'admin@company.com'
        })
      );

      expect(event.deviceName).toContain('Old-Router');
      expect(event.deletedBy).toContain('admin');
    });

    it('should represent automatic cleanup by system', () => {
      const event = new NetworkDeviceDeletedEvent(
        createEventProps({ deletedBy: 'system:auto-cleanup' })
      );

      expect(event.deletedBy).toContain('system');
    });

    it('should represent deletion without tracking who deleted', () => {
      const event = new NetworkDeviceDeletedEvent(
        createEventProps({ deletedBy: undefined })
      );

      expect(event.deletedBy).toBeUndefined();
    });
  });
});
