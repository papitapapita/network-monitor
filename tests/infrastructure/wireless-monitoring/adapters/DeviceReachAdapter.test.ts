// Source: src/infrastructure/wireless-monitoring/adapters/DeviceReachAdapter.ts

import { DeviceReachAdapter } from '../../../../src/infrastructure/wireless-monitoring/adapters/DeviceReachAdapter';
import { IDeviceReach } from '../../../../src/application/wireless-monitoring/interfaces/IDeviceReach';
import { IDeviceRepository } from '../../../../src/domain/device-inventory/repository/IDeviceRepository';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { AgentId } from '../../../../src/domain/shared/ids/AgentId';
import { Result } from '../../../../src/domain/shared/core/Result';

describe('[WLS-029] DeviceReachAdapter', () => {
  const deviceId = DeviceId.create();
  const agentId = AgentId.create();
  let findById: jest.Mock;
  let devices: IDeviceRepository;

  beforeEach(() => {
    findById = jest.fn().mockResolvedValue(Result.ok({ agentId }));
    devices = { findById } as unknown as IDeviceRepository;
  });

  it('reaches every device from a server on the monitored network', async () => {
    const reach: IDeviceReach = new DeviceReachAdapter(true, devices);

    expect((await reach.isOutOfReach(deviceId)).value).toBe(false);
  });

  it('reaches no device from a server hosted off site', async () => {
    const reach: IDeviceReach = new DeviceReachAdapter(
      false,
      devices
    );

    expect((await reach.isOutOfReach(deviceId)).value).toBe(true);
  });

  it('reads every radio itself on site, behind an agent or not', async () => {
    const reach = new DeviceReachAdapter(true, devices);

    expect((await reach.readerFor(deviceId)).value).toEqual({
      by: 'server'
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('off site, reads a radio through the agent it sits behind', async () => {
    const reach = new DeviceReachAdapter(false, devices);

    expect((await reach.readerFor(deviceId)).value).toEqual({
      by: 'agent',
      agentId: agentId.toValue()
    });
  });

  it('off site, reads no radio that has no agent', async () => {
    findById.mockResolvedValue(Result.ok({ agentId: null }));
    const reach = new DeviceReachAdapter(false, devices);

    expect((await reach.readerFor(deviceId)).value).toEqual({
      by: 'none'
    });
  });

  it('passes a failed device lookup on', async () => {
    findById.mockResolvedValue(Result.fail('DB down'));
    const reach = new DeviceReachAdapter(false, devices);

    expect((await reach.readerFor(deviceId)).error).toBe('DB down');
  });
});
