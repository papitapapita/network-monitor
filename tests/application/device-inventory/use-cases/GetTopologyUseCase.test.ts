// Source: src/application/device-inventory/use-cases/GetTopologyUseCase.ts

import { GetTopologyUseCase } from '../../../../src/application/device-inventory/use-cases';
import {
  ITopologyQuery,
  TopologyDeviceRow
} from '../../../../src/application/device-inventory/interfaces';
import { ILogger } from '../../../../src/application/shared/interfaces';
import { Result } from '../../../../src/domain/shared/core';

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

describe('GetTopologyUseCase', () => {
  let query: jest.Mocked<ITopologyQuery>;
  let useCase: GetTopologyUseCase;

  beforeEach(() => {
    query = { findAll: jest.fn() };
    useCase = new GetTopologyUseCase(query, makeLogger());
  });

  it('returns every node with its link and reachability', async () => {
    query.findAll.mockResolvedValue(
      Result.ok([row('ap', null, 'DOWN'), row('cpe', 'ap', 'DOWN')])
    );

    const result = await useCase.execute({});

    expect(result.value.total).toBe(2);
    expect(
      result.value.nodes.map((n) => [
        n.id,
        n.reachability,
        n.childCount
      ])
    ).toEqual([
      ['ap', 'DOWN', 1],
      ['cpe', 'UNREACHABLE', 0]
    ]);
  });

  it('returns an empty map when nothing is on the network', async () => {
    query.findAll.mockResolvedValue(Result.ok([]));

    const result = await useCase.execute({});

    expect(result.value).toEqual({ nodes: [], total: 0 });
  });

  it('fails when the topology cannot be read', async () => {
    query.findAll.mockResolvedValue(Result.fail('db down'));

    const result = await useCase.execute({});

    expect(result.error).toContain('Failed to load topology');
  });
});
