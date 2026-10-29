import { Result } from 'domain/shared/core';
import {
  IPortSpeedTargetsQuery,
  PortSpeedRouterCandidate,
  RouterPortConnection
} from '../interfaces';
import { resolvePortSpeedTarget } from './resolvePortSpeedTarget';

export interface RouterReader<T> {
  read(connection: RouterPortConnection): Promise<Result<T>>;
}

export interface SurveyedRouter<T> {
  deviceId: string;
  deviceName: string;
  reading: T;
}

export interface UnreadRouter {
  deviceId: string;
  name: string;
  reason: string;
}

export interface RouterSurveyResult<T> {
  routers: SurveyedRouter<T>[];
  unreadRouters: UnreadRouter[];
}

// MON-201: one live read of the MikroTiks of MON-140, all at once — their
// neighbour tables (MON-200), their host and ARP tables (MON-202). A router
// that cannot be read is reported with why; only the inventory query
// failing fails the survey.
export class RouterSurvey<T> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly reader: RouterReader<T>
  ) {}

  async survey(): Promise<Result<RouterSurveyResult<T>>> {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);
    return Result.ok(await this.read(candidates.value));
  }

  // null when the device is not one of MON-140's MikroTiks.
  async surveyOne(
    deviceId: string
  ): Promise<Result<RouterSurveyResult<T> | null>> {
    const candidate = await this.targets.findRouter(deviceId);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (candidate.value === null) return Result.ok(null);
    return Result.ok(await this.read([candidate.value]));
  }

  private async read(
    candidates: PortSpeedRouterCandidate[]
  ): Promise<RouterSurveyResult<T>> {
    const outcomes = await Promise.all(
      candidates.map(
        async (
          candidate
        ): Promise<SurveyedRouter<T> | UnreadRouter> => {
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
            reading: reading.value
          };
        }
      )
    );
    const result: RouterSurveyResult<T> = {
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
