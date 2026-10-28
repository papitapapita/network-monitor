import { ValueObject, Result } from 'domain/shared/core';
import { PortSpeedProps } from '../props/PortSpeedProps';

// MON-142: the rates an Ethernet or SFP port negotiates.
export const PORT_SPEEDS_MBPS = [
  10, 100, 1000, 2500, 5000, 10000, 25000, 40000, 100000
] as const;

export class PortSpeed extends ValueObject<PortSpeedProps> {
  get mbps(): number {
    return this._props.mbps;
  }

  private constructor(props: PortSpeedProps) {
    super(props);
  }

  public static create(mbps: number): Result<PortSpeed> {
    if (!(PORT_SPEEDS_MBPS as readonly number[]).includes(mbps)) {
      return Result.fail<PortSpeed>(
        `expected speed must be one of ${PORT_SPEEDS_MBPS.join(', ')} Mbps`
      );
    }
    return Result.ok(new PortSpeed({ mbps }));
  }

  public static reconstitute(props: PortSpeedProps): PortSpeed {
    return new PortSpeed(props);
  }

  public toString(): string {
    return this.mbps >= 1000
      ? `${this.mbps / 1000} Gbps`
      : `${this.mbps} Mbps`;
  }
}
