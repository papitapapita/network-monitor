// WIRELESS: the AP a station's radio reports (DEV-190). POE: the switch port
// labelled with the device's IP (DEV-191). ROUTER_NEIGHBOR: the MikroTik port
// the device is clearly cabled to (DEV-196).
export type UpstreamSuggestionSource =
  | 'WIRELESS'
  | 'POE'
  | 'ROUTER_NEIGHBOR';

export interface UpstreamSuggestionDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  locationName: string | null;
  currentUpstreamDeviceId: string | null;
  currentUpstreamDeviceName: string | null;
  suggestedUpstreamDeviceId: string;
  suggestedUpstreamDeviceName: string;
  source: UpstreamSuggestionSource;
  // WIRELESS only: how the AP was recognised, and when the radio said so.
  matchedBy: 'MAC' | 'IP' | null;
  observedAt: string | null;
  // POE: the switch port that powers the device. ROUTER_NEIGHBOR: the
  // router port it is heard on.
  port: string | null;
}

export interface ListUpstreamSuggestionsRequestDTO {
  locationId?: string;
}

export interface UpstreamSuggestionsResponseDTO {
  suggestions: UpstreamSuggestionDTO[];
  total: number;
  // Switches that could not be read: POE suggestions may be missing.
  unreadSwitches: {
    deviceId: string;
    name: string;
    reason: string;
  }[];
  // MikroTiks that could not be read: ROUTER_NEIGHBOR suggestions may be
  // missing (DEV-196).
  unreadRouters: {
    deviceId: string;
    name: string;
    reason: string;
  }[];
}

export interface UpstreamLinkRequestDTO {
  deviceId: string;
  upstreamDeviceId: string;
}

export interface AcceptUpstreamSuggestionsRequestDTO {
  links: UpstreamLinkRequestDTO[];
}

export type UpstreamLinkOutcome = 'LINKED' | 'UNCHANGED' | 'FAILED';

export interface UpstreamLinkResultDTO {
  deviceId: string;
  upstreamDeviceId: string;
  outcome: UpstreamLinkOutcome;
  error: string | null;
}

export interface AcceptUpstreamSuggestionsResponseDTO {
  results: UpstreamLinkResultDTO[];
  linked: number;
  failed: number;
}
