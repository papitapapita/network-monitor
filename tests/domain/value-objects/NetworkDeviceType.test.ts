import {
  NetworkDeviceType,
  getDefaultPollingInterval,
  fromRadioType,
  fromNetworkDeviceRole,
  isValidNetworkDeviceType,
  getDeviceTypeDisplayName
} from '../../../src/domain';

describe('NetworkDeviceType Enum', () => {
  it('should contain all expected enum values', () => {
    expect(Object.values(NetworkDeviceType)).toEqual([
      'ACCESS_POINT',
      'STATION',
      'PTP_RADIO',
      'PTMP_RADIO',
      'SWITCH',
      'ROUTER',
      'FIREWALL',
      'SERVER',
      'UNKNOWN'
    ]);
  });
});

describe('getDefaultPollingInterval()', () => {
  const expectedIntervals = [
    { type: NetworkDeviceType.ACCESS_POINT, interval: 30 },
    { type: NetworkDeviceType.STATION, interval: 300 },
    { type: NetworkDeviceType.PTP_RADIO, interval: 60 },
    { type: NetworkDeviceType.PTMP_RADIO, interval: 60 },
    { type: NetworkDeviceType.SWITCH, interval: 60 },
    { type: NetworkDeviceType.ROUTER, interval: 60 },
    { type: NetworkDeviceType.FIREWALL, interval: 60 },
    { type: NetworkDeviceType.SERVER, interval: 120 },
    { type: NetworkDeviceType.UNKNOWN, interval: 60 }
  ];

  expectedIntervals.forEach(({ type, interval }) => {
    it(`should return ${interval}s for ${type}`, () => {
      expect(getDefaultPollingInterval(type)).toBe(interval);
    });
  });

  it('should return 60 for unrecognized type', () => {
    expect(getDefaultPollingInterval('NOT_REAL' as any)).toBe(60);
  });
});

describe('fromRadioType()', () => {
  it('should map known radio types correctly', () => {
    expect(fromRadioType('ACCESS_POINT')).toBe(
      NetworkDeviceType.ACCESS_POINT
    );
    expect(fromRadioType('STATION')).toBe(NetworkDeviceType.STATION);
    expect(fromRadioType('PTP_RADIO')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
    expect(fromRadioType('PTMP_RADIO')).toBe(
      NetworkDeviceType.PTMP_RADIO
    );
  });

  it('should map secondary radio types to PTP_RADIO', () => {
    expect(fromRadioType('SECTOR_ANTENNA')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
    expect(fromRadioType('BACKHAUL_RADIO')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
    expect(fromRadioType('MIMO_RADIO')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
  });

  it('should handle unknown radio types as UNKNOWN', () => {
    expect(fromRadioType('UNKNOWN_RADIO')).toBe(
      NetworkDeviceType.UNKNOWN
    );
  });
});

describe('fromNetworkDeviceRole()', () => {
  it('should map switching and routing roles', () => {
    expect(fromNetworkDeviceRole('ROUTING')).toBe(
      NetworkDeviceType.ROUTER
    );
    expect(fromNetworkDeviceRole('SWITCHING')).toBe(
      NetworkDeviceType.SWITCH
    );
  });

  it('should map wireless roles to PTP_RADIO', () => {
    expect(fromNetworkDeviceRole('WIRELESS_BRIDGE')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
    expect(fromNetworkDeviceRole('RADIO_LINK')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
    expect(fromNetworkDeviceRole('BACKHAUL')).toBe(
      NetworkDeviceType.PTP_RADIO
    );
  });

  it('should map access to ACCESS_POINT', () => {
    expect(fromNetworkDeviceRole('WIRELESS_ACCESS')).toBe(
      NetworkDeviceType.ACCESS_POINT
    );
  });

  it('should map server-related roles to SERVER', () => {
    expect(fromNetworkDeviceRole('APPLICATION_HOSTING')).toBe(
      NetworkDeviceType.SERVER
    );
    expect(fromNetworkDeviceRole('DATABASE_HOSTING')).toBe(
      NetworkDeviceType.SERVER
    );
    expect(fromNetworkDeviceRole('DHCP')).toBe(
      NetworkDeviceType.SERVER
    );
  });

  it('should map security appliance roles to FIREWALL', () => {
    expect(fromNetworkDeviceRole('FIREWALL')).toBe(
      NetworkDeviceType.FIREWALL
    );
    expect(fromNetworkDeviceRole('UTM')).toBe(
      NetworkDeviceType.FIREWALL
    );
  });

  it('should return UNKNOWN for unmapped roles', () => {
    expect(fromNetworkDeviceRole('COFFEE_MACHINE')).toBe(
      NetworkDeviceType.UNKNOWN
    );
  });
});

describe('isValidNetworkDeviceType()', () => {
  it('should validate known types', () => {
    expect(isValidNetworkDeviceType('ROUTER')).toBe(true);
    expect(isValidNetworkDeviceType('ACCESS_POINT')).toBe(true);
  });

  it('should invalidate unknown types', () => {
    expect(isValidNetworkDeviceType('PRINTER')).toBe(false);
    expect(isValidNetworkDeviceType('')).toBe(false);
  });
});

describe('getDeviceTypeDisplayName()', () => {
  it('should return human readable names', () => {
    expect(
      getDeviceTypeDisplayName(NetworkDeviceType.ACCESS_POINT)
    ).toBe('Access Point');
    expect(getDeviceTypeDisplayName(NetworkDeviceType.FIREWALL)).toBe(
      'Firewall'
    );
    expect(getDeviceTypeDisplayName(NetworkDeviceType.SERVER)).toBe(
      'Server'
    );
  });

  it('should return "Unknown" for unmapped types', () => {
    expect(getDeviceTypeDisplayName('NOTHING' as any)).toBe(
      'Unknown'
    );
  });
});
