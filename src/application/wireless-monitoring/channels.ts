export const THROUGHPUT_FLEET_CHANNEL = 'throughput:fleet';

export function throughputDeviceChannel(deviceId: string): string {
  return `throughput:device:${deviceId}`;
}

export const THROUGHPUT_EVENT = 'throughput';
// only the fleet stream's opening frame — every later frame is a single-device
// `throughput` delta, not a replacement list
export const THROUGHPUT_SNAPSHOT_EVENT = 'throughput-snapshot';
