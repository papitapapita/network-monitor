// Source: src/domain/device-inventory/value-objects/DiscoverySettings.ts

import { DiscoverySettings } from '../../../../src/domain/device-inventory/value-objects';
import { DiscoverySettingsProps } from '../../../../src/domain/device-inventory/props';

const AGENT = '0b9c6f0e-3f4a-4c55-9a51-6f7d2a1c8e10';

function makeProps(
  overrides: Partial<DiscoverySettingsProps> = {}
): DiscoverySettingsProps {
  return {
    enabled: true,
    intervalHours: 24,
    segments: [{ cidr: '192.168.1.0/24', agentId: null }],
    ...overrides
  };
}

describe('DiscoverySettings', () => {
  describe('[DEV-210] defaults', () => {
    it('is off, daily, with no segments', () => {
      const settings = DiscoverySettings.defaults();

      expect(settings.enabled).toBe(false);
      expect(settings.intervalHours).toBe(24);
      expect(settings.segments).toEqual([]);
    });
  });

  describe('[DEV-210] the interval', () => {
    it.each([1, 24, 168])('accepts %i hours', (hours) => {
      const result = DiscoverySettings.create(
        makeProps({ intervalHours: hours })
      );

      expect(result.isSuccess).toBe(true);
    });

    it.each([0, 169, 1.5])('refuses %p hours', (hours) => {
      const result = DiscoverySettings.create(
        makeProps({ intervalHours: hours })
      );

      expect(result.error).toBe(
        'intervalHours must be a whole number from 1 to 168'
      );
    });
  });

  describe('[DEV-210] a segment', () => {
    it('is stored as its network address', () => {
      const result = DiscoverySettings.create(
        makeProps({
          segments: [{ cidr: ' 192.168.1.77/24 ', agentId: null }]
        })
      );

      expect(result.value.segments).toEqual([
        { cidr: '192.168.1.0/24', agentId: null }
      ]);
    });

    it('may name the agent that sweeps it', () => {
      const result = DiscoverySettings.create(
        makeProps({
          segments: [{ cidr: '10.0.0.0/22', agentId: AGENT }]
        })
      );

      expect(result.value.segments[0].agentId).toBe(AGENT);
    });

    it.each([
      '10.0.0.0/21',
      '10.0.0.0/31',
      '10.0.0.0',
      '300.0.0.0/24'
    ])('refuses %s', (cidr) => {
      const result = DiscoverySettings.create(
        makeProps({ segments: [{ cidr, agentId: null }] })
      );

      expect(result.error).toBe(
        `segment "${cidr}" must be an IPv4 CIDR from /22 to /30`
      );
    });

    it('refuses an agent id that is not one', () => {
      const result = DiscoverySettings.create(
        makeProps({
          segments: [{ cidr: '10.0.0.0/24', agentId: 'agent-1' }]
        })
      );

      expect(result.error).toBe(
        'segment 10.0.0.0/24: agentId must be an agent id'
      );
    });

    it('refuses the same segment twice for the same scanner', () => {
      const result = DiscoverySettings.create(
        makeProps({
          segments: [
            { cidr: '10.0.0.0/24', agentId: null },
            { cidr: '10.0.0.9/24', agentId: null }
          ]
        })
      );

      expect(result.error).toBe(
        'segment 10.0.0.0/24 is listed twice for the same scanner'
      );
    });

    it('allows the same segment from the server and from an agent', () => {
      const result = DiscoverySettings.create(
        makeProps({
          segments: [
            { cidr: '10.0.0.0/24', agentId: null },
            { cidr: '10.0.0.0/24', agentId: AGENT }
          ]
        })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('refuses more than 16 segments', () => {
      const segments = Array.from({ length: 17 }, (_, i) => ({
        cidr: `10.0.${i}.0/24`,
        agentId: null
      }));

      const result = DiscoverySettings.create(
        makeProps({ segments })
      );

      expect(result.error).toBe('segments must be at most 16');
    });
  });

  it('refuses an enabled flag that is not a boolean', () => {
    const result = DiscoverySettings.create(
      makeProps({ enabled: 'yes' as unknown as boolean })
    );

    expect(result.error).toBe('enabled must be true or false');
  });
});
