// Source: src/application/device-inventory/services/TopologyTree.ts

import { TopologyTree } from '../../../../src/application/device-inventory/services';
import { TopologyDeviceRow } from '../../../../src/application/device-inventory/interfaces';

function row(
  id: string,
  upstreamDeviceId: string | null,
  connectivity: TopologyDeviceRow['connectivity'] = 'UP'
): TopologyDeviceRow {
  return {
    id,
    name: id.toUpperCase(),
    status: 'ACTIVE',
    category: null,
    ipAddress: null,
    locationId: null,
    locationName: null,
    upstreamDeviceId,
    connectivity,
    downSince:
      connectivity === 'DOWN'
        ? new Date('2026-10-26T14:05:00Z')
        : null
  };
}

function byId(tree: TopologyTree) {
  return new Map(tree.nodes().map((n) => [n.id, n]));
}

describe('TopologyTree', () => {
  it('counts the devices directly below each node', () => {
    const nodes = byId(
      new TopologyTree([
        row('router', null),
        row('ap', 'router'),
        row('cpe1', 'ap'),
        row('cpe2', 'ap')
      ])
    );

    expect(nodes.get('router')?.childCount).toBe(1);
    expect(nodes.get('ap')?.childCount).toBe(2);
    expect(nodes.get('cpe1')?.childCount).toBe(0);
  });

  it('reports a device that is down with everything above it up as DOWN', () => {
    const nodes = byId(
      new TopologyTree([row('ap', null), row('cpe', 'ap', 'DOWN')])
    );

    expect(nodes.get('cpe')?.reachability).toBe('DOWN');
    expect(nodes.get('cpe')?.downSince).toBe(
      '2026-10-26T14:05:00.000Z'
    );
  });

  it('[DEV-186] reports a down device below a down device as UNREACHABLE', () => {
    const nodes = byId(
      new TopologyTree([
        row('switch', null, 'DOWN'),
        row('ap', 'switch', 'DOWN'),
        row('cpe', 'ap', 'DOWN')
      ])
    );

    expect(nodes.get('switch')?.reachability).toBe('DOWN');
    expect(nodes.get('ap')?.reachability).toBe('UNREACHABLE');
    expect(nodes.get('cpe')?.reachability).toBe('UNREACHABLE');
  });

  it('[DEV-186] looks past an unmonitored device in between', () => {
    const nodes = byId(
      new TopologyTree([
        row('switch', null, 'DOWN'),
        row('ap', 'switch', null),
        row('cpe', 'ap', 'DOWN')
      ])
    );

    expect(nodes.get('ap')?.reachability).toBe('UNKNOWN');
    expect(nodes.get('cpe')?.reachability).toBe('UNREACHABLE');
  });

  it('keeps an UP device UP below a down one', () => {
    const nodes = byId(
      new TopologyTree([row('ap', null, 'DOWN'), row('cpe', 'ap')])
    );

    expect(nodes.get('cpe')?.reachability).toBe('UP');
  });

  it('treats a link to a device outside the result as a root', () => {
    const nodes = byId(
      new TopologyTree([row('cpe', 'gone', 'DOWN')])
    );

    expect(nodes.get('cpe')?.reachability).toBe('DOWN');
  });

  it('terminates on a loop instead of hanging', () => {
    const nodes = byId(
      new TopologyTree([row('a', 'b', 'DOWN'), row('b', 'a', 'UP')])
    );

    expect(nodes.get('a')?.reachability).toBe('DOWN');
  });

  describe('subtree()', () => {
    const tree = new TopologyTree([
      row('router', null),
      row('ap', 'router'),
      row('cpe1', 'ap'),
      row('cpe2', 'ap'),
      row('other', 'router')
    ]);

    it('lists the device first, then everything below it', () => {
      expect(tree.subtree('ap').map((n) => n.id)).toEqual([
        'ap',
        'cpe1',
        'cpe2'
      ]);
    });

    it('returns just the device when nothing hangs off it', () => {
      expect(tree.subtree('cpe1').map((n) => n.id)).toEqual(['cpe1']);
    });
  });
});
