import { Result } from '../core/Result';
import { VendorSettings } from '../value-objects/VendorSettings';

export interface IVendorSettingsRepository {
  // Always answers: the saved settings, or the env defaults when the vendor
  // has never saved any (INS-029).
  get(): Promise<Result<VendorSettings>>;
  save(settings: VendorSettings): Promise<Result<void>>;
}
