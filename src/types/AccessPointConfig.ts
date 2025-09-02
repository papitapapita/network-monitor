export interface AccessPointConfig {
  IPaddress: string;
  frequencyToPoll: number;
  timeout?: number;
  enabled?: boolean;
  name?: string;
  lastUpdated?: Date;
}
