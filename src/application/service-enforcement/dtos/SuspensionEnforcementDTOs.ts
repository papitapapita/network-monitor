export interface EnforceSuspensionRequestDTO {
  contractedServiceId: string;
}

export interface EnforceSuspensionResponseDTO {
  contractedServiceId: string;
  queueName: string;
  targetIp: string;
}

export interface ReleaseSuspensionRequestDTO {
  contractedServiceId: string;
}

export interface ReleaseSuspensionResponseDTO {
  contractedServiceId: string;
  queueName: string;
}
