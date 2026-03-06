import { ConnectivityType } from '../../../../src/domain/device-inventory';

describe('ConnectivityType', () => {
  describe('create', () => {
    describe('when valid connectivity type', () => {
      const validTypes = [
        'ETHERNET',
        'FIBER_OPTIC',
        'WIRELESS',
        'DSL',
        'SATELLITE',
        'OTHER'
      ];

      validTypes.forEach((type) => {
        it(`should create ConnectivityType with ${type}`, () => {
          const result = ConnectivityType.create(type);

          expect(result.isSuccess).toBe(true);
          expect(result.value.value).toBe(type);
        });
      });

      it('should normalize to uppercase', () => {
        const result = ConnectivityType.create('ethernet');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('ETHERNET');
      });

      it('should trim whitespace', () => {
        const result = ConnectivityType.create('  WIRELESS  ');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('WIRELESS');
      });

      it('should handle mixed case', () => {
        const result = ConnectivityType.create('FiBeR_OpTiC');

        expect(result.isSuccess).toBe(true);
        expect(result.value.value).toBe('FIBER_OPTIC');
      });
    });

    describe('when invalid connectivity type', () => {
      it('should fail for null', () => {
        const result = ConnectivityType.create(null as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('connectivity type');
      });

      it('should fail for undefined', () => {
        const result = ConnectivityType.create(undefined as any);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('connectivity type');
      });

      it('should fail for empty string', () => {
        const result = ConnectivityType.create('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for whitespace only', () => {
        const result = ConnectivityType.create('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('cannot be empty');
      });

      it('should fail for invalid connectivity type value', () => {
        const result = ConnectivityType.create('INVALID_TYPE');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid connectivity type');
      });
    });
  });

  describe('convenience factory methods', () => {
    it('should create ETHERNET with createEthernet', () => {
      const result = ConnectivityType.createEthernet();

      expect(result.toString()).toBe('ETHERNET');
      expect(result.isEthernet()).toBe(true);
    });

    it('should create FIBER_OPTIC with createFiberOptic', () => {
      const result = ConnectivityType.createFiberOptic();

      expect(result.toString()).toBe('FIBER_OPTIC');
      expect(result.isFiberOptic()).toBe(true);
    });

    it('should create WIRELESS with createWireless', () => {
      const result = ConnectivityType.createWireless();

      expect(result.toString()).toBe('WIRELESS');
      expect(result.isWireless()).toBe(true);
    });

    it('should create DSL with createDsl', () => {
      const result = ConnectivityType.createDsl();

      expect(result.toString()).toBe('DSL');
      expect(result.isDsl()).toBe(true);
    });

    it('should create SATELLITE with createSatellite', () => {
      const result = ConnectivityType.createSatellite();

      expect(result.toString()).toBe('SATELLITE');
      expect(result.isSatellite()).toBe(true);
    });

    it('should create OTHER with createOther', () => {
      const result = ConnectivityType.createOther();

      expect(result.toString()).toBe('OTHER');
      expect(result.isOther()).toBe(true);
    });
  });

  describe('type checking methods', () => {
    it('should correctly identify ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.isEthernet()).toBe(true);
      expect(type.isFiberOptic()).toBe(false);
      expect(type.isWireless()).toBe(false);
      expect(type.isDsl()).toBe(false);
      expect(type.isSatellite()).toBe(false);
      expect(type.isOther()).toBe(false);
    });

    it('should correctly identify FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.isFiberOptic()).toBe(true);
      expect(type.isEthernet()).toBe(false);
    });

    it('should correctly identify WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.isWireless()).toBe(true);
      expect(type.isEthernet()).toBe(false);
    });

    it('should correctly identify DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.isDsl()).toBe(true);
      expect(type.isEthernet()).toBe(false);
    });

    it('should correctly identify SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.isSatellite()).toBe(true);
      expect(type.isWireless()).toBe(false);
    });

    it('should correctly identify OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.isOther()).toBe(true);
      expect(type.isEthernet()).toBe(false);
    });
  });

  describe('requiresPhysicalCable', () => {
    it('should return true for ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.requiresPhysicalCable()).toBe(true);
    });

    it('should return true for FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.requiresPhysicalCable()).toBe(true);
    });

    it('should return true for DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.requiresPhysicalCable()).toBe(true);
    });

    it('should return false for WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.requiresPhysicalCable()).toBe(false);
    });

    it('should return false for SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.requiresPhysicalCable()).toBe(false);
    });

    it('should return false for OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.requiresPhysicalCable()).toBe(false);
    });
  });

  describe('isWirelessConnection', () => {
    it('should return true for WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.isWirelessConnection()).toBe(true);
    });

    it('should return true for SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.isWirelessConnection()).toBe(true);
    });

    it('should return false for ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.isWirelessConnection()).toBe(false);
    });

    it('should return false for FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.isWirelessConnection()).toBe(false);
    });

    it('should return false for DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.isWirelessConnection()).toBe(false);
    });

    it('should return false for OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.isWirelessConnection()).toBe(false);
    });
  });

  describe('getTypicalMaxBandwidth', () => {
    it('should return 10000 Mbps for ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.getTypicalMaxBandwidth()).toBe(10000);
    });

    it('should return 100000 Mbps for FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.getTypicalMaxBandwidth()).toBe(100000);
    });

    it('should return 9600 Mbps for WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.getTypicalMaxBandwidth()).toBe(9600);
    });

    it('should return 100 Mbps for DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.getTypicalMaxBandwidth()).toBe(100);
    });

    it('should return 500 Mbps for SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.getTypicalMaxBandwidth()).toBe(500);
    });

    it('should return 0 Mbps for OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.getTypicalMaxBandwidth()).toBe(0);
    });
  });

  describe('getTypicalLatency', () => {
    it('should return correct latency for ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.getTypicalLatency()).toBe('< 1ms');
    });

    it('should return correct latency for FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.getTypicalLatency()).toBe('< 1ms');
    });

    it('should return correct latency for WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.getTypicalLatency()).toBe('1-10ms');
    });

    it('should return correct latency for DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.getTypicalLatency()).toBe('10-50ms');
    });

    it('should return correct latency for SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.getTypicalLatency()).toBe('500-700ms');
    });

    it('should return "Unknown" for OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.getTypicalLatency()).toBe('Unknown');
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display name for ETHERNET', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.getDisplayName()).toBe('Ethernet');
    });

    it('should return correct display name for FIBER_OPTIC', () => {
      const type = ConnectivityType.createFiberOptic();

      expect(type.getDisplayName()).toBe('Fiber Optic');
    });

    it('should return correct display name for WIRELESS', () => {
      const type = ConnectivityType.createWireless();

      expect(type.getDisplayName()).toBe('Wireless');
    });

    it('should return correct display name for DSL', () => {
      const type = ConnectivityType.createDsl();

      expect(type.getDisplayName()).toBe('DSL');
    });

    it('should return correct display name for SATELLITE', () => {
      const type = ConnectivityType.createSatellite();

      expect(type.getDisplayName()).toBe('Satellite');
    });

    it('should return correct display name for OTHER', () => {
      const type = ConnectivityType.createOther();

      expect(type.getDisplayName()).toBe('Other');
    });
  });

  describe('equals', () => {
    it('should return true for same connectivity type values', () => {
      const type1 = ConnectivityType.createEthernet();
      const type2 = ConnectivityType.createEthernet();

      expect(type1.equals(type2)).toBe(true);
    });

    it('should return true for types created with different methods but same value', () => {
      const type1 = ConnectivityType.createEthernet();
      const type2 = ConnectivityType.create('ETHERNET');

      expect(type1.equals(type2.value)).toBe(true);
    });

    it('should return false for different connectivity type values', () => {
      const type1 = ConnectivityType.createEthernet();
      const type2 = ConnectivityType.createWireless();

      expect(type1.equals(type2)).toBe(false);
    });

    it('should return false for null', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.equals(undefined as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const type = ConnectivityType.createEthernet();

      expect(type.toString()).toBe('ETHERNET');
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const type = ConnectivityType.createEthernet();

      expect(() => {
        // @ts-expect-error - Testing immutability
        type.props = 'WIRELESS';
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const type = ConnectivityType.createEthernet();

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        type.props = { value: 'WIRELESS' };
      }).toThrow();
    });
  });

  describe('static constants', () => {
    it('should have ETHERNET constant', () => {
      expect(ConnectivityType.ETHERNET).toBe('ETHERNET');
    });

    it('should have FIBER_OPTIC constant', () => {
      expect(ConnectivityType.FIBER_OPTIC).toBe('FIBER_OPTIC');
    });

    it('should have WIRELESS constant', () => {
      expect(ConnectivityType.WIRELESS).toBe('WIRELESS');
    });

    it('should have DSL constant', () => {
      expect(ConnectivityType.DSL).toBe('DSL');
    });

    it('should have SATELLITE constant', () => {
      expect(ConnectivityType.SATELLITE).toBe('SATELLITE');
    });

    it('should have OTHER constant', () => {
      expect(ConnectivityType.OTHER).toBe('OTHER');
    });

    it('should return all connectivity types from validTypes', () => {
      const allTypes = ConnectivityType.validTypes();
      expect(allTypes).toEqual([
        'ETHERNET',
        'FIBER_OPTIC',
        'WIRELESS',
        'DSL',
        'SATELLITE',
        'OTHER'
      ]);
    });
  });
});
