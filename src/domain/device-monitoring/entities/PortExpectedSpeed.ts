import { Entity, Guard, Result } from 'domain/shared/core';
import { DeviceId, PortExpectedSpeedId } from 'domain/shared/ids';
import { PortExpectedSpeedProps } from '../props';
import { PortSpeed } from '../value-objects';

export const PORT_NAME_MAX_LENGTH = 64;
export const SLOW_CHECKS_BEFORE_ALERT = 2;

// SHORT: linked below the expected speed or at half duplex, or no link on a
// port that alerts on it (MON-149). UNJUDGED: read, but nothing to judge (no
// link, no rate, the port is gone).
export type PortCheckOutcome = 'MET' | 'SHORT' | 'UNJUDGED';
export type PortAlertChange = 'RAISED' | 'RECOVERED' | null;

export interface PortExpectedSpeedInput {
  deviceId: DeviceId;
  portName: string;
  expectedMbps: number;
  alertOnNoLink?: boolean;
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

  get alertOnNoLink(): boolean {
    return this.props.alertOnNoLink;
  }

  get slowChecks(): number {
    return this.props.slowChecks;
  }

  get alertedAt(): Date | null {
    return this.props.alertedAt;
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
      expected: expected.value,
      alertOnNoLink: input.alertOnNoLink ?? false,
      slowChecks: 0,
      alertedAt: null
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

  // MON-149: turned off, a port with no link breaks its streak at the next
  // check rather than here.
  public changeAlertOnNoLink(on: boolean): void {
    this.props = { ...this.props, alertOnNoLink: on };
  }

  // MON-143: slower than expected, or at half duplex, falls short.
  public isMetBy(link: PortLink): boolean {
    return link.fullDuplex && link.rateMbps >= this.expected.mbps;
  }

  // MON-147: an alert after SLOW_CHECKS_BEFORE_ALERT short checks in a row,
  // once until the port meets its speed again. A check with nothing to judge
  // breaks the streak but leaves an open alert open.
  public recordCheck(
    outcome: PortCheckOutcome,
    at: Date
  ): PortAlertChange {
    if (outcome === 'UNJUDGED') {
      this.props.slowChecks = 0;
      return null;
    }
    if (outcome === 'MET') {
      this.props.slowChecks = 0;
      if (this.props.alertedAt === null) return null;
      this.props.alertedAt = null;
      return 'RECOVERED';
    }
    this.props.slowChecks += 1;
    if (
      this.props.alertedAt !== null ||
      this.props.slowChecks < SLOW_CHECKS_BEFORE_ALERT
    ) {
      return null;
    }
    this.props.alertedAt = at;
    return 'RAISED';
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
