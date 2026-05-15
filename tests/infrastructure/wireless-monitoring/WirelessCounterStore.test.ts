// Source: src/infrastructure/wireless-monitoring/WirelessCounterStore.ts

import { WirelessCounterStore } from '../../../src/infrastructure/wireless-monitoring/WirelessCounterStore';
import { CounterSnapshot } from 'application/wireless-monitoring/interfaces';

const makeSnapshot = (
  overrides: Partial<CounterSnapshot> & { timestamp: Date }
): CounterSnapshot => ({
  ifHCInOctets: 1000n,
  ifHCOutOctets: 2000n,
  ifInUcastPkts: 100,
  ifOutUcastPkts: 200,
  ...overrides,
});

describe('WirelessCounterStore', () => {
  let store: WirelessCounterStore;

  beforeEach(() => {
    store = new WirelessCounterStore();
  });

  describe('computeDelta — first observation (no prior snapshot)', () => {
    it('should return all-null delta when no snapshot has been stored for the device', () => {
      const snapshot = makeSnapshot({ timestamp: new Date() });

      const delta = store.computeDelta('device-1', snapshot);

      expect(delta).toEqual({
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
      });
    });
  });

  describe('computeDelta — time guard', () => {
    it('should return all-null delta when the current timestamp is not after the previous timestamp', () => {
      const t = new Date('2024-01-01T00:00:00Z');
      store.store('device-1', makeSnapshot({ timestamp: t }));

      // Same timestamp → dtSeconds === 0
      const delta = store.computeDelta('device-1', makeSnapshot({ timestamp: t }));

      expect(delta).toEqual({
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
      });
    });

    it('should return all-null delta when current timestamp is before the previous timestamp', () => {
      const later = new Date('2024-01-01T00:01:00Z');
      const earlier = new Date('2024-01-01T00:00:00Z');
      store.store('device-1', makeSnapshot({ timestamp: later }));

      const delta = store.computeDelta('device-1', makeSnapshot({ timestamp: earlier }));

      expect(delta).toEqual({
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
      });
    });
  });

  describe('computeDelta — normal counter increment', () => {
    it('should compute throughput correctly when counters increase monotonically', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:10Z'); // 10 seconds later

      store.store('device-1', makeSnapshot({
        timestamp: t0,
        ifHCOutOctets: 0n,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 0,
        ifInUcastPkts: 0,
      }));

      // 8000 octets TX in 10s → 8000 * 8 / 10 = 6400 bps
      // 4000 octets RX in 10s → 4000 * 8 / 10 = 3200 bps
      // 100 TX packets in 10s → 10 pps
      // 50 RX packets in 10s → 5 pps
      const delta = store.computeDelta('device-1', makeSnapshot({
        timestamp: t1,
        ifHCOutOctets: 8000n,
        ifHCInOctets: 4000n,
        ifOutUcastPkts: 100,
        ifInUcastPkts: 50,
      }));

      expect(delta.throughputTxBps).toBe(6400);
      expect(delta.throughputRxBps).toBe(3200);
      expect(delta.throughputTxPps).toBe(10);
      expect(delta.throughputRxPps).toBe(5);
    });
  });

  describe('computeDelta — 64-bit counter wrap-around', () => {
    it('should handle 64-bit counter wrap correctly by adding MAX_64BIT to the difference', () => {
      const MAX_64BIT = 18_446_744_073_709_551_616n;
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:01Z'); // 1 second

      // Previous counter near max; current wraps to a small value
      const prevOut = MAX_64BIT - 100n;
      const currOut = 900n; // wrapped: actual increment = 1000 bytes

      store.store('device-1', makeSnapshot({
        timestamp: t0,
        ifHCOutOctets: prevOut,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 0,
        ifInUcastPkts: 0,
      }));

      const delta = store.computeDelta('device-1', makeSnapshot({
        timestamp: t1,
        ifHCOutOctets: currOut,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 0,
        ifInUcastPkts: 0,
      }));

      // 1000 bytes * 8 bits / 1 second = 8000 bps
      expect(delta.throughputTxBps).toBe(8000);
    });
  });

  describe('computeDelta — 32-bit counter wrap-around', () => {
    it('should handle 32-bit packet counter wrap correctly', () => {
      const MAX_32BIT = 4_294_967_296;
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:01Z'); // 1 second

      store.store('device-1', makeSnapshot({
        timestamp: t0,
        ifHCOutOctets: 0n,
        ifHCInOctets: 0n,
        ifOutUcastPkts: MAX_32BIT - 50,
        ifInUcastPkts: 0,
      }));

      // Wraps: 100 - (MAX_32BIT - 50) < 0 → uses wrap: MAX_32BIT + 100 - (MAX_32BIT - 50) = 150
      const delta = store.computeDelta('device-1', makeSnapshot({
        timestamp: t1,
        ifHCOutOctets: 0n,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 100,
        ifInUcastPkts: 0,
      }));

      expect(delta.throughputTxPps).toBe(150); // 150 pkts / 1 sec
    });
  });

  describe('computeDelta — null counter values', () => {
    it('should return null throughput fields when ifHCOutOctets is null', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:10Z');

      store.store('device-1', makeSnapshot({
        timestamp: t0,
        ifHCOutOctets: null,
        ifHCInOctets: null,
        ifOutUcastPkts: null,
        ifInUcastPkts: null,
      }));

      const delta = store.computeDelta('device-1', makeSnapshot({
        timestamp: t1,
        ifHCOutOctets: null,
        ifHCInOctets: null,
        ifOutUcastPkts: null,
        ifInUcastPkts: null,
      }));

      expect(delta.throughputTxBps).toBeNull();
      expect(delta.throughputRxBps).toBeNull();
      expect(delta.throughputTxPps).toBeNull();
      expect(delta.throughputRxPps).toBeNull();
    });
  });

  describe('store', () => {
    it('should persist a snapshot so a subsequent computeDelta uses it as the baseline', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:10Z');

      store.store('device-1', makeSnapshot({
        timestamp: t0,
        ifHCOutOctets: 0n,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 0,
        ifInUcastPkts: 0,
      }));

      const delta = store.computeDelta('device-1', makeSnapshot({
        timestamp: t1,
        ifHCOutOctets: 80_000n,
        ifHCInOctets: 0n,
        ifOutUcastPkts: 0,
        ifInUcastPkts: 0,
      }));

      // Verify the store was effective by checking a non-null delta
      expect(delta.throughputTxBps).not.toBeNull();
      expect(delta.throughputTxBps).toBe(80_000 * 8 / 10); // 64000 bps
    });
  });

  describe('clear', () => {
    it('should remove the snapshot for the specified device so the next computeDelta returns all-null', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      store.store('device-1', makeSnapshot({ timestamp: t0 }));

      store.clear('device-1');

      const delta = store.computeDelta('device-1', makeSnapshot({ timestamp: new Date() }));
      expect(delta).toEqual({
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null,
      });
    });

    it('should not affect snapshots for other devices when clearing one device', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:10Z');

      store.store('device-1', makeSnapshot({ timestamp: t0, ifHCOutOctets: 0n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));
      store.store('device-2', makeSnapshot({ timestamp: t0, ifHCOutOctets: 0n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));

      store.clear('device-1');

      // device-1 is gone
      const delta1 = store.computeDelta('device-1', makeSnapshot({ timestamp: t1 }));
      expect(delta1.throughputTxBps).toBeNull();

      // device-2 still has its baseline
      const delta2 = store.computeDelta('device-2', makeSnapshot({ timestamp: t1, ifHCOutOctets: 8000n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));
      expect(delta2.throughputTxBps).not.toBeNull();
    });

    it('should silently do nothing when clearing a device that was never stored', () => {
      expect(() => store.clear('nonexistent-device')).not.toThrow();
    });
  });

  describe('multiple devices tracked independently', () => {
    it('should track separate counters for different device IDs', () => {
      const t0 = new Date('2024-01-01T00:00:00Z');
      const t1 = new Date('2024-01-01T00:00:10Z');

      store.store('device-A', makeSnapshot({ timestamp: t0, ifHCOutOctets: 0n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));
      store.store('device-B', makeSnapshot({ timestamp: t0, ifHCOutOctets: 0n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));

      const deltaA = store.computeDelta('device-A', makeSnapshot({ timestamp: t1, ifHCOutOctets: 10_000n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));
      const deltaB = store.computeDelta('device-B', makeSnapshot({ timestamp: t1, ifHCOutOctets: 20_000n, ifHCInOctets: 0n, ifOutUcastPkts: 0, ifInUcastPkts: 0 }));

      expect(deltaA.throughputTxBps).toBe(10_000 * 8 / 10);
      expect(deltaB.throughputTxBps).toBe(20_000 * 8 / 10);
      expect(deltaA.throughputTxBps).not.toBe(deltaB.throughputTxBps);
    });
  });
});
