import { Result } from 'domain/shared/core';
import { PoePortMatchKind } from 'domain/power-control';
import { UnreadPoeSwitchDTO } from '../dtos';
import { IPoeSwitchTargetsQuery } from '../interfaces';
import { SitePoeInspector } from './SitePoeInspector';

export interface PoweredDeviceLink {
  deviceId: string;
  switchDeviceId: string;
  switchName: string;
  port: string;
}

export interface PoweredDeviceSurveyResult {
  links: PoweredDeviceLink[];
  unreadSwitches: UnreadPoeSwitchDTO[];
}

// Which switch port powers each antenna, read live across sites. Only a
// MATCHED port counts (PWR-031..034): one port, at the antenna's own location.
export class PoweredDeviceSurvey {
  constructor(
    private readonly targets: IPoeSwitchTargetsQuery,
    private readonly inspector: SitePoeInspector
  ) {}

  async survey(
    locationId: string | null
  ): Promise<Result<PoweredDeviceSurveyResult>> {
    const sites = locationId
      ? Result.ok([locationId])
      : await this.targets.listSwitchSites();
    if (sites.isFailure) return Result.fail(sites.error);

    const perSite = await Promise.all(
      sites.value.map((site) => this.surveySite(site))
    );
    const links: PoweredDeviceLink[] = [];
    const unreadSwitches: UnreadPoeSwitchDTO[] = [];
    for (const result of perSite) {
      if (result.isFailure) return Result.fail(result.error);
      links.push(...result.value.links);
      unreadSwitches.push(...result.value.unreadSwitches);
    }
    return Result.ok({ links, unreadSwitches });
  }

  private async surveySite(
    locationId: string
  ): Promise<Result<PoweredDeviceSurveyResult>> {
    const candidates =
      await this.targets.listSwitchesAtSite(locationId);
    if (candidates.isFailure) return Result.fail(candidates.error);
    if (candidates.value.length === 0)
      return Result.ok({ links: [], unreadSwitches: [] });

    const switches = await this.inspector.inspect(
      locationId,
      candidates.value
    );
    if (switches.isFailure) return Result.fail(switches.error);

    const links: PoweredDeviceLink[] = [];
    const unreadSwitches: UnreadPoeSwitchDTO[] = [];
    for (const sw of switches.value) {
      if (sw.reason !== null || sw.error !== null) {
        unreadSwitches.push({
          deviceId: sw.deviceId,
          name: sw.name,
          reason: (sw.reason ?? sw.error)!
        });
        continue;
      }
      for (const port of sw.ports) {
        if (
          port.match.kind !== PoePortMatchKind.MATCHED ||
          port.match.deviceId === null
        )
          continue;
        links.push({
          deviceId: port.match.deviceId,
          switchDeviceId: sw.deviceId,
          switchName: sw.name,
          port: port.port
        });
      }
    }
    return Result.ok({ links, unreadSwitches });
  }
}
