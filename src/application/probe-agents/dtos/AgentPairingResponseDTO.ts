import { AgentResponseDTO } from './AgentResponseDTO';

// The pairing key is returned once, here, and never again.
export interface AgentPairingResponseDTO {
  agent: AgentResponseDTO;
  pairingKey: string;
}
