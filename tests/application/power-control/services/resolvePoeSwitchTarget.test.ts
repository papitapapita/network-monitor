// Source: src/application/power-control/services/resolvePoeSwitchTarget.ts

import {
  PoeSwitchCandidate,
  resolvePoeSwitchTarget
} from '../../../../src/application/power-control';

const LOGIN = {
  username: 'admin',
  password: 'secret',
  apiPort: 8728,
  httpPort: 80
};

function makeCandidate(
  overrides: Partial<PoeSwitchCandidate> = {}
): PoeSwitchCandidate {
  return {
    deviceId: 'hex-1',
    deviceName: 'hEX Torre Norte',
    ipAddress: '10.0.5.2',
    firmware: 'ROUTEROS',
    reach: { by: 'server' },
    login: LOGIN,
    ...overrides
  };
}

describe('resolvePoeSwitchTarget', () => {
  it('[PWR-011] should read a switch with an address and a login', () => {
    expect(resolvePoeSwitchTarget(makeCandidate())).toEqual({
      readable: true,
      connection: {
        host: '10.0.5.2',
        firmware: 'ROUTEROS',
        login: LOGIN
      }
    });
  });

  it('[PWR-011] should not read a switch without an IP', () => {
    expect(
      resolvePoeSwitchTarget(makeCandidate({ ipAddress: null }))
    ).toEqual({
      readable: false,
      reason: 'The switch has no IP address'
    });
  });

  it('[PWR-011] should not read a switch without a login', () => {
    expect(
      resolvePoeSwitchTarget(makeCandidate({ login: null }))
    ).toEqual({
      readable: false,
      reason: 'The switch has no username and password saved'
    });
  });

  it('[PWR-013] should not read a switch only an agent reaches', () => {
    const target = resolvePoeSwitchTarget(
      makeCandidate({ reach: { by: 'agent', agentId: 'agent-1' } })
    );

    expect(target).toMatchObject({ readable: false });
    expect(!target.readable && target.reason).toMatch(
      /^Behind an on-site agent/
    );
  });

  it('[PWR-013] should not read a switch nothing reaches', () => {
    expect(
      resolvePoeSwitchTarget(makeCandidate({ reach: { by: 'none' } }))
    ).toEqual({
      readable: false,
      reason:
        'This server is off site and no agent reaches the switch'
    });
  });
});
