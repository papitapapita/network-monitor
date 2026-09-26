import { Result } from 'domain/shared/core';
import { DecryptedCredentials } from './IDeviceCredentialsRepository';
import { IWirelessCollector } from './IWirelessCollector';
import { LinkDiagnosisDTO } from '../dtos';

export interface LinkDiagnosisTarget {
  deviceId: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  ipAddress: string;
  parent: { deviceId: string | null; ipAddress: string } | null;
  collector: IWirelessCollector;
  credentials: DecryptedCredentials;
  durationSeconds: number;
  linkCapacityKbps: number | null;
  clientsProvisionedLimit: number | null;
  provisionedLanSpeedMbps: number | null;
}

export interface LinkDiagnosisStart {
  started: boolean;
  diagnosis: LinkDiagnosisDTO;
}

export const TOO_MANY_DIAGNOSES =
  'Too many diagnosis sessions running';

// Owns the timers of live diagnosis sessions. One session per device: a
// second start while one runs joins it rather than doubling the probe load.
export interface ILinkDiagnosisRunner {
  startOrJoin(
    target: LinkDiagnosisTarget
  ): Result<LinkDiagnosisStart>;
  // running, or finished within the retention window
  find(deviceId: string): LinkDiagnosisDTO | null;
  // null when nothing is running for the device
  stop(deviceId: string): LinkDiagnosisDTO | null;
}
