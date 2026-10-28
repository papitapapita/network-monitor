import { Entity, Guard, Result } from 'domain/shared/core';
import { DeviceId, PortExpectedSpeedId } from 'domain/shared/ids';
import { PortExpectedSpeedProps } from '../props';
import { PortSpeed } from '../value-objects';

export const PORT_NAME_MAX_LENGTH = 64;

export interface PortExpectedSpeedInput {
  deviceId: DeviceId;
  portName: string;
  expectedMbps: number;
}

export interface PortLink {
  rateMbps: number;
  fullDuplex: boolean;
}

// MON-142: the speed one port of a MikroTik should link at, set by an
// operator. One per device and port name.
export class PortExpectedSpeed extends Entity<
  PortExpectedSpeedProps,
  PortExpectedSpeedId
> {
  private constructor(
    props: PortExpectedSpeedProps,
    id: PortExpectedSpeedId
  ) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get portName(): string {
    return this.props.portName;
  }

  get expected(): PortSpeed {
    return this.props.expected;
  }

  public static create(
    input: PortExpectedSpeedInput,
    id: PortExpectedSpeedId = PortExpectedSpeedId.create()
  ): Result<PortExpectedSpeed> {
    const guard = Guard.againstNullOrUndefinedBulk([
      { argument: input?.deviceId, argumentName: 'deviceId' },
      { argument: input?.portName, argumentName: 'portName' },
      { argument: input?.expectedMbps, argumentName: 'expectedMbps' }
    ]);
    if (!guard.succeeded) {
      return Result.fail<PortExpectedSpeed>(guard.message!);
    }

    const expected = PortSpeed.create(input.expectedMbps);
    if (expected.isFailure) {
      return Result.fail<PortExpectedSpeed>(expected.error);
    }
    const props = {
      deviceId: input.deviceId,
      portName: input.portName.trim(),
      expected: expected.value
    };
    const problem = PortExpectedSpeed.validate(props);
    if (problem) return Result.fail<PortExpectedSpeed>(problem);

    return Result.ok(new PortExpectedSpeed(props, id));
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: PortExpectedSpeedId,
    props: PortExpectedSpeedProps
  ): PortExpectedSpeed {
    return new PortExpectedSpeed(props, id);
  }

  public changeTo(expectedMbps: number): Result<void> {
    const expected = PortSpeed.create(expectedMbps);
    if (expected.isFailure) return Result.fail(expected.error);
    const next = { ...this.props, expected: expected.value };
    const problem = PortExpectedSpeed.validate(next);
    if (problem) return Result.fail(problem);
    this.props = next;
    return Result.ok();
  }

  // MON-143: slower than expected, or at half duplex, falls short.
  public isMetBy(link: PortLink): boolean {
    return link.fullDuplex && link.rateMbps >= this.expected.mbps;
  }

  private static validate(
    props: PortExpectedSpeedProps
  ): string | null {
    if (props.portName.length === 0) return 'portName is required';
    if (props.portName.length > PORT_NAME_MAX_LENGTH) {
      return `portName must be at most ${PORT_NAME_MAX_LENGTH} characters`;
    }
    return null;
  }
}
