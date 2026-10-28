import { DeviceId } from 'domain/shared/ids';
import { RouterPortCounters } from 'domain/device-monitoring/aggregates';
import {
  PORT_ISSUES,
  PortCounterProps,
  PortIssue
} from 'domain/device-monitoring/props';

export type PrismaPortCounterRecord = {
  deviceId: string;
  portName: string;
  rxErrors: bigint | null;
  linkDowns: bigint | null;
  readAt: Date;
  errorsAdded: bigint | null;
  linkDownsAdded: bigint | null;
  errorChecks: number;
  quietChecks: number;
  issues: string[];
};

// One aggregate per router, one row per port.
export class RouterPortCountersMapper {
  // rows of one router
  public static toDomain(
    deviceIdRaw: string,
    rows: PrismaPortCounterRecord[]
  ): RouterPortCounters {
    const deviceId = DeviceId.parse(deviceIdRaw);
    if (deviceId.isFailure) {
      throw new Error(
        `Data integrity violation: invalid device id in port_counters row "${deviceIdRaw}"`
      );
    }
    return RouterPortCounters.reconstitute(deviceId.value, {
      deviceId: deviceId.value,
      ports: rows.map(
        (row): PortCounterProps => ({
          portName: row.portName,
          rxErrors: toNumber(row.rxErrors),
          linkDowns: toNumber(row.linkDowns),
          readAt: row.readAt,
          errorsAdded: toNumber(row.errorsAdded),
          linkDownsAdded: toNumber(row.linkDownsAdded),
          errorChecks: row.errorChecks,
          quietChecks: row.quietChecks,
          // an issue name this code does not know is dropped
          issues: row.issues.filter((i): i is PortIssue =>
            (PORT_ISSUES as readonly string[]).includes(i)
          )
        })
      )
    });
  }

  public static toPersistence(
    counters: RouterPortCounters
  ): PrismaPortCounterRecord[] {
    const deviceId = counters.deviceId.toString();
    return counters.ports.map((port) => ({
      deviceId,
      portName: port.portName,
      rxErrors: toBigInt(port.rxErrors),
      linkDowns: toBigInt(port.linkDowns),
      readAt: port.readAt,
      errorsAdded: toBigInt(port.errorsAdded),
      linkDownsAdded: toBigInt(port.linkDownsAdded),
      errorChecks: port.errorChecks,
      quietChecks: port.quietChecks,
      issues: [...port.issues]
    }));
  }
}

function toNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

function toBigInt(value: number | null): bigint | null {
  return value === null ? null : BigInt(value);
}
