import { Result } from 'domain/shared/core';
import { PoeMode, PoeStatus } from 'domain/power-control';

export type PoeSwitchFirmware = 'ROUTEROS' | 'SWOS';

// PWR-012: the switch's saved login. RouterOS reads it over the API port,
// SwOS over HTTP.
export interface PoeSwitchLogin {
  username: string;
  password: string;
  apiPort: number;
  httpPort: number;
}

export interface PoeSwitchConnection {
  host: string;
  firmware: PoeSwitchFirmware;
  login: PoeSwitchLogin;
}

// PWR-022: one PoE-out port, in the same shape for every firmware. Ports that
// cannot give power (PoE-in, SFP) are never listed.
export interface PoePortReading {
  port: string;
  label: string;
  mode: PoeMode;
  status: PoeStatus;
  powerWatts: number | null;
  voltage: number | null;
}

export interface PoeSwitchReading {
  firmwareVersion: string | null;
  ports: PoePortReading[];
}

export interface IPoeSwitchReader {
  read(
    connection: PoeSwitchConnection
  ): Promise<Result<PoeSwitchReading>>;
}
