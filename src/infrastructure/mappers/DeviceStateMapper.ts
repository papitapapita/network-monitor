import { DeviceId } from 'domain/shared';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { DeviceStateProps } from 'domain/device-monitoring/props';

export class DeviceStateMapper {
  public static toDomain(raw: {
    id: string;
    deviceId: string;
    isOnline: boolean;
    lastSeen: Date | null;
    lastLatencyMs: unknown;
    consecutiveFailures: number;
    lastCheckedAt: Date | null;
    updatedAt: Date;
  }): DeviceState {
    const deviceIdResult = DeviceId.parse(raw.deviceId);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${raw.deviceId}" in device_states`
      );
    }
    const deviceId = deviceIdResult.value;
    const props: DeviceStateProps = {
      deviceId,
      isOnline: raw.isOnline,
      lastSeen: raw.lastSeen,
      lastLatencyMs:
        raw.lastLatencyMs !== null ? Number(raw.lastLatencyMs) : null,
      consecutiveFailures: raw.consecutiveFailures,
      lastCheckedAt: raw.lastCheckedAt,
      updatedAt: raw.updatedAt
    };
    return DeviceState.reconstitute(deviceId, props);
  }

  public static toPersistence(state: DeviceState) {
    return {
      deviceId: state.deviceId.toString(),
      isOnline: state.isOnline,
      lastSeen: state.lastSeen,
      lastLatencyMs: state.lastLatencyMs,
      consecutiveFailures: state.consecutiveFailures,
      lastCheckedAt: state.lastCheckedAt
    };
  }
}
