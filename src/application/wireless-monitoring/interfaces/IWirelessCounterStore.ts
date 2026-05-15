export interface CounterSnapshot {
  ifHCInOctets: bigint | null;
  ifHCOutOctets: bigint | null;
  ifInUcastPkts: number | null;
  ifOutUcastPkts: number | null;
  timestamp: Date;
}

export interface CounterDelta {
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTxPps: number | null;
  throughputRxPps: number | null;
}

export interface IWirelessCounterStore {
  computeDelta(deviceId: string, current: CounterSnapshot): CounterDelta;
  store(deviceId: string, snapshot: CounterSnapshot): void;
  clear(deviceId: string): void;
}
