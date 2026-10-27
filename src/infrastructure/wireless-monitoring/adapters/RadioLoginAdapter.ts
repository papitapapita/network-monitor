import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IDeviceCredentialsRepository } from 'application/device-inventory/interfaces';
import {
  IRadioLoginSource,
  RadioLogin
} from 'application/wireless-monitoring/interfaces';

export class RadioLoginAdapter implements IRadioLoginSource {
  constructor(
    private readonly credentials: IDeviceCredentialsRepository
  ) {}

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<RadioLogin | null>> {
    const found = await this.credentials.findByDeviceId(deviceId);
    if (found.isFailure) return Result.fail(found.error!);
    const c = found.value;
    if (!c?.httpUsername || !c.httpPassword) return Result.ok(null);
    return Result.ok({
      username: c.httpUsername,
      password: c.httpPassword,
      httpPort: c.httpPort,
      sshPort: c.sshPort
    });
  }
}
