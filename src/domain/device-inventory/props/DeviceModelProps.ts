import { VendorId } from '../../shared/ids';

export interface DeviceModelProps {
  vendorId: VendorId;
  vendorName: string;
  vendorSlug: string;
  model: string;
  deviceType: string;
  createdAt: Date;
  updatedAt: Date;
}
