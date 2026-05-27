import { LocationId } from 'domain/shared/ids';

export interface LocationUpdatedEventProps {
  readonly aggregateId: LocationId;
  readonly locationName: string;
  readonly changedFields: string[];
  readonly previousValues: Record<string, unknown>;
  readonly newValues: Record<string, unknown>;
  readonly dateTimeOccurred: Date;
}
