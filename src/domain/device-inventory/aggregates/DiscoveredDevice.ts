import { AggregateRoot, Guard, Result } from 'domain/shared/core';
import { DeviceId, DiscoveredDeviceId } from 'domain/shared/ids';
import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import { DiscoverySource } from '../enums';
import { DeviceSighting, DiscoveredDeviceProps } from '../props';

// A MAC the network showed that no device in inventory owns (DEV-200). It is
// a suggestion to create one, so it carries only what the sighting saw.
export class DiscoveredDevice extends AggregateRoot<
  DiscoveredDeviceProps,
  DiscoveredDeviceId
> {
  private constructor(
    props: DiscoveredDeviceProps,
    id: DiscoveredDeviceId
  ) {
    super(props, id);
  }

  get macAddress(): string {
    return this.props.macAddress;
  }

  get ipAddress(): string | null {
    return this.props.ipAddress;
  }

  get manufacturer(): string | null {
    return this.props.manufacturer;
  }

  get source(): DiscoverySource {
    return this.props.source;
  }

  get segment(): string | null {
    return this.props.segment;
  }

  get hostname(): string | null {
    return this.props.hostname;
  }

  get model(): string | null {
    return this.props.model;
  }

  get accessPointId(): string | null {
    return this.props.accessPointId;
  }

  get firstSeenAt(): Date {
    return this.props.firstSeenAt;
  }

  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }

  get ignoredAt(): Date | null {
    return this.props.ignoredAt;
  }

  get isIgnored(): boolean {
    return this.props.ignoredAt !== null;
  }

  public static create(
    sighting: DeviceSighting,
    id: DiscoveredDeviceId = DiscoveredDeviceId.create()
  ): Result<DiscoveredDevice> {
    const guard = Guard.againstNullOrUndefinedBulk([
      { argument: sighting?.macAddress, argumentName: 'macAddress' },
      { argument: sighting?.source, argumentName: 'source' },
      { argument: sighting?.seenAt, argumentName: 'seenAt' }
    ]);
    if (!guard.succeeded) {
      return Result.fail<DiscoveredDevice>(guard.message!);
    }

    const normalized = DiscoveredDevice.normalize(sighting);
    if (normalized.isFailure) {
      return Result.fail<DiscoveredDevice>(normalized.error);
    }
    const seen = normalized.value;

    return Result.ok(
      new DiscoveredDevice(
        {
          macAddress: seen.macAddress,
          ipAddress: seen.ipAddress,
          manufacturer: seen.manufacturer,
          source: seen.source,
          segment: seen.segment,
          hostname: seen.hostname,
          model: seen.model,
          accessPointId: seen.accessPointId,
          firstSeenAt: seen.seenAt,
          lastSeenAt: seen.seenAt,
          ignoredAt: null
        },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DiscoveredDeviceId,
    props: DiscoveredDeviceProps
  ): DiscoveredDevice {
    return new DiscoveredDevice(props, id);
  }

  // DEV-202: a later sighting refreshes what it saw; what it did not see (a
  // scan knows no AP, an AP no segment) keeps the earlier value.
  public sighted(sighting: DeviceSighting): Result<void> {
    const normalized = DiscoveredDevice.normalize(sighting);
    if (normalized.isFailure) return Result.fail(normalized.error);
    const seen = normalized.value;
    if (seen.macAddress !== this.props.macAddress) {
      return Result.fail('A sighting of another MAC address');
    }
    if (seen.seenAt < this.props.lastSeenAt) return Result.ok();

    this.props.ipAddress = seen.ipAddress ?? this.props.ipAddress;
    this.props.manufacturer =
      seen.manufacturer ?? this.props.manufacturer;
    this.props.source = seen.source;
    this.props.segment = seen.segment ?? this.props.segment;
    this.props.hostname = seen.hostname ?? this.props.hostname;
    this.props.model = seen.model ?? this.props.model;
    this.props.accessPointId =
      seen.accessPointId ?? this.props.accessPointId;
    this.props.lastSeenAt = seen.seenAt;
    return Result.ok();
  }

  // DEV-204: ignoring is kept until undone, however often it is seen again.
  public ignore(at: Date): void {
    if (this.props.ignoredAt === null) this.props.ignoredAt = at;
  }

  public unignore(): void {
    this.props.ignoredAt = null;
  }

  private static normalize(
    sighting: DeviceSighting
  ): Result<DeviceSighting> {
    const mac = MACAddress.create(sighting.macAddress);
    if (mac.isFailure) return Result.fail(mac.error);

    let ipAddress: string | null = null;
    if (sighting.ipAddress) {
      const ip = IPAddress.create(sighting.ipAddress);
      if (ip.isFailure) return Result.fail(ip.error);
      ipAddress = ip.value.value;
    }

    if (!Object.values(DiscoverySource).includes(sighting.source)) {
      return Result.fail(
        'source must be SCAN, AP_STATION, ROUTER_NEIGHBOR or ROUTER_ARP'
      );
    }
    if (Number.isNaN(sighting.seenAt.getTime())) {
      return Result.fail('seenAt must be a valid date');
    }
    if (
      sighting.accessPointId &&
      DeviceId.parse(sighting.accessPointId).isFailure
    ) {
      return Result.fail('accessPointId must be a device id');
    }

    return Result.ok({
      macAddress: mac.value.value,
      ipAddress,
      manufacturer: sighting.manufacturer?.trim() || null,
      source: sighting.source,
      segment: sighting.segment?.trim() || null,
      hostname: label(sighting.hostname),
      model: label(sighting.model),
      accessPointId: sighting.accessPointId || null,
      seenAt: sighting.seenAt
    });
  }
}

const MAX_LABEL_LENGTH = 100;

// Free text a radio reports about itself; cut to fit rather than refused.
function label(value: string | null): string | null {
  return value?.trim().slice(0, MAX_LABEL_LENGTH) || null;
}
