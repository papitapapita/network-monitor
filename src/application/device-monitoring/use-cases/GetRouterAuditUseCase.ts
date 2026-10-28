import { Result } from 'domain/shared/core';
import { RouterSystemState } from 'domain/device-monitoring/aggregates';
import {
  ROUTER_AUDIT_PARTS,
  RouterAudit
} from 'domain/device-monitoring/services';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IPortSpeedTargetsQuery,
  PortSpeedRouterCandidate
} from '../interfaces';
import {
  RouterSystemRecorder,
  resolvePortSpeedTarget
} from '../services';
import { RouterAuditDTO, RouterAuditResponseDTO } from '../dtos';

// MON-186: every MikroTik's versions and findings, oldest RouterOS first,
// from the scheduled check's readings; nothing is read live and nothing
// raises an alert.
export class GetRouterAuditUseCase extends UseCase<
  void,
  RouterAuditResponseDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly recorder: RouterSystemRecorder,
    logger: ILogger
  ) {
    super(logger, 'GetRouterAuditUseCase');
  }

  protected async executeImpl(): Promise<
    Result<RouterAuditResponseDTO>
  > {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);

    const states = await this.recorder.statesOf(candidates.value);
    if (states.isFailure) return Result.fail(states.error);

    const routers = candidates.value
      .map((c) =>
        toRouterAuditDTO(c, states.value.get(c.deviceId) ?? null)
      )
      .sort(
        (a, b) =>
          RouterAudit.compareVersions(
            a.routerOsVersion,
            b.routerOsVersion
          ) || a.name.localeCompare(b.name, 'es')
      );
    return this.ok({ routers });
  }
}

function toRouterAuditDTO(
  candidate: PortSpeedRouterCandidate,
  state: RouterSystemState | null
): RouterAuditDTO {
  const target = resolvePortSpeedTarget(candidate);
  const reading = state?.reading ?? null;
  const audit = reading
    ? RouterAudit.of(reading)
    : { findings: [], unchecked: [...ROUTER_AUDIT_PARTS] };
  return {
    deviceId: candidate.deviceId,
    name: candidate.deviceName,
    ipAddress: candidate.ipAddress,
    readable: target.readable,
    reason: target.readable ? null : target.reason,
    readAt: state?.readAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
    routerOsVersion: reading?.routerOsVersion ?? null,
    currentFirmware: reading?.currentFirmware ?? null,
    upgradeFirmware: reading?.upgradeFirmware ?? null,
    findings: audit.findings,
    unchecked: audit.unchecked
  };
}
