import { Result } from 'domain/shared/core';
import { ConnectivityStatus } from '../dtos';

export interface TopologyDeviceRow {
  id: string;
  name: string;
  status: string;
  category: string | null;
  ipAddress: string | null;
  locationId: string | null;
  locationName: string | null;
  upstreamDeviceId: string | null;
  // null: not monitored, so nothing is known either way.
  connectivity: ConnectivityStatus | null;
  downSince: Date | null;
}

/**
 * Read side of the topology map. Reachability belongs to device-monitoring,
 * so — like IDeviceListQuery — this joins the two for display only and never
 * returns a Device aggregate.
 *
 * Returns every live device on the network (ACTIVE or COMMISSIONING) plus any
 * live device another one hangs off, so no link points outside the result.
 */
export interface ITopologyQuery {
  findAll(): Promise<Result<TopologyDeviceRow[]>>;
}
