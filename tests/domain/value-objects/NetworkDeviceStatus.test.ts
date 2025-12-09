import {
  NetworkDeviceStatus,
  isValidNetworkDeviceStatus,
  getDeviceStatusDisplayName,
  getDeviceStatusColor,
  isValidStatusTransition
} from '../../../src/domain';

describe('NetworkDeviceStatus Enum', () => {
  it('should contain the correct enum values', () => {
    expect(NetworkDeviceStatus.ONLINE).toBe('ONLINE');
    expect(NetworkDeviceStatus.OFFLINE).toBe('OFFLINE');
    expect(NetworkDeviceStatus.MAINTENANCE).toBe('MAINTENANCE');
    expect(NetworkDeviceStatus.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('isValidNetworkDeviceStatus', () => {
  it('should return true for valid statuses', () => {
    expect(isValidNetworkDeviceStatus('ONLINE')).toBe(true);
    expect(isValidNetworkDeviceStatus('OFFLINE')).toBe(true);
    expect(isValidNetworkDeviceStatus('MAINTENANCE')).toBe(true);
    expect(isValidNetworkDeviceStatus('UNKNOWN')).toBe(true);
  });

  it('should return false for invalid statuses', () => {
    expect(isValidNetworkDeviceStatus('online')).toBe(false);
    expect(isValidNetworkDeviceStatus('INVALID')).toBe(false);
    expect(isValidNetworkDeviceStatus('')).toBe(false);
    expect(isValidNetworkDeviceStatus('1234')).toBe(false);
  });
});

describe('getDeviceStatusDisplayName', () => {
  it('should return correct display names', () => {
    expect(
      getDeviceStatusDisplayName(NetworkDeviceStatus.ONLINE)
    ).toBe('Online');
    expect(
      getDeviceStatusDisplayName(NetworkDeviceStatus.OFFLINE)
    ).toBe('Offline');
    expect(
      getDeviceStatusDisplayName(NetworkDeviceStatus.MAINTENANCE)
    ).toBe('Maintenance');
    expect(
      getDeviceStatusDisplayName(NetworkDeviceStatus.UNKNOWN)
    ).toBe('Unknown');
  });
});

describe('getDeviceStatusColor', () => {
  it('should return correct color codes', () => {
    expect(getDeviceStatusColor(NetworkDeviceStatus.ONLINE)).toBe(
      'green'
    );
    expect(getDeviceStatusColor(NetworkDeviceStatus.OFFLINE)).toBe(
      'red'
    );
    expect(
      getDeviceStatusColor(NetworkDeviceStatus.MAINTENANCE)
    ).toBe('yellow');
    expect(getDeviceStatusColor(NetworkDeviceStatus.UNKNOWN)).toBe(
      'gray'
    );
  });
});

describe('isValidStatusTransition', () => {
  it('should allow UNKNOWN → any transition', () => {
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.ONLINE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.OFFLINE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.UNKNOWN,
        NetworkDeviceStatus.MAINTENANCE
      )
    ).toBe(true);
  });

  it('should allow transitions to MAINTENANCE from any status', () => {
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.MAINTENANCE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.MAINTENANCE
      )
    ).toBe(true);
  });

  it('should allow MAINTENANCE → any status (exiting maintenance)', () => {
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.ONLINE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.OFFLINE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.MAINTENANCE,
        NetworkDeviceStatus.UNKNOWN
      )
    ).toBe(true);
  });

  it('should allow ONLINE ↔ OFFLINE transitions', () => {
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.OFFLINE
      )
    ).toBe(true);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.ONLINE
      )
    ).toBe(true);
  });

  it('should NOT allow invalid transitions', () => {
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.ONLINE,
        NetworkDeviceStatus.UNKNOWN
      )
    ).toBe(false);
    expect(
      isValidStatusTransition(
        NetworkDeviceStatus.OFFLINE,
        NetworkDeviceStatus.UNKNOWN
      )
    ).toBe(false);
  });
});
