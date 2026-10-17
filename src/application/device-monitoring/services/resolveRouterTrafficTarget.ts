import {
  RouterConnectionTarget,
  RouterTrafficCandidate
} from '../interfaces';

export type RouterTrafficTarget =
  | { readable: true; router: RouterConnectionTarget }
  | { readable: false; reason: string };

// MON-061, MON-066: only a MikroTik with an address and a saved login can be
// read; any other main router is still listed, with the reason it is not.
export function resolveRouterTrafficTarget(
  candidate: RouterTrafficCandidate
): RouterTrafficTarget {
  if (candidate.vendorSlug !== 'mikrotik') {
    return {
      readable: false,
      reason: 'Live traffic is read from MikroTik routers only'
    };
  }
  if (!candidate.ipAddress) {
    return {
      readable: false,
      reason: 'The router has no IP address'
    };
  }
  if (!candidate.login) {
    return {
      readable: false,
      reason: 'The router has no username and password saved'
    };
  }
  return {
    readable: true,
    router: {
      host: candidate.ipAddress,
      port: candidate.login.apiPort,
      username: candidate.login.username,
      password: candidate.login.password,
      agentId: candidate.agentId
    }
  };
}
