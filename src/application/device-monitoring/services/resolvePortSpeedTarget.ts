import {
  PortSpeedRouterCandidate,
  RouterPortConnection
} from '../interfaces';

export type PortSpeedTarget =
  | { readable: true; connection: RouterPortConnection }
  | { readable: false; reason: string };

// MON-145: only a router with an address and a saved login that this server
// reaches itself is read; any other is still listed, with the reason.
export function resolvePortSpeedTarget(
  candidate: PortSpeedRouterCandidate
): PortSpeedTarget {
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
  if (candidate.reach.by === 'agent') {
    return {
      readable: false,
      reason:
        'Behind an on-site agent: reading ports through an agent is not supported yet'
    };
  }
  if (candidate.reach.by === 'none') {
    return {
      readable: false,
      reason:
        'This server is off site and no agent reaches the router'
    };
  }
  return {
    readable: true,
    connection: { host: candidate.ipAddress, login: candidate.login }
  };
}
