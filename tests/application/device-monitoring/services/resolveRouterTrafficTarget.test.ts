// Source: src/application/device-monitoring/services/resolveRouterTrafficTarget.ts

import { resolveRouterTrafficTarget } from '../../../../src/application/device-monitoring/services/resolveRouterTrafficTarget';
import { RouterTrafficCandidate } from '../../../../src/application/device-monitoring/interfaces';

const makeCandidate = (
  overrides: Partial<RouterTrafficCandidate> = {}
): RouterTrafficCandidate => ({
  deviceId: 'd-1',
  deviceName: 'Core',
  ipAddress: '10.0.0.1',
  vendorSlug: 'mikrotik',
  agentId: 'agent-1',
  login: { username: 'api', password: 'secret', apiPort: 8729 },
  ...overrides
});

describe('resolveRouterTrafficTarget', () => {
  it('[MON-066] reads a MikroTik with its HTTP login on its API port', () => {
    expect(resolveRouterTrafficTarget(makeCandidate())).toEqual({
      readable: true,
      router: {
        host: '10.0.0.1',
        port: 8729,
        username: 'api',
        password: 'secret',
        agentId: 'agent-1'
      }
    });
  });

  it.each([
    [
      { vendorSlug: 'ubiquiti' },
      'Live traffic is read from MikroTik routers only'
    ],
    [
      { vendorSlug: null },
      'Live traffic is read from MikroTik routers only'
    ],
    [{ ipAddress: null }, 'The router has no IP address'],
    [{ login: null }, 'The router has no username and password saved']
  ])(
    '[MON-061] gives the reason a router cannot be read (%o)',
    (overrides, reason) => {
      expect(
        resolveRouterTrafficTarget(makeCandidate(overrides))
      ).toEqual({
        readable: false,
        reason
      });
    }
  );
});
