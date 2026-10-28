export interface DiscoverySegment {
  // IPv4 CIDR, stored as its network address ("192.168.1.0/24").
  cidr: string;
  // The probe agent that sweeps it; null sweeps it from the server.
  agentId: string | null;
}

export interface DiscoverySettingsProps {
  enabled: boolean;
  intervalHours: number;
  segments: DiscoverySegment[];
}
