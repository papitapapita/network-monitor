export interface RetireDeviceAfterCancellationRequestDTO {
  deviceId: string;
}

export type RetireDeviceAfterCancellationOutcome =
  | 'RETIRED'
  | 'SKIPPED_NOT_FOUND'
  | 'SKIPPED_NO_OWNER'
  | 'SKIPPED_ALREADY_RETIRED';

export interface RetireDeviceAfterCancellationResponseDTO {
  deviceId: string;
  outcome: RetireDeviceAfterCancellationOutcome;
  status: string | null;
}
