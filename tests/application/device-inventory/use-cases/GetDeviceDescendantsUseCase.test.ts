// Source: src/application/device-inventory/use-cases/GetDeviceDescendantsUseCase.ts

import { GetDeviceDescendantsUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  ITopologyQuery,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

const ROUTER = '550e8400-e29b-41d4-a716-446655440001';
const AP = '550e8400-e29b-41d4-a716-446655440002';
const CPE = '550e8400-e29b-41d4-a716-446655440003';
const OTHER = '550e8400-e29b-41d4-a716-446655440004';

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

function row(
  id: string,
  upstreamDeviceId: string | null,
  connectivity: TopologyDeviceRow['connectivity'] = 'UP'
): TopologyDeviceRow {
  return {
    id,
    name: id,
    status: 'ACTIVE',
    category: null,
    ipAddress: null,
    locationId: null,
    locationName: null,
    upstreamDeviceId,
    connectivity,
    downSince: null
  };
}

describe('GetDeviceDescendantsUseCase', () => {
  let query: jest.Mocked<ITopologyQuery>;
  let useCase: GetDeviceDescendantsUseCase;

  beforeEach(() => {
    query = {
      findAll: jest
        .fn()
        .mockResolvedValue(
          Result.ok([
            row(ROUTER, null, 'DOWN'),
            row(AP, ROUTER, 'DOWN'),
            row(CPE, AP, 'DOWN'),
            row(OTHER, ROUTER)
          ])
        )
    };
    useCase = new GetDeviceDescendantsUseCase(query, makeLogger());
  });

  it('returns the device and everything below it', async () => {
    const result = await useCase.execute({ deviceId: AP });

    expect(result.value.nodes.map((n) => n.id)).toEqual([AP, CPE]);
    expect(result.value.total).toBe(2);
  });

  it('[DEV-186] judges reachability against the devices above the subtree', async () => {
    const result = await useCase.execute({ deviceId: AP });

    expect(result.value.nodes[0].reachability).toBe('UNREACHABLE');
  });

  it('fails with not found for a device outside the topology', async () => {
    const result = await useCase.execute({
      deviceId: '550e8400-e29b-41d4-a716-446655440099'
    });

    expect(result.error).toContain('not found in the topology');
  });

  it('fails on a malformed id without reading anything', async () => {
    const result = await useCase.execute({ deviceId: 'nope' });

    expect(result.error).toContain('Invalid device ID');
    expect(query.findAll).not.toHaveBeenCalled();
  });

  it('fails when the topology cannot be read', async () => {
    query.findAll.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({ deviceId: AP });

    expect(result.error).toContain('Failed to load topology');
  });
});
