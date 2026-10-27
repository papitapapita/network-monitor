import { TopologyDeviceRow } from '../interfaces';
import { TopologyNodeDTO, TopologyReachability } from '../dtos';

// Turns the flat rows into map nodes. Walks are guarded against a loop: the
// link rules refuse one (DEV-182), but two concurrent edits could still close
// it, and a read must not hang on that.
export class TopologyTree {
  private readonly byId: Map<string, TopologyDeviceRow>;
  private readonly children = new Map<string, string[]>();

  constructor(rows: TopologyDeviceRow[]) {
    this.byId = new Map(rows.map((r) => [r.id, r]));
    for (const row of rows) {
      if (row.upstreamDeviceId === null) continue;
      if (!this.byId.has(row.upstreamDeviceId)) continue;
      const siblings = this.children.get(row.upstreamDeviceId) ?? [];
      siblings.push(row.id);
      this.children.set(row.upstreamDeviceId, siblings);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  nodes(): TopologyNodeDTO[] {
    return [...this.byId.values()].map((row) => this.toNode(row));
  }

  // The device itself first, then everything below it, breadth-first.
  subtree(rootId: string): TopologyNodeDTO[] {
    const order: string[] = [];
    const seen = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id) || !this.byId.has(id)) continue;
      seen.add(id);
      order.push(id);
      queue.push(...(this.children.get(id) ?? []));
    }
    return order.map((id) => this.toNode(this.byId.get(id)!));
  }

  private toNode(row: TopologyDeviceRow): TopologyNodeDTO {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      category: row.category,
      ipAddress: row.ipAddress,
      locationId: row.locationId,
      locationName: row.locationName,
      upstreamDeviceId: row.upstreamDeviceId,
      reachability: this.reachability(row),
      downSince: row.downSince?.toISOString() ?? null,
      childCount: this.children.get(row.id)?.length ?? 0
    };
  }

  private reachability(row: TopologyDeviceRow): TopologyReachability {
    if (row.connectivity === null) return 'UNKNOWN';
    if (row.connectivity !== 'DOWN') return row.connectivity;
    return this.hasDownAncestor(row) ? 'UNREACHABLE' : 'DOWN';
  }

  // Unmonitored or UNKNOWN devices in between are skipped, not treated as a
  // break: they say nothing about whether the path above them is up.
  private hasDownAncestor(row: TopologyDeviceRow): boolean {
    const seen = new Set<string>([row.id]);
    let next = row.upstreamDeviceId;
    while (next !== null && !seen.has(next)) {
      const ancestor = this.byId.get(next);
      if (!ancestor) return false;
      if (ancestor.connectivity === 'DOWN') return true;
      seen.add(next);
      next = ancestor.upstreamDeviceId;
    }
    return false;
  }
}
