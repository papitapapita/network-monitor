// A probe execution failure means the local ping program could not be run —
// it says nothing about the device. Reported here so the composition root can
// detect the subsystem-wide fault these failures almost always indicate.
export interface IProbeHealthReporter {
  recordProbeExecutionFailure(deviceId: string, error: string): void;
  recordProbeExecuted(deviceId: string): void;
}

export const NullProbeHealthReporter: IProbeHealthReporter = {
  recordProbeExecutionFailure(): void {},
  recordProbeExecuted(): void {}
};
