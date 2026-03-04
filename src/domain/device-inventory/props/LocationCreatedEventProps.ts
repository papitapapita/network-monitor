import { LocationId } from '../../shared/ids/LocationId';
import { LocationType } from '../enums/LocationType';

export interface LocationCreatedEventProps {
  readonly aggregateId: LocationId;
  readonly locationName: string;
  readonly locationType: LocationType;
  readonly dateTimeOccurred: Date;
}
