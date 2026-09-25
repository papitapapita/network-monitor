import { TimeOfDay } from 'domain/shared/value-objects';

export interface TimeBlockProps {
  start: TimeOfDay;
  end: TimeOfDay;
}
