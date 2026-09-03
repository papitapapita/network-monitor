import { TimeOfDay } from '../value-objects';

export interface QuietHoursProps {
  start: TimeOfDay;
  end: TimeOfDay;
}
