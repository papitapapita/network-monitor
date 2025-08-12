export interface APEntry {
  IPaddress: string;
  frequencyToPoll: number;
  timeout?: number;
  enabled?: boolean;
  name?: string;
  description?: string;
  lastUpdated?: Date;
}
