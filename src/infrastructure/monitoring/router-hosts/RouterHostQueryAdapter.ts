import { Result } from 'domain/shared/core';
import {
  IRouterHostQuery,
  RouterHostsRead
} from 'application/device-inventory/interfaces';
import { RouterHostsReading } from 'application/device-monitoring/interfaces';
import { RouterSurvey } from 'application/device-monitoring/services';

// Lends device monitoring's live host and ARP read to device inventory.
export class RouterHostQueryAdapter implements IRouterHostQuery {
  constructor(
    private readonly survey: RouterSurvey<RouterHostsReading>
  ) {}

  async findRouterHosts(): Promise<Result<RouterHostsRead>> {
    const result = await this.survey.survey();
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok({
      routers: result.value.routers.map(
        ({ deviceId, deviceName, reading }) => ({
          routerDeviceId: deviceId,
          routerName: deviceName,
          ports: reading.ports.map((p) => ({ ...p })),
          bridgeHosts:
            reading.bridgeHosts?.map((h) => ({ ...h })) ?? null,
          arp:
            reading.arp?.map((a) => ({
              ipAddress: a.ipAddress,
              macAddress: a.macAddress
            })) ?? null,
          leases: reading.leases?.map((l) => ({ ...l })) ?? null
        })
      ),
      unreadRouters: result.value.unreadRouters.map((u) => ({ ...u }))
    });
  }
}
