import { DeviceId } from 'domain/shared/ids';
import { RouterSystemState } from 'domain/device-monitoring/aggregates';
import {
  ROUTER_HEALTH_ISSUES,
  RouterHealthIssue,
  RouterSecurityReadingProps,
  RouterServiceProps,
  RouterSystemReadingProps
} from 'domain/device-monitoring/props';

type PrismaRouterSystemStateRecord = {
  deviceId: string;
  identity: string | null;
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  boardName: string | null;
  routerOsVersion: string | null;
  currentFirmware: string | null;
  upgradeFirmware: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  freeMemoryBytes: bigint | null;
  totalMemoryBytes: bigint | null;
  freeHddBytes: bigint | null;
  totalHddBytes: bigint | null;
  voltage: number | null;
  temperatureC: number | null;
  readAt: Date | null;
  lastError: string | null;
  attemptedAt: Date;
  highCpuChecks: number;
  healthIssues: string[];
  security: unknown;
};

export class RouterSystemStateMapper {
  public static toDomain(
    raw: PrismaRouterSystemStateRecord
  ): RouterSystemState {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure) {
      throw new Error(
        `Data integrity violation: invalid device id in router_system_states row "${raw.deviceId}"`
      );
    }

    return RouterSystemState.reconstitute(deviceId.value, {
      deviceId: deviceId.value,
      reading:
        raw.readAt === null
          ? null
          : {
              identity: raw.identity,
              model: raw.model,
              serialNumber: raw.serialNumber,
              macAddress: raw.macAddress,
              boardName: raw.boardName,
              routerOsVersion: raw.routerOsVersion,
              currentFirmware: raw.currentFirmware,
              upgradeFirmware: raw.upgradeFirmware,
              uptimeSeconds: raw.uptimeSeconds,
              cpuLoadPercent: raw.cpuLoadPercent,
              freeMemoryBytes: toNumber(raw.freeMemoryBytes),
              totalMemoryBytes: toNumber(raw.totalMemoryBytes),
              freeHddBytes: toNumber(raw.freeHddBytes),
              totalHddBytes: toNumber(raw.totalHddBytes),
              voltage: raw.voltage,
              temperatureC: raw.temperatureC,
              security: toSecurity(raw.security)
            },
      readAt: raw.readAt,
      lastError: raw.lastError,
      attemptedAt: raw.attemptedAt,
      highCpuChecks: raw.highCpuChecks,
      healthIssues: raw.healthIssues.filter(isHealthIssue)
    });
  }

  public static toPersistence(
    state: RouterSystemState
  ): PrismaRouterSystemStateRecord {
    const r: RouterSystemReadingProps | null = state.reading;
    return {
      deviceId: state.deviceId.toString(),
      identity: r?.identity ?? null,
      model: r?.model ?? null,
      serialNumber: r?.serialNumber ?? null,
      macAddress: r?.macAddress ?? null,
      boardName: r?.boardName ?? null,
      routerOsVersion: r?.routerOsVersion ?? null,
      currentFirmware: r?.currentFirmware ?? null,
      upgradeFirmware: r?.upgradeFirmware ?? null,
      uptimeSeconds: r?.uptimeSeconds ?? null,
      cpuLoadPercent: r?.cpuLoadPercent ?? null,
      freeMemoryBytes: toBigInt(r?.freeMemoryBytes),
      totalMemoryBytes: toBigInt(r?.totalMemoryBytes),
      freeHddBytes: toBigInt(r?.freeHddBytes),
      totalHddBytes: toBigInt(r?.totalHddBytes),
      voltage: r?.voltage ?? null,
      temperatureC: r?.temperatureC ?? null,
      readAt: state.readAt,
      lastError: state.lastError,
      attemptedAt: state.attemptedAt,
      highCpuChecks: state.highCpuChecks,
      healthIssues: state.healthIssues,
      security: r?.security ?? null
    };
  }
}

function toNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

function toBigInt(value: number | null | undefined): bigint | null {
  return value === null || value === undefined
    ? null
    : BigInt(Math.round(value));
}

function isHealthIssue(value: string): value is RouterHealthIssue {
  return (ROUTER_HEALTH_ISSUES as readonly string[]).includes(value);
}

// A column written by an older or newer app may not match today's shape; a
// part that does not is treated as unread rather than failing the row.
function toSecurity(
  value: unknown
): RouterSecurityReadingProps | null {
  if (!isObject(value)) return null;
  return {
    services: Array.isArray(value.services)
      ? value.services.filter(isService)
      : null,
    userNames: Array.isArray(value.userNames)
      ? value.userNames.filter(
          (n): n is string => typeof n === 'string'
        )
      : null,
    discoveryInterfaceList:
      typeof value.discoveryInterfaceList === 'string'
        ? value.discoveryInterfaceList
        : null
  };
}

function isService(value: unknown): value is RouterServiceProps {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    (value.port === null || typeof value.port === 'number') &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.allowedAddresses) &&
    value.allowedAddresses.every((a) => typeof a === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}
