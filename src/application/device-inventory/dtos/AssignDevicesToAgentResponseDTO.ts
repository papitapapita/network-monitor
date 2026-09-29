export interface AssignDevicesToAgentResponseDTO {
  assigned: string[];
  failed: { id: string; error: string }[];
}
