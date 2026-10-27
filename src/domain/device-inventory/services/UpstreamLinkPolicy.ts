import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Device } from '../aggregates';

// The checks on an upstream link that need more than the device itself: the
// upstream's own state, and the chain above it. The self-link (DEV-181) is
// the aggregate's, because it needs nothing else.
export class UpstreamLinkPolicy {
  // `upstreamChain` is every device above `upstream`, nearest first.
  public static check(
    device: Device,
    upstream: Device,
    upstreamChain: DeviceId[]
  ): Result<void> {
    // DEV-183: a link records where a working device hangs, so the device it
    // hangs off has to be on the network too.
    if (upstream.isDeleted()) {
      return Result.fail('The upstream device has been deleted');
    }
    if (
      !upstream.status.isActive() &&
      !upstream.status.isCommissioning()
    ) {
      return Result.fail(
        `The upstream device must be ACTIVE or COMMISSIONING, not ${upstream.status.toString()}`
      );
    }

    // DEV-182: a device below this one cannot also be above it. Whatever walks
    // up the chain — the map, alert suppression — would never reach a root.
    const above = [upstream.id, ...upstreamChain];
    if (above.some((id) => id.equals(device.id))) {
      return Result.fail(
        `${upstream.name.value} is already downstream of ${device.name.value} — linking them would form a loop`
      );
    }

    return Result.ok();
  }
}
