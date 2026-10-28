// Where the new devices were seen, for the notice's wording.
export interface NewDevicesNotice {
  count: number;
  where: string;
  occurredAt: Date;
}

// DEV-206: tells staff, never fails the sighting that found them.
export interface IDiscoveryNotifier {
  newDevicesFound(notice: NewDevicesNotice): Promise<void>;
}
