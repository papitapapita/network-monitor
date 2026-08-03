import { DeviceId } from 'domain/shared/ids';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { DeviceStateProps } from 'domain/device-monitoring/props';
import { ReachabilityStatus } from 'domain/device-monitoring/value-objects';
import { ReachabilityStatus as PrismaReachabilityStatus } from 'generated/prisma/client';

export class DeviceStateMapper {
  public static toDomain(raw: {
    id: string;
    deviceId: string;
    status: string;
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
    // A stored value is held to a stricter standard than an incoming one: no
    // trimming, no case-folding. A row that only matches after normalising means
    // the database and the domain have drifted, which is a defect to surface.
    if (!ReachabilityStatus.isValid(raw.status)) {
      throw new Error(
        `Data integrity violation: unrecognised ReachabilityStatus "${raw.status}" in device_states`
      );
    }
    const deviceId = deviceIdResult.value;
    const props: DeviceStateProps = {
      deviceId,
      status: ReachabilityStatus.create(raw.status).value,
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
      status: state.status.toString() as PrismaReachabilityStatus,
      lastSeen: state.lastSeen,
      lastLatencyMs: state.lastLatencyMs,
      consecutiveFailures: state.consecutiveFailures,
      lastCheckedAt: state.lastCheckedAt
    };
  }
}
