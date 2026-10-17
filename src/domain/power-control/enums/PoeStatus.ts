// PWR-021: what the port is actually doing. FAULT covers short circuit,
// overload and a voltage or current out of range.
export enum PoeStatus {
  POWERED = 'POWERED',
  NO_LOAD = 'NO_LOAD',
  OFF = 'OFF',
  FAULT = 'FAULT',
  UNKNOWN = 'UNKNOWN'
}
