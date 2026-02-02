import { NetworkDeviceType } from '../../../src/domain';

describe('NetworkDeviceType', () => {
  describe('create', () => {
    describe('when valid device type', () => {
      const validTypes = [
        'ACCESS_POINT',
        'STATION',
        'PTP_RADIO',
        'PTMP_RADIO',
        'SWITCH',
        'ROUTER',
        'FIREWALL',
        'SERVER',
        'UNKNOWN'
      ];

      validTypes.forEach((type) => {
        it(`should create NetworkDeviceType with ${type}`, () => {
          const result = NetworkDeviceType.create(type);

          expect(result.isSuccess).toBe(true);
          expect(result.value.value).toBe(type);
        });
      });

      it('should normalize to uppercase', () => {
        const result = NetworkDeviceType.create('router');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ROUTER');
      });

      it('should trim whitespace', () => {
        const result = NetworkDeviceType.create('  SWITCH  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('SWITCH');
      });

      it('should handle mixed case', () => {
        const result = NetworkDeviceType.create('AcCeSs_PoInT');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ACCESS_POINT');
      });
    });

    describe('when invalid device type', () => {
      it('should fail for null', () => {
        const result = NetworkDeviceType.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('device type');
      });

      it('should fail for undefined', () => {
        const result = NetworkDeviceType.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('device type');
      });

      it('should fail for empty string', () => {
        const result = NetworkDeviceType.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = NetworkDeviceType.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid device type value', () => {
        const result = NetworkDeviceType.create('INVALID_TYPE');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device type');
      });
    });
  });

  describe('convenience factory methods', () => {
    it('should create ACCESS_POINT with createAccessPoint', () => {
      const result = NetworkDeviceType.createAccessPoint();

      expect(result.toString()).toBe('ACCESS_POINT');
      expect(result.isAccessPoint()).toBe(true);
    });

    it('should create STATION with createStation', () => {
      const result = NetworkDeviceType.createStation();

      expect(result.toString()).toBe('STATION');
      expect(result.isStation()).toBe(true);
    });

    it('should create PTP_RADIO with createPtpRadio', () => {
      const result = NetworkDeviceType.createPtpRadio();

      expect(result.toString()).toBe('PTP_RADIO');
      expect(result.isPtpRadio()).toBe(true);
    });

    it('should create PTMP_RADIO with createPtmpRadio', () => {
      const result = NetworkDeviceType.createPtmpRadio();

      expect(result.toString()).toBe('PTMP_RADIO');
      expect(result.isPtmpRadio()).toBe(true);
    });

    it('should create SWITCH with createSwitch', () => {
      const result = NetworkDeviceType.createSwitch();

      expect(result.toString()).toBe('SWITCH');
      expect(result.isSwitch()).toBe(true);
    });

    it('should create ROUTER with createRouter', () => {
      const result = NetworkDeviceType.createRouter();

      expect(result.toString()).toBe('ROUTER');
      expect(result.isRouter()).toBe(true);
    });

    it('should create FIREWALL with createFirewall', () => {
      const result = NetworkDeviceType.createFirewall();

      expect(result.toString()).toBe('FIREWALL');
      expect(result.isFirewall()).toBe(true);
    });

    it('should create SERVER with createServer', () => {
      const result = NetworkDeviceType.createServer();

      expect(result.toString()).toBe('SERVER');
      expect(result.isServer()).toBe(true);
    });

    it('should create UNKNOWN with createUnknown', () => {
      const result = NetworkDeviceType.createUnknown();

      expect(result.toString()).toBe('UNKNOWN');
      expect(result.isUnknown()).toBe(true);
    });
  });

  describe('fromRadioType', () => {
    it('should map ACCESS_POINT radio type', () => {
      const result = NetworkDeviceType.fromRadioType('ACCESS_POINT');

      expect(result.value.isAccessPoint()).toBe(true);
    });

    it('should map STATION radio type', () => {
      const result = NetworkDeviceType.fromRadioType('STATION');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isStation()).toBe(true);
    });

    it('should map PTP_RADIO radio type', () => {
      const result = NetworkDeviceType.fromRadioType('PTP_RADIO');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map PTMP_RADIO radio type', () => {
      const result = NetworkDeviceType.fromRadioType('PTMP_RADIO');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtmpRadio()).toBe(true);
    });

    it('should map SECTOR_ANTENNA to PTMP_RADIO', () => {
      const result =
        NetworkDeviceType.fromRadioType('SECTOR_ANTENNA');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtmpRadio()).toBe(true);
    });

    it('should map BACKHAUL_RADIO to PTP_RADIO', () => {
      const result =
        NetworkDeviceType.fromRadioType('BACKHAUL_RADIO');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map MIMO_RADIO to PTP_RADIO', () => {
      const result = NetworkDeviceType.fromRadioType('MIMO_RADIO');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should handle unknown radio types as UNKNOWN', () => {
      const result = NetworkDeviceType.fromRadioType('UNKNOWN_RADIO');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isUnknown()).toBe(true);
    });

    it('should handle null as a failure', () => {
      const result = NetworkDeviceType.fromRadioType(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('radio type');
    });

    it('should handle case insensitive radio types', () => {
      const result = NetworkDeviceType.fromRadioType('access_point');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isAccessPoint()).toBe(true);
    });
  });

  describe('fromNetworkDeviceRole', () => {
    it('should map ROUTING to ROUTER', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('ROUTING');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isRouter()).toBe(true);
    });

    it('should map SWITCHING to SWITCH', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('SWITCHING');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isSwitch()).toBe(true);
    });

    it('should map WIRELESS_ACCESS to ACCESS_POINT', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('WIRELESS_ACCESS');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isAccessPoint()).toBe(true);
    });

    it('should map WIRELESS_CONTROLLER to PTP_RADIO', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole(
        'WIRELESS_CONTROLLER'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map WIRELESS_BRIDGE to PTP_RADIO', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('WIRELESS_BRIDGE');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map RADIO_LINK to PTP_RADIO', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('RADIO_LINK');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map BACKHAUL to PTP_RADIO', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('BACKHAUL');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isPtpRadio()).toBe(true);
    });

    it('should map FIREWALL to FIREWALL', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('FIREWALL');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isFirewall()).toBe(true);
    });

    it('should map IDS to FIREWALL', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('IDS');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isFirewall()).toBe(true);
    });

    it('should map IPS to FIREWALL', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('IPS');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isFirewall()).toBe(true);
    });

    it('should map UTM to FIREWALL', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('UTM');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isFirewall()).toBe(true);
    });

    it('should map APPLICATION_HOSTING to SERVER', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole(
        'APPLICATION_HOSTING'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should map DATABASE_HOSTING to SERVER', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole(
        'DATABASE_HOSTING'
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should map PROXY to SERVER', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('PROXY');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should map DHCP to SERVER', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('DHCP');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should map DNS to SERVER', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole('DNS');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should map LOAD_BALANCING to SERVER', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('LOAD_BALANCING');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isServer()).toBe(true);
    });

    it('should handle unknown roles as UNKNOWN', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('COFFEE_MACHINE');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isUnknown()).toBe(true);
    });

    it('should handle null as UNKNOWN', () => {
      const result = NetworkDeviceType.fromNetworkDeviceRole(
        null as any
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'network device role is null or undefined'
      );
    });

    it('should handle case insensitive roles', () => {
      const result =
        NetworkDeviceType.fromNetworkDeviceRole('routing');

      expect(result.isSuccess).toBe(true);
      expect(result.value.isRouter()).toBe(true);
    });
  });

  describe('type checking methods', () => {
    it('should correctly identify ACCESS_POINT', () => {
      const type = NetworkDeviceType.createAccessPoint();

      expect(type.isAccessPoint()).toBe(true);
      expect(type.isStation()).toBe(false);
      expect(type.isPtpRadio()).toBe(false);
      expect(type.isPtmpRadio()).toBe(false);
      expect(type.isSwitch()).toBe(false);
      expect(type.isRouter()).toBe(false);
      expect(type.isFirewall()).toBe(false);
      expect(type.isServer()).toBe(false);
      expect(type.isUnknown()).toBe(false);
    });

    it('should correctly identify STATION', () => {
      const type = NetworkDeviceType.createStation();

      expect(type.isStation()).toBe(true);
      expect(type.isAccessPoint()).toBe(false);
    });

    it('should correctly identify PTP_RADIO', () => {
      const type = NetworkDeviceType.createPtpRadio();

      expect(type.isPtpRadio()).toBe(true);
      expect(type.isPtmpRadio()).toBe(false);
    });

    it('should correctly identify PTMP_RADIO', () => {
      const type = NetworkDeviceType.createPtmpRadio();

      expect(type.isPtmpRadio()).toBe(true);
      expect(type.isPtpRadio()).toBe(false);
    });

    it('should correctly identify SWITCH', () => {
      const type = NetworkDeviceType.createSwitch();

      expect(type.isSwitch()).toBe(true);
      expect(type.isRouter()).toBe(false);
    });

    it('should correctly identify ROUTER', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.isRouter()).toBe(true);
      expect(type.isSwitch()).toBe(false);
    });

    it('should correctly identify FIREWALL', () => {
      const type = NetworkDeviceType.createFirewall();

      expect(type.isFirewall()).toBe(true);
      expect(type.isServer()).toBe(false);
    });

    it('should correctly identify SERVER', () => {
      const type = NetworkDeviceType.createServer();

      expect(type.isServer()).toBe(true);
      expect(type.isFirewall()).toBe(false);
    });

    it('should correctly identify UNKNOWN', () => {
      const type = NetworkDeviceType.createUnknown();

      expect(type.isUnknown()).toBe(true);
      expect(type.isAccessPoint()).toBe(false);
    });
  });

  describe('getDefaultPollingInterval', () => {
    it('should return 30 seconds for ACCESS_POINT', () => {
      const type = NetworkDeviceType.createAccessPoint();

      expect(type.getDefaultPollingInterval()).toBe(30);
    });

    it('should return 300 seconds for STATION', () => {
      const type = NetworkDeviceType.createStation();

      expect(type.getDefaultPollingInterval()).toBe(300);
    });

    it('should return 60 seconds for PTP_RADIO', () => {
      const type = NetworkDeviceType.createPtpRadio();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });

    it('should return 60 seconds for PTMP_RADIO', () => {
      const type = NetworkDeviceType.createPtmpRadio();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });

    it('should return 60 seconds for SWITCH', () => {
      const type = NetworkDeviceType.createSwitch();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });

    it('should return 60 seconds for ROUTER', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });

    it('should return 60 seconds for FIREWALL', () => {
      const type = NetworkDeviceType.createFirewall();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });

    it('should return 120 seconds for SERVER', () => {
      const type = NetworkDeviceType.createServer();

      expect(type.getDefaultPollingInterval()).toBe(120);
    });

    it('should return 60 seconds for UNKNOWN', () => {
      const type = NetworkDeviceType.createUnknown();

      expect(type.getDefaultPollingInterval()).toBe(60);
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display name for ACCESS_POINT', () => {
      const type = NetworkDeviceType.createAccessPoint();

      expect(type.getDisplayName()).toBe('Access Point');
    });

    it('should return correct display name for STATION', () => {
      const type = NetworkDeviceType.createStation();

      expect(type.getDisplayName()).toBe('Station');
    });

    it('should return correct display name for PTP_RADIO', () => {
      const type = NetworkDeviceType.createPtpRadio();

      expect(type.getDisplayName()).toBe('PTP Radio');
    });

    it('should return correct display name for PTMP_RADIO', () => {
      const type = NetworkDeviceType.createPtmpRadio();

      expect(type.getDisplayName()).toBe('PTMP Radio');
    });

    it('should return correct display name for SWITCH', () => {
      const type = NetworkDeviceType.createSwitch();

      expect(type.getDisplayName()).toBe('Switch');
    });

    it('should return correct display name for ROUTER', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.getDisplayName()).toBe('Router');
    });

    it('should return correct display name for FIREWALL', () => {
      const type = NetworkDeviceType.createFirewall();

      expect(type.getDisplayName()).toBe('Firewall');
    });

    it('should return correct display name for SERVER', () => {
      const type = NetworkDeviceType.createServer();

      expect(type.getDisplayName()).toBe('Server');
    });

    it('should return correct display name for UNKNOWN', () => {
      const type = NetworkDeviceType.createUnknown();

      expect(type.getDisplayName()).toBe('Unknown');
    });
  });

  describe('validTypes', () => {
    it('should return all valid network device types', () => {
      const validTypes = NetworkDeviceType.validTypes();

      expect(validTypes).toEqual([
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

  describe('equals', () => {
    it('should return true for same device type values', () => {
      const type1 = NetworkDeviceType.createRouter();
      const type2 = NetworkDeviceType.createRouter();

      expect(type1.equals(type2)).toBe(true);
    });

    it('should return true for types created with different methods but same value', () => {
      const type1 = NetworkDeviceType.createRouter();
      const type2 = NetworkDeviceType.create('ROUTER');

      expect(type1.equals(type2.value)).toBe(true);
    });

    it('should return false for different device type values', () => {
      const type1 = NetworkDeviceType.createRouter();
      const type2 = NetworkDeviceType.createSwitch();

      expect(type1.equals(type2)).toBe(false);
    });

    it('should return false for null', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const type = NetworkDeviceType.createRouter();

      expect(type.toString()).toBe('ROUTER');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const type = NetworkDeviceType.createRouter();

      expect(() => {
        // @ts-expect-error - Testing immutability
        type.props = 'SWITCH';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const type = NetworkDeviceType.createRouter();

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        type.props = { value: 'SWITCH' };
      }).toThrow();
    });
  });
});
