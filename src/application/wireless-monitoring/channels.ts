export const THROUGHPUT_FLEET_CHANNEL = 'throughput:fleet';

export function throughputDeviceChannel(deviceId: string): string {
  return `throughput:device:${deviceId}`;
}

export const THROUGHPUT_EVENT = 'throughput';
// only the fleet stream's opening frame — every later frame is a single-device
// `throughput` delta, not a replacement list
export const THROUGHPUT_SNAPSHOT_EVENT = 'throughput-snapshot';

export function diagnosisDeviceChannel(deviceId: string): string {
  return `diagnosis:device:${deviceId}`;
}

// opening frame of a diagnosis stream: the full session with its samples
export const DIAGNOSIS_EVENT = 'diagnosis';
export const DIAGNOSIS_PING_EVENT = 'ping';
export const DIAGNOSIS_RADIO_EVENT = 'radio';
export const DIAGNOSIS_REPORT_EVENT = 'report';
// final frame; the client closes the EventSource on it, otherwise the
// browser would reconnect into a finished session
export const DIAGNOSIS_END_EVENT = 'end';
