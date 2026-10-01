// Source: src/infrastructure/wireless-monitoring/adapters/DeviceReachAdapter.ts

import { DeviceReachAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/DeviceReachAdapter';
import { IDeviceReach } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceReach';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';

describe('[WLS-029] DeviceReachAdapter', () => {
  const deviceId = DeviceId.create();

  it('reaches every device from a server on the monitored network', async () => {
    const reach: IDeviceReach = new DeviceReachAdapter(true);

    expect((await reach.isOutOfReach(deviceId)).value).toBe(false);
  });

  it('reaches no device from a server hosted off site', async () => {
    const reach: IDeviceReach = new DeviceReachAdapter(false);

    expect((await reach.isOutOfReach(deviceId)).value).toBe(true);
  });
});
