import { Address, Coordinates, LocationType } from '../value-objects';

export interface LocationProps {
  name: string;
  type: LocationType;
  address: Address | null;
  coordinates?: Coordinates | null;
  createdAt: Date;
  updatedAt: Date;
}
