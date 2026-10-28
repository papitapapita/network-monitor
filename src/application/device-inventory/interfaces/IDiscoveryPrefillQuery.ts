import { Result } from 'domain/shared/core';

export interface PrefillAccessPoint {
  deviceId: string;
  agentId: string | null;
}

export interface PrefillModel {
  id: string;
  model: string;
}

export interface IDiscoveryPrefillQuery {
  // null once the AP is deleted.
  findAccessPoint(
    deviceId: string
  ): Promise<Result<PrefillAccessPoint | null>>;

  // DEV-209: the catalog model AirOS's platform name stands for — by name,
  // or failing that the one model radios reporting that name are on file as.
  guessModel(reported: string): Promise<Result<PrefillModel | null>>;
}
