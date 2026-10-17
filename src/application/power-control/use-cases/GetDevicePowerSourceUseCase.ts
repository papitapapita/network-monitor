import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { PoePortMatchKind } from 'domain/power-control';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DevicePowerSourceResponseDTO,
  GetDevicePowerSourceRequestDTO,
  PowerSourcePortDTO,
  UnreadPoeSwitchDTO
} from '../dtos';
import { IPoeSwitchTargetsQuery } from '../interfaces';
import { SitePoeInspector } from '../services';

export class GetDevicePowerSourceUseCase extends UseCase<
  GetDevicePowerSourceRequestDTO,
  DevicePowerSourceResponseDTO
> {
  constructor(
    private readonly targets: IPoeSwitchTargetsQuery,
    private readonly inspector: SitePoeInspector,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePowerSourceUseCase');
  }

  // PWR-040, PWR-041: the antenna is looked for on the PoE switches at its
  // own location, by its IP in their port labels.
  protected async executeImpl(
    request: GetDevicePowerSourceRequestDTO
  ): Promise<Result<DevicePowerSourceResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure)
      return this.fail(`Invalid device ID: ${deviceId.error}`);

    const found = await this.targets.findDevice(
      deviceId.value.toString()
    );
    if (found.isFailure) return Result.fail(found.error);
    if (!found.value) return this.fail('Device not found');
    const device = found.value;

    const none = (reason: string): DevicePowerSourceResponseDTO => ({
      deviceId: device.deviceId,
      kind: 'NONE',
      reason,
      sources: [],
      unreadSwitches: []
    });
    if (!device.ipAddress)
      return this.ok(none('The device has no IP address'));
    if (!device.locationId)
      return this.ok(
        none('The device has no location, so no switch is looked at')
      );

    const candidates = await this.targets.listSwitchesAtSite(
      device.locationId
    );
    if (candidates.isFailure) return Result.fail(candidates.error);

    const switches = await this.inspector.inspect(
      device.locationId,
      candidates.value
    );
    if (switches.isFailure) return Result.fail(switches.error);

    const sources: PowerSourcePortDTO[] = [];
    const unreadSwitches: UnreadPoeSwitchDTO[] = [];
    let duplicate = false;
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
        if (port.match.ip !== device.ipAddress) continue;
        if (port.match.kind === PoePortMatchKind.DUPLICATE)
          duplicate = true;
        sources.push({
          switchDeviceId: sw.deviceId,
          switchName: sw.name,
          port: port.port,
          mode: port.mode,
          status: port.status,
          powerWatts: port.powerWatts
        });
      }
    }

    if (sources.length === 0) {
      return this.ok({
        deviceId: device.deviceId,
        kind: unreadSwitches.length > 0 ? 'UNKNOWN' : 'NONE',
        reason:
          unreadSwitches.length > 0
            ? 'No port found, but a switch at the site could not be read'
            : candidates.value.length === 0
              ? 'There is no PoE switch at the device location'
              : 'No PoE port at the device location is labelled with its IP',
        sources,
        unreadSwitches
      });
    }
    return this.ok({
      deviceId: device.deviceId,
      kind: duplicate || sources.length > 1 ? 'DUPLICATE' : 'FOUND',
      reason:
        duplicate || sources.length > 1
          ? 'More than one port is labelled with the device IP'
          : null,
      sources,
      unreadSwitches
    });
  }
}
