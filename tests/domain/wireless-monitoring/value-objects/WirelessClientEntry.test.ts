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
    ipAddress: null,
    signalRxDbm: null,
    noiseFloorDbm: null,
    distanceM: null,
    uptimeSeconds: null,
    txLatencyMs: null,
    dlLinkScore: null,
    ulLinkScore: null,
    dlCapacityKbps: null,
    ulCapacityKbps: null,
    dlCinr: null,
    ulCinr: null,
    txBytesTotal: null,
    rxBytesTotal: null,
    txPps: null,
    rxPps: null,
    remoteHostname: null,
    remotePlatform: null,
    remoteVersion: null,
    remoteCpuLoad: null,
    remoteTotalRam: null,
    remoteFreeRam: null,
    remoteSignal: null,
    remoteNoiseFloor: null,
    remoteTxPower: null,
    remoteTxThroughputKbps: null,
    remoteRxThroughputKbps: null,
    remoteIpAddresses: [],
    ...overrides
  };
}

function makeFullProps(
  overrides: Partial<WirelessClientEntryProps> = {}
): WirelessClientEntryProps {
  return {
    macAddress: 'AA:BB:CC:DD:EE:FF',
    ipAddress: '192.168.1.100',
    signalRxDbm: -65,
    noiseFloorDbm: -95,
    distanceM: 1500,
    uptimeSeconds: 3600,
    txLatencyMs: 5,
    dlLinkScore: 90,
    ulLinkScore: 85,
    dlCapacityKbps: 50000,
    ulCapacityKbps: 20000,
    dlCinr: 22,
    ulCinr: 18,
    txBytesTotal: BigInt(1_000_000),
    rxBytesTotal: BigInt(500_000),
    txPps: 100,
    rxPps: 50,
    remoteHostname: 'tower-ap',
    remotePlatform: 'Rocket 5AC Lite',
    remoteVersion: 'WA.v8.7.5',
    remoteCpuLoad: 40,
    remoteTotalRam: 262144,
    remoteFreeRam: 131072,
    remoteSignal: -68,
    remoteNoiseFloor: -96,
    remoteTxPower: 23,
    remoteTxThroughputKbps: 5000,
    remoteRxThroughputKbps: 3000,
    remoteIpAddresses: ['10.0.0.1'],
    ...overrides
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

      it('should succeed when all optional fields are null / empty', () => {
        const result = WirelessClientEntry.create(makeMinimalProps());

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(WirelessClientEntry);
      });

      it('should accept a colon-separated lowercase MAC address', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a hyphen-separated uppercase MAC address', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: 'AA-BB-CC-DD-EE-FF' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept dlLinkScore at the lower boundary (0)', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ dlLinkScore: 0 })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept ulLinkScore at the upper boundary (100)', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ ulLinkScore: 100 })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a valid IP address string', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ ipAddress: '10.0.0.1' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should accept bigint byte counters', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({
            txBytesTotal: BigInt('9007199254740993'),
            rxBytesTotal: BigInt('9007199254740993')
          })
        );

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
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: 'not-a-mac' })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('MAC address');
      });

      it('should fail when macAddress has too few segments', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE' })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when macAddress is an empty string', () => {
        const result = WirelessClientEntry.create(
          makeMinimalProps({ macAddress: '' })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when link score fields are out of range', () => {
      it('should fail when dlLinkScore is negative', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ dlLinkScore: -1 })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when dlLinkScore exceeds 100', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ dlLinkScore: 101 })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when ulLinkScore is negative', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ ulLinkScore: -1 })
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when ulLinkScore exceeds 100', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ ulLinkScore: 101 })
        );

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

      it('should fail when noiseFloorDbm is not a number', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ noiseFloorDbm: 'bad' as unknown as number })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when ipAddress is invalid', () => {
      it('should fail when ipAddress is an empty string', () => {
        const result = WirelessClientEntry.create(
          makeFullProps({ ipAddress: '' })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    describe('when props object itself is null or undefined', () => {
      it('should fail when props is null', () => {
        const result = WirelessClientEntry.create(
          null as unknown as WirelessClientEntryProps
        );

        expect(result.isFailure).toBe(true);
      });

      it('should fail when props is undefined', () => {
        const result = WirelessClientEntry.create(
          undefined as unknown as WirelessClientEntryProps
        );

        expect(result.isFailure).toBe(true);
      });
    });
  });

  // ===========================================================================
  describe('MAC address normalization on create()', () => {
    it('should normalize a hyphen-separated MAC to colon-separated uppercase', () => {
      const result = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: 'aa-bb-cc-dd-ee-ff' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should normalize a lowercase colon-separated MAC to uppercase', () => {
      const result = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' })
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should preserve an already-normalized MAC address unchanged', () => {
      const result = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE:FF' })
      );

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
      expect(entry.ipAddress).toBe(props.ipAddress);
      expect(entry.signalRxDbm).toBe(props.signalRxDbm);
      expect(entry.noiseFloorDbm).toBe(props.noiseFloorDbm);
      expect(entry.distanceM).toBe(props.distanceM);
      expect(entry.uptimeSeconds).toBe(props.uptimeSeconds);
      expect(entry.txLatencyMs).toBe(props.txLatencyMs);
      expect(entry.dlLinkScore).toBe(props.dlLinkScore);
      expect(entry.ulLinkScore).toBe(props.ulLinkScore);
      expect(entry.txBytesTotal).toBe(props.txBytesTotal);
      expect(entry.rxBytesTotal).toBe(props.rxBytesTotal);
      expect(entry.remoteHostname).toBe(props.remoteHostname);
      expect(entry.remoteIpAddresses).toEqual(props.remoteIpAddresses);
    });
  });

  // ===========================================================================
  describe('getters', () => {
    it('should expose macAddress (normalized)', () => {
      const entry = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: 'aa:bb:cc:dd:ee:ff' })
      ).value;

      expect(entry.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should expose signalRxDbm', () => {
      const entry = WirelessClientEntry.create(
        makeFullProps({ signalRxDbm: -65 })
      ).value;

      expect(entry.signalRxDbm).toBe(-65);
    });

    it('should expose dlLinkScore', () => {
      const entry = WirelessClientEntry.create(
        makeFullProps({ dlLinkScore: 90 })
      ).value;

      expect(entry.dlLinkScore).toBe(90);
    });

    it('should expose txBytesTotal as bigint', () => {
      const entry = WirelessClientEntry.create(
        makeFullProps({ txBytesTotal: BigInt(1_000_000) })
      ).value;

      expect(entry.txBytesTotal).toBe(BigInt(1_000_000));
    });

    it('should expose remoteIpAddresses as an array', () => {
      const entry = WirelessClientEntry.create(
        makeFullProps({ remoteIpAddresses: ['10.0.0.1', '10.0.0.2'] })
      ).value;

      expect(entry.remoteIpAddresses).toEqual(['10.0.0.1', '10.0.0.2']);
    });

    it('should return null for every optional getter when fields are null', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(entry.ipAddress).toBeNull();
      expect(entry.signalRxDbm).toBeNull();
      expect(entry.noiseFloorDbm).toBeNull();
      expect(entry.distanceM).toBeNull();
      expect(entry.uptimeSeconds).toBeNull();
      expect(entry.txLatencyMs).toBeNull();
      expect(entry.dlLinkScore).toBeNull();
      expect(entry.ulLinkScore).toBeNull();
      expect(entry.txBytesTotal).toBeNull();
      expect(entry.rxBytesTotal).toBeNull();
      expect(entry.remoteHostname).toBeNull();
      expect(entry.remoteIpAddresses).toEqual([]);
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
      const entryA = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: 'AA:BB:CC:DD:EE:FF' })
      ).value;
      const entryB = WirelessClientEntry.create(
        makeMinimalProps({ macAddress: '00:11:22:33:44:55' })
      ).value;

      expect(entryA.equals(entryB)).toBe(false);
    });

    it('should return false when signalRxDbm differs', () => {
      const entryA = WirelessClientEntry.create(
        makeFullProps({ signalRxDbm: -65 })
      ).value;
      const entryB = WirelessClientEntry.create(
        makeFullProps({ signalRxDbm: -75 })
      ).value;

      expect(entryA.equals(entryB)).toBe(false);
    });

    it('should return false for null', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(entry.equals(null as unknown as WirelessClientEntry)).toBe(false);
    });

    it('should return false for undefined', () => {
      const entry = WirelessClientEntry.create(makeMinimalProps()).value;

      expect(
        entry.equals(undefined as unknown as WirelessClientEntry)
      ).toBe(false);
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
