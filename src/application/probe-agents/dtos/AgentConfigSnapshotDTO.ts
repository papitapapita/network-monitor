export interface AgentConfigDeviceDTO {
  index: number;
  ipAddress: string;
  intervalSeconds: number;
  failuresBeforeDown: number;
}

export interface AgentConfigSnapshotDTO {
  // Derived from the content, so an unchanged configuration keeps its
  // version and is not pushed again.
  version: string;
  devices: AgentConfigDeviceDTO[];
}
