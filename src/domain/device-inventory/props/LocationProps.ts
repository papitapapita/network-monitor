import { LocationType } from '../enums';
import { Coordinates } from '../value-objects';

export interface LocationProps {
  name: string;
  type: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  coordinates?: Coordinates | null;
  createdAt: Date;
  updatedAt: Date;
}
