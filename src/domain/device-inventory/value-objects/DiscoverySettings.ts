import { ValueObject, Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { DiscoverySegment, DiscoverySettingsProps } from '../props';

export const DEFAULT_DISCOVERY_INTERVAL_HOURS = 24;
export const MIN_DISCOVERY_INTERVAL_HOURS = 1;
export const MAX_DISCOVERY_INTERVAL_HOURS = 168;
export const MAX_DISCOVERY_SEGMENTS = 16;
// /22 is 1022 hosts, the most one sweep pings (same cap as a manual scan).
export const MIN_SEGMENT_PREFIX = 22;
export const MAX_SEGMENT_PREFIX = 30;

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)';
const CIDR = new RegExp(
  `^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}/(\\d{1,2})$`
);

// The install's scheduled network scan (DEV-210), replaced as a whole by
// the administrator.
export class DiscoverySettings extends ValueObject<DiscoverySettingsProps> {
  get enabled(): boolean {
    return this._props.enabled;
  }

  get intervalHours(): number {
    return this._props.intervalHours;
  }

  get segments(): DiscoverySegment[] {
    return this._props.segments.map((s) => ({ ...s }));
  }

  private constructor(props: DiscoverySettingsProps) {
    super(props);
  }

  public static create(
    props: DiscoverySettingsProps
  ): Result<DiscoverySettings> {
    if (typeof props.enabled !== 'boolean') {
      return Result.fail('enabled must be true or false');
    }
    if (
      !Number.isInteger(props.intervalHours) ||
      props.intervalHours < MIN_DISCOVERY_INTERVAL_HOURS ||
      props.intervalHours > MAX_DISCOVERY_INTERVAL_HOURS
    ) {
      return Result.fail(
        `intervalHours must be a whole number from ${MIN_DISCOVERY_INTERVAL_HOURS} to ${MAX_DISCOVERY_INTERVAL_HOURS}`
      );
    }
    if (!Array.isArray(props.segments)) {
      return Result.fail('segments must be a list');
    }
    if (props.segments.length > MAX_DISCOVERY_SEGMENTS) {
      return Result.fail(
        `segments must be at most ${MAX_DISCOVERY_SEGMENTS}`
      );
    }

    const segments: DiscoverySegment[] = [];
    for (const raw of props.segments) {
      const segment = DiscoverySettings.toSegment(raw);
      if (segment.isFailure) return Result.fail(segment.error);
      const repeated = segments.some(
        (s) =>
          s.cidr === segment.value.cidr &&
          s.agentId === segment.value.agentId
      );
      if (repeated) {
        return Result.fail(
          `segment ${segment.value.cidr} is listed twice for the same scanner`
        );
      }
      segments.push(segment.value);
    }

    return Result.ok(
      new DiscoverySettings({
        enabled: props.enabled,
        intervalHours: props.intervalHours,
        segments
      })
    );
  }

  // What applies until the administrator saves the settings: off, with no
  // segments, so an upgrade sweeps nothing on its own.
  public static defaults(): DiscoverySettings {
    return new DiscoverySettings({
      enabled: false,
      intervalHours: DEFAULT_DISCOVERY_INTERVAL_HOURS,
      segments: []
    });
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: DiscoverySettingsProps
  ): DiscoverySettings {
    return new DiscoverySettings(props);
  }

  private static toSegment(
    raw: DiscoverySegment
  ): Result<DiscoverySegment> {
    const cidr = typeof raw?.cidr === 'string' ? raw.cidr.trim() : '';
    const match = CIDR.exec(cidr);
    const prefix = match ? Number(match[5]) : NaN;
    if (
      !match ||
      prefix < MIN_SEGMENT_PREFIX ||
      prefix > MAX_SEGMENT_PREFIX
    ) {
      return Result.fail(
        `segment "${cidr}" must be an IPv4 CIDR from /${MIN_SEGMENT_PREFIX} to /${MAX_SEGMENT_PREFIX}`
      );
    }

    let agentId: string | null = null;
    if (raw.agentId !== null && raw.agentId !== undefined) {
      const parsed = AgentId.parse(raw.agentId);
      if (parsed.isFailure) {
        return Result.fail(
          `segment ${cidr}: agentId must be an agent id`
        );
      }
      agentId = parsed.value.toString();
    }

    const octets = match.slice(1, 5).map(Number);
    const address =
      ((octets[0] << 24) |
        (octets[1] << 16) |
        (octets[2] << 8) |
        octets[3]) >>>
      0;
    const network = (address & ((~0 << (32 - prefix)) >>> 0)) >>> 0;
    const base = [24, 16, 8, 0]
      .map((shift) => (network >>> shift) & 0xff)
      .join('.');

    return Result.ok({ cidr: `${base}/${prefix}`, agentId });
  }
}
