// Source: src/domain/wireless-monitoring/value-objects/WirelessClientEntry.ts

import { WirelessClientEntry } from '../../../../src/domain/wireless-monitoring/value-objects/WirelessClientEntry';
import { WirelessClientEntryProps } from '../../../../src/domain/wireless-monitoring/props/WirelessClientEntryProps';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMinimalProps(
  overrides: Partial<WirelessClientEntryProps> = {}
): WirelessClientEntryProps {
  return {
    macAddress: 'AA:BB:CC:DD:EE:FF',
    signalRxDbm: null,
    signalTxDbm: null,
    snrDb: null,
    txRateMbps: null,
    rxRateMbps: null,
    throughputTxBps: null,
    throughputRxBps: null,
    ccqPercent: null,
    uptimeSeconds: null,
    ipAddress: null,
    ...overrides,
  };
}

function makeFullProps(
  overrides: Partial<WirelessClientEntryProps> = {}
): WirelessClientEntryProps {
  return {
    macAddress: 'AA:BB:CC:DD:EE:FF',
    signalRxDbm: -65,
    signalTxDbm: -60,
    snrDb: 25,
    txRateMbps: 300,
    rxRateMbps: 150,
    throughputTxBps: 5_000_000,
    throughputRxBps: 3_000_000,
    ccqPercent: 95,
    uptimeSeconds: 3600,
    ipAddress: '192.168.1.100',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('WirelessClientEntry', () => {

  // ===========================================================================
  describe('create()', () => {
    describe('when props are valid', () => {
      it('should return a successful Result wrapping a WirelessClientEntry instance', () => {
        const result = WirelessClientEntry.create(makeFullProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(WirelessClientEntry);
      });

      it('should succeed when all optional fields are null', () => {
        const result = WirelessClientEntry.create(makeMinimalProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(WirelessClientEntry);
      });

      it('should accept a colon-separated lowercase MAC address', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' }));

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a hyphen-separated uppercase MAC address', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA-BB-CC-DD-EE-FF' }));

        expect(result.isSuccess).toBe(true);
      });

      it('should accept ccqPercent at the lower boundary (0)', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ccqPercent: 0 }));

        expect(result.isSuccess).toBe(true);
      });

      it('should accept ccqPercent at the upper boundary (100)', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ccqPercent: 100 }));

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a valid IP address string', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ipAddress: '10.0.0.1' }));

        expect(result.isSuccess).toBe(true);
      });
    });

    describe('when macAddress is invalid', () => {
      it('should fail when macAddress is null', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress is undefined', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress is not a valid MAC format', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'not-a-mac' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('macAddress');
      });

      it('should fail when macAddress has too few segments', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress uses dots as separators', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA.BB.CC.DD.EE.FF' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress has mixed separators', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA:BB-CC:DD-EE:FF' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress is an empty string', () => {
        const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: '' }));

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when ccqPercent is out of range', () => {
      it('should fail when ccqPercent is negative', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ccqPercent: -1 }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail when ccqPercent exceeds 100', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ccqPercent: 101 }));

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when numeric signal fields are invalid', () => {
      it('should fail when signalRxDbm is not a number', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ signalRxDbm: 'bad' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when signalTxDbm is not a number', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ signalTxDbm: 'bad' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when snrDb is not a number', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ snrDb: 'bad' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when ipAddress is invalid', () => {
      it('should fail when ipAddress is an empty string', () => {
        const result = WirelessClientEntry.create(makeFullProps({ ipAddress: '' }));

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when props object itself is null or undefined', () => {
      it('should fail when props is null', () => {
        const result = WirelessClientEntry.create(null as unknown as WirelessClientEntryProps);

        expect(result.isFailure).toBe(true);
      });

      it('should fail when props is undefined', () => {
        const result = WirelessClientEntry.create(undefined as unknown as WirelessClientEntryProps);

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // ===========================================================================
  describe('MAC address normalization on create()', () => {
    it('should normalize a hyphen-separated MAC to colon-separated uppercase', () => {
      const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'aa-bb-cc-dd-ee-ff' }));

      expect(result.isSuccess).toBe(true);
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should normalize a lowercase colon-separated MAC to uppercase', () => {
      const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' }));

      expect(result.isSuccess).toBe(true);
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should preserve an already-normalized MAC address unchanged', () => {
      const result = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE:FF' }));

      expect(result.isSuccess).toBe(true);
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });
  });

  // ===========================================================================
  describe('reconstitute()', () => {
    it('should return a WirelessClientEntry instance without validation', () => {
      const props = makeFullProps();
      const entry = WirelessClientEntry.reconstitute(props);

      expect(entry).toBeInstanceOf(WirelessClientEntry);
    });

    it('should preserve all props exactly as supplied', () => {
      const props = makeFullProps();
      const entry = WirelessClientEntry.reconstitute(props);

      expect(entry.macAddress).toBe(props.macAddress);
      expect(entry.signalRxDbm).toBe(props.signalRxDbm);
      expect(entry.signalTxDbm).toBe(props.signalTxDbm);
      expect(entry.snrDb).toBe(props.snrDb);
      expect(entry.txRateMbps).toBe(props.txRateMbps);
      expect(entry.rxRateMbps).toBe(props.rxRateMbps);
      expect(entry.throughputTxBps).toBe(props.throughputTxBps);
      expect(entry.throughputRxBps).toBe(props.throughputRxBps);
      expect(entry.ccqPercent).toBe(props.ccqPercent);
      expect(entry.uptimeSeconds).toBe(props.uptimeSeconds);
      expect(entry.ipAddress).toBe(props.ipAddress);
    });
  });

  // ===========================================================================
  describe('getters', () => {
    it('should expose macAddress (normalized)', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' })).value;

      expect(entry.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should expose signalRxDbm', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ signalRxDbm: -65 })).value;

      expect(entry.signalRxDbm).toBe(-65);
    });

    it('should expose signalTxDbm', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ signalTxDbm: -60 })).value;

      expect(entry.signalTxDbm).toBe(-60);
    });

    it('should expose snrDb', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ snrDb: 25 })).value;

      expect(entry.snrDb).toBe(25);
    });

    it('should expose txRateMbps', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ txRateMbps: 300 })).value;

      expect(entry.txRateMbps).toBe(300);
    });

    it('should expose rxRateMbps', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ rxRateMbps: 150 })).value;

      expect(entry.rxRateMbps).toBe(150);
    });

    it('should expose throughputTxBps', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ throughputTxBps: 5_000_000 })).value;

      expect(entry.throughputTxBps).toBe(5_000_000);
    });

    it('should expose throughputRxBps', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ throughputRxBps: 3_000_000 })).value;

      expect(entry.throughputRxBps).toBe(3_000_000);
    });

    it('should expose ccqPercent', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ ccqPercent: 95 })).value;

      expect(entry.ccqPercent).toBe(95);
    });

    it('should expose uptimeSeconds', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ uptimeSeconds: 3600 })).value;

      expect(entry.uptimeSeconds).toBe(3600);
    });

    it('should expose ipAddress', () => {
      const entry = WirelessClientEntry.create(makeFullProps({ ipAddress: '192.168.1.100' })).value;

      expect(entry.ipAddress).toBe('192.168.1.100');
    });

    it('should return null for every optional getter when fields are null', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(entry.signalRxDbm).toBeNull();
      expect(entry.signalTxDbm).toBeNull();
      expect(entry.snrDb).toBeNull();
      expect(entry.txRateMbps).toBeNull();
      expect(entry.rxRateMbps).toBeNull();
      expect(entry.throughputTxBps).toBeNull();
      expect(entry.throughputRxBps).toBeNull();
      expect(entry.ccqPercent).toBeNull();
      expect(entry.uptimeSeconds).toBeNull();
      expect(entry.ipAddress).toBeNull();
    });
  });

  // ===========================================================================
  describe('equals()', () => {
    it('should return true for two entries with identical props', () => {
      const entryA = WirelessClientEntry.create(makeFullProps()).value;
      const entryB = WirelessClientEntry.create(makeFullProps()).value;

      expect(entryA.equals(entryB)).toBe(true);
    });

    it('should return false when macAddress differs', () => {
      const entryA = WirelessClientEntry.create(makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE:FF' })).value;
      const entryB = WirelessClientEntry.create(makeMinimalProps({ macAddress: '00:11:22:33:44:55' })).value;

      expect(entryA.equals(entryB)).toBe(false);
    });

    it('should return false when signalRxDbm differs', () => {
      const entryA = WirelessClientEntry.create(makeFullProps({ signalRxDbm: -65 })).value;
      const entryB = WirelessClientEntry.create(makeFullProps({ signalRxDbm: -75 })).value;

      expect(entryA.equals(entryB)).toBe(false);
    });

    it('should return false for null', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(entry.equals(null as unknown as WirelessClientEntry)).toBe(false);
    });

    it('should return false for undefined', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(entry.equals(undefined as unknown as WirelessClientEntry)).toBe(false);
    });
  });

  // ===========================================================================
  describe('immutability', () => {
    it('should be frozen after creation via create()', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(Object.isFrozen(entry)).toBe(true);
    });

    it('should be frozen after creation via reconstitute()', () => {
      const entry = WirelessClientEntry.reconstitute(makeMinimalProps());

      expect(Object.isFrozen(entry)).toBe(true);
    });
  });
});
