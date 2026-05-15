import {
  IWirelessCounterStore,
  CounterSnapshot,
  CounterDelta
} from 'application/wireless-monitoring/interfaces';

export class WirelessCounterStore implements IWirelessCounterStore {
  private readonly snapshots = new Map<string, CounterSnapshot>();
  private static readonly MAX_32BIT = 4_294_967_296n;
  private static readonly MAX_64BIT = 18_446_744_073_709_551_616n;

  computeDelta(
    deviceId: string,
    current: CounterSnapshot
  ): CounterDelta {
    const previous = this.snapshots.get(deviceId);
    if (!previous) {
      return {
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null
      };
    }

    const dtSeconds =
      (current.timestamp.getTime() - previous.timestamp.getTime()) /
      1000;
    if (dtSeconds <= 0) {
      return {
        throughputTxBps: null,
        throughputRxBps: null,
        throughputTxPps: null,
        throughputRxPps: null
      };
    }

    const txBytes = this.delta64(
      previous.ifHCOutOctets,
      current.ifHCOutOctets
    );
    const rxBytes = this.delta64(
      previous.ifHCInOctets,
      current.ifHCInOctets
    );
    const txPkts = this.delta32(
      previous.ifOutUcastPkts,
      current.ifOutUcastPkts
    );
    const rxPkts = this.delta32(
      previous.ifInUcastPkts,
      current.ifInUcastPkts
    );

    return {
      throughputTxBps:
        txBytes !== null
          ? Math.round((Number(txBytes) * 8) / dtSeconds)
          : null,
      throughputRxBps:
        rxBytes !== null
          ? Math.round((Number(rxBytes) * 8) / dtSeconds)
          : null,
      throughputTxPps:
        txPkts !== null ? Math.round(txPkts / dtSeconds) : null,
      throughputRxPps:
        rxPkts !== null ? Math.round(rxPkts / dtSeconds) : null
    };
  }

  store(deviceId: string, snapshot: CounterSnapshot): void {
    this.snapshots.set(deviceId, snapshot);
  }

  clear(deviceId: string): void {
    this.snapshots.delete(deviceId);
  }

  private delta64(
    prev: bigint | null,
    curr: bigint | null
  ): bigint | null {
    if (prev === null || curr === null) return null;
    if (curr >= prev) return curr - prev;
    return WirelessCounterStore.MAX_64BIT + curr - prev;
  }

  private delta32(
    prev: number | null,
    curr: number | null
  ): number | null {
    if (prev === null || curr === null) return null;
    if (curr >= prev) return curr - prev;
    return Number(WirelessCounterStore.MAX_32BIT) + curr - prev;
  }
}
