import { DeviceNotificationPolicyResponseDTO } from './DeviceNotificationPolicyResponseDTO';

export interface BulkUpsertDeviceNotificationPoliciesResponseDTO {
  updated: DeviceNotificationPolicyResponseDTO[];
  failed: { id: string; error: string }[];
}
