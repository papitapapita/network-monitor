export interface RecordAgentContactRequestDTO {
  agentId: string;
  agentVersion: string;
  // The agent's clock when it sent the message, epoch milliseconds.
  sentAt: number;
  receivedAt: Date;
}
