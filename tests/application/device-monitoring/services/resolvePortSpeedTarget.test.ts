// Source: src/application/device-monitoring/services/resolvePortSpeedTarget.ts

import { resolvePortSpeedTarget } from '../../../../src/application/device-monitoring/services/resolvePortSpeedTarget';
import { PortSpeedRouterCandidate } from '../../../../src/application/device-monitoring/interfaces';

const LOGIN = {
  username: 'admin',
  password: 'secret',
  apiPort: 8728
};

function makeCandidate(
  overrides: Partial<PortSpeedRouterCandidate> = {}
): PortSpeedRouterCandidate {
  return {
    deviceId: '6f1c2b1e-3c1a-4d8a-9a3e-1b2c3d4e5f60',
    deviceName: 'RB4011 Core',
    ipAddress: '10.0.0.1',
    reach: { by: 'server' },
    login: LOGIN,
    ...overrides
  };
}

describe('resolvePortSpeedTarget', () => {
  it('[MON-145] should read a router this server reaches with a saved login', () => {
    expect(resolvePortSpeedTarget(makeCandidate())).toEqual({
      readable: true,
      connection: { host: '10.0.0.1', login: LOGIN }
    });
  });

  it('[MON-145] should not read a router without an IP address', () => {
    expect(
      resolvePortSpeedTarget(makeCandidate({ ipAddress: null }))
    ).toEqual({
      readable: false,
      reason: 'The router has no IP address'
    });
  });

  it('[MON-145] should not read a router without a saved login', () => {
    expect(
      resolvePortSpeedTarget(makeCandidate({ login: null }))
    ).toEqual({
      readable: false,
      reason: 'The router has no username and password saved'
    });
  });

  it('[MON-145] should not read a router behind an agent yet', () => {
    const target = resolvePortSpeedTarget(
      makeCandidate({ reach: { by: 'agent', agentId: 'a1' } })
    );

    expect(target.readable).toBe(false);
    expect(target).toHaveProperty(
      'reason',
      expect.stringMatching(/through an agent is not supported yet/)
    );
  });

  it('[MON-145] should not read a router an off-site server cannot reach', () => {
    const target = resolvePortSpeedTarget(
      makeCandidate({ reach: { by: 'none' } })
    );

    expect(target).toEqual({
      readable: false,
      reason:
        'This server is off site and no agent reaches the router'
    });
  });
});
