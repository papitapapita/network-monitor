import { VendorId } from 'domain/shared/ids';
import { DeviceType } from '../value-objects/DeviceType';

export interface DeviceModelProps {
  vendorId: VendorId;
  // vendorName/vendorSlug are not stored on this table; they are hydrated at
  // load time via a JOIN so callers don't need a second round-trip to Vendor.
  vendorName: string;
  vendorSlug: string;
  model: string;
  deviceType: DeviceType;
  isWireless: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
