import { Result } from 'domain/shared/core';
import {
  LabelledPoePort,
  PoePortMatch,
  PoePortMatcher,
  PoePortMatchKind
} from 'domain/power-control';
import { PoePortDTO, PoeSwitchDTO } from '../dtos';
import {
  IPoeSwitchReader,
  IPoeSwitchTargetsQuery,
  PoePortReading,
  PoeSwitchCandidate,
  PoeSwitchReading
} from '../interfaces';
import { resolvePoeSwitchTarget } from './resolvePoeSwitchTarget';

type SwitchRead =
  | { candidate: PoeSwitchCandidate; reason: string }
  | { candidate: PoeSwitchCandidate; error: string }
  | { candidate: PoeSwitchCandidate; reading: PoeSwitchReading };

// PWR-014: every switch at the site is read live and at once; one that does
// not answer is reported with its error, the others are still shown.
export class SitePoeInspector {
  constructor(
    private readonly targets: IPoeSwitchTargetsQuery,
    private readonly reader: IPoeSwitchReader
  ) {}

  async inspect(
    siteLocationId: string,
    candidates: PoeSwitchCandidate[]
  ): Promise<Result<PoeSwitchDTO[]>> {
    const reads = await Promise.all(
      candidates.map((c) => this.readOne(c))
    );

    const ports: LabelledPoePort[] = reads.flatMap((r) =>
      'reading' in r
        ? r.reading.ports.map((p) => ({
            switchDeviceId: r.candidate.deviceId,
            switchIp: r.candidate.ipAddress,
            port: p.port,
            label: p.label
          }))
        : []
    );
    const ips = [
      ...new Set(
        ports
          .map((p) => PoePortMatcher.antennaIpOf(p))
          .filter((ip): ip is string => ip !== null)
      )
    ];
    const inventory =
      ips.length === 0
        ? Result.ok([])
        : await this.targets.findDevicesByIps(ips);
    if (inventory.isFailure) return Result.fail(inventory.error);

    const matches = PoePortMatcher.match(
      ports,
      siteLocationId,
      inventory.value
    );

    let next = 0;
    return Result.ok(
      reads.map((r) => {
        if (!('reading' in r)) return toUnreadDTO(r);
        const switchMatches = matches.slice(
          next,
          next + r.reading.ports.length
        );
        next += r.reading.ports.length;
        return {
          ...baseDTO(r.candidate),
          readable: true,
          firmwareVersion: r.reading.firmwareVersion,
          ports: r.reading.ports.map((p, i) =>
            toPortDTO(p, switchMatches[i]!)
          )
        };
      })
    );
  }

  private async readOne(
    candidate: PoeSwitchCandidate
  ): Promise<SwitchRead> {
    const target = resolvePoeSwitchTarget(candidate);
    if (!target.readable) return { candidate, reason: target.reason };
    const reading = await this.reader.read(target.connection);
    return reading.isSuccess
      ? { candidate, reading: reading.value }
      : { candidate, error: reading.error };
  }
}

function baseDTO(candidate: PoeSwitchCandidate): PoeSwitchDTO {
  return {
    deviceId: candidate.deviceId,
    name: candidate.deviceName,
    ipAddress: candidate.ipAddress,
    firmware: candidate.firmware,
    firmwareVersion: null,
    readable: false,
    reason: null,
    error: null,
    ports: []
  };
}

function toUnreadDTO(
  read: Exclude<SwitchRead, { reading: PoeSwitchReading }>
): PoeSwitchDTO {
  return 'reason' in read
    ? { ...baseDTO(read.candidate), reason: read.reason }
    : {
        ...baseDTO(read.candidate),
        readable: true,
        error: read.error
      };
}

function toPortDTO(
  port: PoePortReading,
  match: PoePortMatch
): PoePortDTO {
  const device =
    match.kind === PoePortMatchKind.MATCHED ||
    match.kind === PoePortMatchKind.MATCHED_OTHER_LOCATION
      ? match.device
      : null;
  return {
    port: port.port,
    label: port.label,
    mode: port.mode,
    status: port.status,
    powerWatts: port.powerWatts,
    voltage: port.voltage,
    match: {
      kind: match.kind,
      ip: match.ip,
      deviceId: device?.deviceId ?? null,
      deviceName: device?.deviceName ?? null,
      deviceLocationName: device?.locationName ?? null
    }
  };
}
