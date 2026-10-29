import { Result } from 'domain/shared/core';
import {
  IRouterNeighborQuery,
  RouterNeighborsRead
} from 'application/device-inventory/interfaces';
import {
  RouterNeighborSurvey,
  RouterNeighborSurveyResult
} from 'application/device-monitoring/services';

// Lends device monitoring's live neighbour read to device inventory.
export class RouterNeighborQueryAdapter
  implements IRouterNeighborQuery
{
  constructor(private readonly survey: RouterNeighborSurvey) {}

  async findRouterNeighbors(): Promise<Result<RouterNeighborsRead>> {
    const result = await this.survey.survey();
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok(toRead(result.value));
  }

  async findRouterNeighborsOf(
    deviceId: string
  ): Promise<Result<RouterNeighborsRead | null>> {
    const result = await this.survey.surveyOne(deviceId);
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok(result.value && toRead(result.value));
  }
}

function toRead(
  result: RouterNeighborSurveyResult
): RouterNeighborsRead {
  return {
    routers: result.routers.map((r) => ({
      routerDeviceId: r.deviceId,
      routerName: r.deviceName,
      ports: r.ports.map((p) => ({ ...p })),
      neighbors: r.neighbors.map((n) => ({ ...n }))
    })),
    unreadRouters: result.unreadRouters.map((u) => ({ ...u }))
  };
}
