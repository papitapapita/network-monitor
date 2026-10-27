import { Result } from 'domain/shared/core';
import {
  IPoweringSwitchQuery,
  PoweringSwitchesRead
} from 'application/device-inventory/interfaces';
import { PoweredDeviceSurvey } from 'application/power-control/services';

// Lends power control's live PoE read to device inventory's suggestions.
export class PoweringSwitchQueryAdapter
  implements IPoweringSwitchQuery
{
  constructor(private readonly survey: PoweredDeviceSurvey) {}

  async findPoweringSwitches(
    locationId: string | null
  ): Promise<Result<PoweringSwitchesRead>> {
    const result = await this.survey.survey(locationId);
    if (result.isFailure) return Result.fail(result.error);
    return Result.ok({
      links: result.value.links.map((l) => ({
        deviceId: l.deviceId,
        switchDeviceId: l.switchDeviceId,
        port: l.port
      })),
      unreadSwitches: result.value.unreadSwitches
    });
  }
}
