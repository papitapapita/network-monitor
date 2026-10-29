import { Result } from 'domain/shared/core';
import {
  IPortSpeedTargetsQuery,
  IRouterNeighborReader,
  PortSpeedRouterCandidate,
  RouterNeighborReading,
  RouterPortLabel
} from '../interfaces';
import { resolvePortSpeedTarget } from './resolvePortSpeedTarget';

export interface SurveyedRouter {
  deviceId: string;
  deviceName: string;
  ports: RouterPortLabel[];
  neighbors: RouterNeighborReading[];
}

export interface UnreadRouter {
  deviceId: string;
  name: string;
  reason: string;
}

export interface RouterNeighborSurveyResult {
  routers: SurveyedRouter[];
  unreadRouters: UnreadRouter[];
}

// MON-200, MON-201: the neighbour tables of the MikroTiks of MON-140, read
// live and all at once. A router that cannot be read is reported with why;
// only the inventory query failing fails the survey.
export class RouterNeighborSurvey {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly reader: IRouterNeighborReader
  ) {}

  async survey(): Promise<Result<RouterNeighborSurveyResult>> {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);
    return Result.ok(await this.read(candidates.value));
  }

  // null when the device is not one of MON-140's MikroTiks.
  async surveyOne(
    deviceId: string
  ): Promise<Result<RouterNeighborSurveyResult | null>> {
    const candidate = await this.targets.findRouter(deviceId);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (candidate.value === null) return Result.ok(null);
    return Result.ok(await this.read([candidate.value]));
  }

  private async read(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<RouterNeighborSurveyResult> {
    const outcomes = await Promise.all(
      candidates.map(async (candidate) => {
        const unread = (reason: string): UnreadRouter => ({
          deviceId: candidate.deviceId,
          name: candidate.deviceName,
          reason
        });
        const target = resolvePortSpeedTarget(candidate);
        if (!target.readable) return unread(target.reason);
        const reading = await this.reader.read(target.connection);
        if (reading.isFailure) return unread(reading.error);
        return {
          deviceId: candidate.deviceId,
          deviceName: candidate.deviceName,
          ...reading.value
        };
      })
    );
    const result: RouterNeighborSurveyResult = {
      routers: [],
      unreadRouters: []
    };
    for (const outcome of outcomes) {
      if ('reason' in outcome) result.unreadRouters.push(outcome);
      else result.routers.push(outcome);
    }
    return result;
  }
}
