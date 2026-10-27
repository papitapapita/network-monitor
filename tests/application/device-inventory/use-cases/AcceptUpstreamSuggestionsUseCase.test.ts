// Source: src/application/device-inventory/use-cases/AcceptUpstreamSuggestionsUseCase.ts

import { AcceptUpstreamSuggestionsUseCase } from '../../../../src/application/device-inventory/use-cases';
import { ILogger } from '../../../../src/application/shared/interfaces';
import {
  Device,
  DeviceName,
  DeviceStatus,
  IDeviceRepository,
  SerialNumber
} from '../../../../src/domain/device-inventory';
import {
  DeviceId,
  DeviceModelId,
  IPAddress,
  LocationId,
  Result
} from '../../../../src/domain/shared';

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makeDevice(
  name: string,
  status: DeviceStatus = DeviceStatus.createActive()
): Device {
  return Device.create({
    deviceModelId: DeviceModelId.create(),
    name: DeviceName.create(name).value,
    status,
    ownerType: null,
    category: null,
    locationId: LocationId.create(),
    serialNumber: SerialNumber.create(`SN-${name}`).value,
    macAddress: null,
    ipAddress: status.isActive()
      ? IPAddress.create('10.0.0.1').value
      : null,
    description: null,
    installedDate: null,
    monitoringEnabled: false
  }).value;
}

const GHOST = '550e8400-e29b-41d4-a716-446655440099';

describe('AcceptUpstreamSuggestionsUseCase', () => {
  let devices: Device[];
  let repo: jest.Mocked<
    Pick<IDeviceRepository, 'findById' | 'findUpstreamChain' | 'save'>
  >;
  let useCase: AcceptUpstreamSuggestionsUseCase;

  beforeEach(() => {
    devices = [];
    repo = {
      findById: jest.fn(async (id: DeviceId) =>
        Result.ok(devices.find((d) => d.id.equals(id)) ?? null)
      ),
      findUpstreamChain: jest.fn().mockResolvedValue(Result.ok([])),
      save: jest.fn(async (d: Device) => Result.ok(d))
    };
    useCase = new AcceptUpstreamSuggestionsUseCase(
      repo as unknown as IDeviceRepository,
      makeLogger()
    );
  });

  it('[DEV-194] links each chosen device and saves it', async () => {
    const ap = makeDevice('AP');
    const sta = makeDevice('STA');
    devices.push(ap, sta);

    const result = await useCase.execute({
      links: [
        {
          deviceId: sta.id.toString(),
          upstreamDeviceId: ap.id.toString()
        }
      ]
    });

    expect(result.value).toEqual({
      results: [
        {
          deviceId: sta.id.toString(),
          upstreamDeviceId: ap.id.toString(),
          outcome: 'LINKED',
          error: null
        }
      ],
      linked: 1,
      failed: 0
    });
    expect(sta.upstreamDeviceId?.equals(ap.id)).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(sta);
  });

  it('[DEV-194] reports a link that is already in place as UNCHANGED', async () => {
    const ap = makeDevice('AP');
    const sta = makeDevice('STA');
    sta.setUpstream(ap.id);
    devices.push(ap, sta);

    const result = await useCase.execute({
      links: [
        {
          deviceId: sta.id.toString(),
          upstreamDeviceId: ap.id.toString()
        }
      ]
    });

    expect(result.value.results[0].outcome).toBe('UNCHANGED');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('[DEV-194] a refused link does not stop the others', async () => {
    const ap = makeDevice('AP');
    const shelf = makeDevice('Shelf', DeviceStatus.createInventory());
    const sta1 = makeDevice('STA1');
    const sta2 = makeDevice('STA2');
    devices.push(ap, shelf, sta1, sta2);

    const result = await useCase.execute({
      links: [
        {
          deviceId: sta1.id.toString(),
          upstreamDeviceId: shelf.id.toString()
        },
        { deviceId: GHOST, upstreamDeviceId: ap.id.toString() },
        {
          deviceId: sta2.id.toString(),
          upstreamDeviceId: ap.id.toString()
        }
      ]
    });

    expect(result.value.results.map((r) => r.outcome)).toEqual([
      'FAILED',
      'FAILED',
      'LINKED'
    ]);
    expect(result.value.results[0].error).toContain(
      'must be ACTIVE or COMMISSIONING'
    );
    expect(result.value.results[1].error).toContain(
      'Device not found'
    );
    expect(result.value).toMatchObject({ linked: 1, failed: 2 });
  });

  it('[DEV-194] reports a save that fails', async () => {
    const ap = makeDevice('AP');
    const sta = makeDevice('STA');
    devices.push(ap, sta);
    repo.save.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({
      links: [
        {
          deviceId: sta.id.toString(),
          upstreamDeviceId: ap.id.toString()
        }
      ]
    });

    expect(result.value.results[0]).toMatchObject({
      outcome: 'FAILED',
      error: 'Failed to persist device: db down'
    });
  });

  it('refuses an empty request', async () => {
    const result = await useCase.execute({ links: [] });

    expect(result.error).toBe('At least one link is required');
  });

  it('refuses the same device twice in one request', async () => {
    const result = await useCase.execute({
      links: [
        { deviceId: GHOST, upstreamDeviceId: GHOST },
        { deviceId: GHOST, upstreamDeviceId: GHOST }
      ]
    });

    expect(result.error).toBe(
      'Each device can appear only once in a request'
    );
  });

  it('refuses more than 500 links', async () => {
    const links = Array.from({ length: 501 }, (_, i) => ({
      deviceId: `id-${i}`,
      upstreamDeviceId: GHOST
    }));

    const result = await useCase.execute({ links });

    expect(result.error).toContain('At most 500');
  });
});
