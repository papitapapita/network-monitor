export const ROUTER_TRAFFIC_CHANNEL = 'router-traffic';

// only the opening frame — every later frame is one router's
// `router-traffic` delta, not a replacement list
export const ROUTER_TRAFFIC_SNAPSHOT_EVENT =
  'router-traffic-snapshot';
export const ROUTER_TRAFFIC_EVENT = 'router-traffic';

// One network sweep per stream: the opening count, one frame per device,
// then the totals (MON-080).
export const NETWORK_SWEEP_START_EVENT = 'sweep-start';
export const NETWORK_SWEEP_RESULT_EVENT = 'sweep-result';
export const NETWORK_SWEEP_DONE_EVENT = 'sweep-done';
