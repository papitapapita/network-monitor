export const ROUTER_TRAFFIC_CHANNEL = 'router-traffic';

// only the opening frame — every later frame is one router's
// `router-traffic` delta, not a replacement list
export const ROUTER_TRAFFIC_SNAPSHOT_EVENT =
  'router-traffic-snapshot';
export const ROUTER_TRAFFIC_EVENT = 'router-traffic';
