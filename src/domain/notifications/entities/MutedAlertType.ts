import { Entity, Result } from 'domain/shared/core';
import { MutedAlertTypeId } from 'domain/shared/ids';
import { MutedAlertTypeProps } from '../props';

// Matches the bare metric segment of Alert.type (`device_unreachable`, or
// the middle segment of `wireless:<metric>:<severity>`) — lowercase letters,
// digits and underscores, the shape every producer already uses. Not a
// whitelist of known metrics: that would make this context depend on
// wireless-monitoring's rule set, exactly the coupling ADR-0001 avoids.
const METRIC_PATTERN = /^[a-z][a-z0-9_]*$/;

export class MutedAlertType extends Entity<
  MutedAlertTypeProps,
  MutedAlertTypeId
> {
  private constructor(
    props: MutedAlertTypeProps,
    id: MutedAlertTypeId
  ) {
    super(props, id);
  }

  get metric(): string {
    return this.props.metric;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public static create(
    metric: string,
    id: MutedAlertTypeId = MutedAlertTypeId.create()
  ): Result<MutedAlertType> {
    const trimmed = metric?.trim();
    if (!trimmed) {
      return Result.fail<MutedAlertType>('metric is required');
    }
    if (!METRIC_PATTERN.test(trimmed)) {
      return Result.fail<MutedAlertType>(
        'metric must be lowercase letters, digits and underscores'
      );
    }

    return Result.ok(
      new MutedAlertType(
        { metric: trimmed, createdAt: new Date() },
        id
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: MutedAlertTypeId,
    props: MutedAlertTypeProps
  ): MutedAlertType {
    return new MutedAlertType(props, id);
  }
}
