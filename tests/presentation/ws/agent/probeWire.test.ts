import {
  fromPingReadingWire,
  fromWirelessReadingWire,
  measuredAt
} from '../../../../src/presentation/ws/agent/probeWire';
import { toWirelessReadingWire } from '../../../../src/agent/probes/ProbeRunner';
import { makeWirelessCollectionResult } from '../../../fixtures/wirelessCollection';

describe('probeWire', () => {
  it('[AGT-103] turns a ping answer back into a ping outcome', () => {
    expect(
      fromPingReadingWire({
        reachable: true,
        latencyMs: 4,
        attempts: 2
      })
    ).toEqual({
      kind: 'measured',
      isReachable: true,
      latencyMs: 4,
      attempts: 2
    });
    expect(
      fromPingReadingWire({
        reachable: false,
        latencyMs: 9,
        attempts: 3
      })
    ).toMatchObject({ isReachable: false, latencyMs: null });
    expect(
      fromPingReadingWire({ probeError: 'EPERM', attempts: 3 })
    ).toEqual({
      kind: 'probe-unavailable',
      error: 'EPERM',
      attempts: 3
    });
  });

  it('[AGT-103] gives a radio reading back exactly as the collector produced it', () => {
    const reading = makeWirelessCollectionResult();

    expect(
      fromWirelessReadingWire(
        JSON.parse(JSON.stringify(toWirelessReadingWire(reading)))
      )
    ).toEqual(reading);
  });

  describe('[AGT-104] measuredAt', () => {
    const sentAt = new Date(10_000);
    const receivedAt = new Date(12_000);

    it('keeps the agent time when it falls between asking and the answer', () => {
      expect(measuredAt(11_000, sentAt, receivedAt)).toEqual(
        new Date(11_000)
      );
    });

    it('moves a time from a slow agent clock up to when the request left', () => {
      expect(measuredAt(1_000, sentAt, receivedAt)).toEqual(sentAt);
    });

    it('moves a time from a fast agent clock back to when the answer arrived', () => {
      expect(measuredAt(99_000, sentAt, receivedAt)).toEqual(
        receivedAt
      );
    });
  });
});
