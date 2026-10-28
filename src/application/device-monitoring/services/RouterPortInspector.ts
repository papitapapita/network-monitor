import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RouterPortCounters } from 'domain/device-monitoring/aggregates';
import { PortExpectedSpeed } from 'domain/device-monitoring/entities';
import { PortCounterProps } from 'domain/device-monitoring/props';
import {
  IPortExpectedSpeedRepository,
  IRouterPortCountersRepository
} from 'domain/device-monitoring/repository';
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
    private readonly expectations: IPortExpectedSpeedRepository,
    private readonly counters: IRouterPortCountersRepository
  ) {}

  async inspect(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<Result<RouterPortSpeedsDTO[]>> {
    const [reads, expected, counters] = await Promise.all([
      Promise.all(candidates.map((c) => this.read(c))),
      this.expectedFor(candidates),
      this.countersOf(candidates)
    ]);
    if (expected.isFailure) return Result.fail(expected.error);
    if (counters.isFailure) return Result.fail(counters.error);
    return Result.ok(
      reads.map((r) =>
        toRouterDTO(r, expected.value, counterOf(counters.value, r))
      )
    );
  }

  // MON-198: what the scheduled check last made of each router's ports
  async countersOf(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<Result<RouterPortCounters[]>> {
    if (candidates.length === 0) return Result.ok([]);
    return this.counters.listForDevices(
      candidates.map((c) => DeviceId.parse(c.deviceId).value)
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

export function counterOf(
  counters: RouterPortCounters[],
  read: RouterPortRead
): RouterPortCounters | null {
  return (
    counters.find(
      (c) => c.deviceId.toString() === read.candidate.deviceId
    ) ?? null
  );
}

export function toRouterDTO(
  read: RouterPortRead,
  expected: PortExpectedSpeed[],
  counters: RouterPortCounters | null
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
    toPortDTO(
      p,
      mine.get(p.name) ?? null,
      counters?.port(p.name) ?? null
    )
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
        alertOnNoLink: e.alertOnNoLink,
        verdict: 'PORT_MISSING',
        rxErrors: null,
        linkDowns: null,
        errorsAdded: null,
        linkDownsAdded: null,
        sfp: null,
        issues: []
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
  expected: PortExpectedSpeed | null,
  counter: PortCounterProps | null
): RouterPortDTO {
  return {
    name: port.name,
    comment: port.comment,
    linked: port.linked,
    rateMbps: port.rateMbps,
    fullDuplex: port.fullDuplex,
    expectedMbps: expected?.expected.mbps ?? null,
    alertOnNoLink: expected?.alertOnNoLink ?? false,
    verdict: judgePort(port, expected),
    rxErrors: port.rxErrors,
    linkDowns: port.linkDowns,
    errorsAdded: counter?.errorsAdded ?? null,
    linkDownsAdded: counter?.linkDownsAdded ?? null,
    sfp: port.sfp ? { ...port.sfp } : null,
    issues: counter?.issues ?? []
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
