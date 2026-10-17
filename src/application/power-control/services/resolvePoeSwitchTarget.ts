import {
  PoeSwitchCandidate,
  PoeSwitchConnection
} from '../interfaces';

export type PoeSwitchTarget =
  | { readable: true; connection: PoeSwitchConnection }
  | { readable: false; reason: string };

// PWR-011..013: only a switch with an address and a saved login that this
// server reaches itself is read; any other is still listed, with the reason.
export function resolvePoeSwitchTarget(
  candidate: PoeSwitchCandidate
): PoeSwitchTarget {
  if (!candidate.ipAddress) {
    return {
      readable: false,
      reason: 'The switch has no IP address'
    };
  }
  if (!candidate.login) {
    return {
      readable: false,
      reason: 'The switch has no username and password saved'
    };
  }
  if (candidate.reach.by === 'agent') {
    return {
      readable: false,
      reason:
        'Behind an on-site agent: reading PoE ports through an agent is not supported yet'
    };
  }
  if (candidate.reach.by === 'none') {
    return {
      readable: false,
      reason:
        'This server is off site and no agent reaches the switch'
    };
  }
  return {
    readable: true,
    connection: {
      host: candidate.ipAddress,
      firmware: candidate.firmware,
      login: candidate.login
    }
  };
}
