// Exactly one selector: `deviceIds`, or every live device currently behind
// `fromAgentId` (null selects the ones polled in-process). `agentId: null`
// moves the selection back to in-process polling.
export interface AssignDevicesToAgentRequestDTO {
  agentId: string | null;
  deviceIds?: string[];
  fromAgentId?: string | null;
}
