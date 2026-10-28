import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  RouterHealthChange,
  RouterSystemState
} from 'domain/device-monitoring/aggregates';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';
import { IRouterSystemStateRepository } from 'domain/device-monitoring/repository';
import {
  IRouterSystemReader,
  PortSpeedRouterCandidate
} from '../interfaces';
import { RouterSystemDTO } from '../dtos';
import { resolvePortSpeedTarget } from './resolvePortSpeedTarget';

export interface RecordedRouter {
  candidate: PortSpeedRouterCandidate;
  // null: the router cannot be read, `reason` says why
  state: RouterSystemState | null;
  reason: string | null;
  // MON-170: when the router restarted, if this read found it had
  rebootedAt: Date | null;
  // MON-173: null when health was not judged
  health: RouterHealthChange | null;
}

// MON-161: reads every readable router at once and keeps what each said; a
// router that does not answer keeps its last good reading beside the error.
// Every read looks for a reboot (MON-170); health is judged only when
// thresholds are given, by the scheduled check (MON-173).
export class RouterSystemRecorder {
  constructor(
    private readonly reader: IRouterSystemReader,
    private readonly states: IRouterSystemStateRepository
  ) {}

  async record(
    candidates: PortSpeedRouterCandidate[],
    now: Date,
    healthThresholds: RouterHealthThresholds | null = null
  ): Promise<Result<RecordedRouter[]>> {
    const known = await this.statesOf(candidates);
    if (known.isFailure) return Result.fail(known.error);

    const recorded = await Promise.all(
      candidates.map(async (candidate): Promise<RecordedRouter> => {
        const target = resolvePortSpeedTarget(candidate);
        const state = known.value.get(candidate.deviceId) ?? null;
        if (!target.readable) {
          return {
            candidate,
            state,
            reason: target.reason,
            rebootedAt: null,
            health: null
          };
        }
        const next =
          state ??
          RouterSystemState.createInitial(
            DeviceId.parse(candidate.deviceId).value,
            now
          );
        const reading = await this.reader.read(target.connection);
        let rebootedAt: Date | null = null;
        if (reading.isSuccess) {
          rebootedAt = next.recordReading(
            reading.value,
            now
          ).rebootedAt;
        } else next.recordFailure(reading.error, now);
        const health = healthThresholds
          ? next.recordHealthCheck(healthThresholds)
          : null;
        return {
          candidate,
          state: next,
          reason: null,
          rebootedAt,
          health
        };
      })
    );

    const saved = await this.states.saveAll(
      recorded
        .filter((r) => r.reason === null && r.state !== null)
        .map((r) => r.state!)
    );
    if (saved.isFailure) return Result.fail(saved.error);
    return Result.ok(recorded);
  }

  async statesOf(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<Result<Map<string, RouterSystemState>>> {
    if (candidates.length === 0) return Result.ok(new Map());
    const states = await this.states.listForDevices(
      candidates.map((c) => DeviceId.parse(c.deviceId).value)
    );
    if (states.isFailure) return Result.fail(states.error);
    return Result.ok(
      new Map(states.value.map((s) => [s.deviceId.toString(), s]))
    );
  }
}

export function toRouterSystemDTO(
  candidate: PortSpeedRouterCandidate,
  state: RouterSystemState | null
): RouterSystemDTO {
  const target = resolvePortSpeedTarget(candidate);
  return {
    deviceId: candidate.deviceId,
    name: candidate.deviceName,
    ipAddress: candidate.ipAddress,
    readable: target.readable,
    reason: target.readable ? null : target.reason,
    system: state?.reading ? { ...state.reading } : null,
    readAt: state?.readAt?.toISOString() ?? null,
    attemptedAt: state?.attemptedAt.toISOString() ?? null,
    lastError: state?.lastError ?? null,
    bootedAt: state?.bootedAt?.toISOString() ?? null,
    healthIssues: state?.healthIssues ?? []
  };
}
