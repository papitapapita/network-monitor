export interface ReplaceDeviceRequestDTO {
  // The unit being replaced.
  id: string;

  // Where the outgoing unit lands. Required, and deliberately the caller's
  // choice: a swap is not always a failure — an upgraded antenna that still
  // works belongs back in INVENTORY, not DAMAGED.
  retiredStatus: string;

  // The replacement hardware. A different physical box, usually a different
  // model — which is exactly why this is not an update to the existing row.
  deviceModelId: string;
  name?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  description?: string | null;
  installedDate?: string | null;
}
