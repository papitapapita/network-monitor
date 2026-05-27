import { LocationId } from 'domain/shared/ids/LocationId';
import { LocationType } from '../enums';

export interface LocationCreatedEventProps {
  readonly aggregateId: LocationId;
  readonly locationName: string;
  readonly locationType: LocationType;
  readonly dateTimeOccurred: Date;
}
