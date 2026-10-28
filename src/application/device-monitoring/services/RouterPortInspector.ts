import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { IPortExpectedSpeedRepository } from 'domain/device-monitoring/repository';
import {
  EthernetPortReading,
  IRouterPortReader,
  PortSpeedRouterCandidate,
  RouterPortsReading
} from '../interfaces';
import {
  PortSpeedVerdict,
  RouterPortDTO,
  RouterPortSpeedsDTO
} from '../dtos';
import { resolvePortSpeedTarget } from './resolvePortSpeedTarget';

export type RouterPortRead =
  | { candidate: PortSpeedRouterCandidate; reason: string }
  | { candidate: PortSpeedRouterCandidate; error: string }
  | {
      candidate: PortSpeedRouterCandidate;
      reading: RouterPortsReading;
    };

// MON-140: every router is read live and at once; one that does not answer
// is reported with its error, the others are still shown.
export class RouterPortInspector {
  constructor(
    private readonly reader: IRouterPortReader,
    private readonly expectations: IPortExpectedSpeedRepository
  ) {}

  async inspect(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<Result<RouterPortSpeedsDTO[]>> {
    const [reads, expected] = await Promise.all([
      Promise.all(candidates.map((c) => this.read(c))),
      this.expectedFor(candidates)
    ]);
    if (expected.isFailure) return Result.fail(expected.error);
    return Result.ok(
      reads.map((r) => toRouterDTO(r, expected.value))
    );
  }

  async read(
    candidate: PortSpeedRouterCandidate
  ): Promise<RouterPortRead> {
    const target = resolvePortSpeedTarget(candidate);
    if (!target.readable) return { candidate, reason: target.reason };
    const reading = await this.reader.read(target.connection);
    return reading.isSuccess
      ? { candidate, reading: reading.value }
      : { candidate, error: reading.error };
  }

  private async expectedFor(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<Result<PortExpectedSpeed[]>> {
    if (candidates.length === 0) return Result.ok([]);
    return this.expectations.listForDevices(
      candidates.map((c) => DeviceId.parse(c.deviceId).value)
    );
  }
}

export function toRouterDTO(
  read: RouterPortRead,
  expected: PortExpectedSpeed[]
): RouterPortSpeedsDTO {
  const base: RouterPortSpeedsDTO = {
    deviceId: read.candidate.deviceId,
    name: read.candidate.deviceName,
    identity: null,
    ipAddress: read.candidate.ipAddress,
    readable: false,
    reason: null,
    error: null,
    ports: []
  };
  if ('reason' in read) return { ...base, reason: read.reason };
  if ('error' in read) {
    return { ...base, readable: true, error: read.error };
  }

  const mine = new Map(
    expected
      .filter(
        (e) => e.deviceId.toString() === read.candidate.deviceId
      )
      .map((e) => [e.portName, e])
  );
  const seen = new Set(read.reading.ports.map((p) => p.name));
  const ports = read.reading.ports.map((p) =>
    toPortDTO(p, mine.get(p.name) ?? null)
  );
  // MON-143: an expectation on a port the router no longer has is shown,
  // so a renamed port does not silently stop being checked.
  const missing = [...mine.values()]
    .filter((e) => !seen.has(e.portName))
    .map(
      (e): RouterPortDTO => ({
        name: e.portName,
        comment: null,
        linked: null,
        rateMbps: null,
        fullDuplex: null,
        expectedMbps: e.expected.mbps,
        verdict: 'PORT_MISSING'
      })
    );

  return {
    ...base,
    readable: true,
    identity: read.reading.identity,
    ports: [...ports, ...missing]
  };
}

function toPortDTO(
  port: EthernetPortReading,
  expected: PortExpectedSpeed | null
): RouterPortDTO {
  return {
    name: port.name,
    comment: port.comment,
    linked: port.linked,
    rateMbps: port.rateMbps,
    fullDuplex: port.fullDuplex,
    expectedMbps: expected?.expected.mbps ?? null,
    verdict: judgePort(port, expected)
  };
}

// MON-143
export function judgePort(
  port: EthernetPortReading,
  expected: PortExpectedSpeed | null
): PortSpeedVerdict {
  if (!port.linked) return 'NO_LINK';
  if (!expected) return 'NO_EXPECTATION';
  if (port.rateMbps === null) return 'UNKNOWN';
  return expected.isMetBy({
    rateMbps: port.rateMbps,
    // a router that does not report duplex is not called half duplex
    fullDuplex: port.fullDuplex ?? true
  })
    ? 'OK'
    : 'SLOW';
}
