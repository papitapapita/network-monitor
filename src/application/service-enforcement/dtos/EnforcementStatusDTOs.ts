export interface SuspensionEnforcementEntryDTO {
  contractedServiceId: string;
  targetIp: string;
}

export interface ListSuspensionEnforcementsResponseDTO {
  checkedAt: string;
  enforcements: SuspensionEnforcementEntryDTO[];
}

export interface GetServiceEnforcementRequestDTO {
  contractedServiceId: string;
}

export interface GetServiceEnforcementResponseDTO {
  contractedServiceId: string;
  enforced: boolean;
  targetIp: string | null;
  checkedAt: string;
}
