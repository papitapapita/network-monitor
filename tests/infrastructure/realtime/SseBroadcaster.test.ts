// Source: src/infrastructure/realtime/SseBroadcaster.ts

import { SseBroadcaster } from '../../../src/infrastructure/realtime/SseBroadcaster';
import { IEventStreamClient } from '../../../src/application/shared/interfaces/IEventStreamHub';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  const child: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  child.child.mockReturnValue(child);
  return child;
}

type FakeClient = jest.Mocked<IEventStreamClient>;

function makeClient(): FakeClient {
  return { write: jest.fn(), end: jest.fn() };
}

// ---------------------------------------------------------------------------

describe('[WLS-146] SseBroadcaster', () => {
  let logger: jest.Mocked<ILogger>;
  let hub: SseBroadcaster;

  beforeEach(() => {
    logger = makeLogger();
    hub = new SseBroadcaster(logger);
  });

  afterEach(() => {
    hub.closeAll();
    jest.useRealTimers();
  });

  describe('publish', () => {
    it('writes a framed event to every client on the channel', () => {
      const a = makeClient();
      const b = makeClient();
      hub.subscribe('throughput:fleet', a);
      hub.subscribe('throughput:fleet', b);

      hub.publish('throughput:fleet', 'throughput', { txBps: 1 });

      const frame = 'event: throughput\ndata: {"txBps":1}\n\n';
      expect(a.write).toHaveBeenCalledWith(frame);
      expect(b.write).toHaveBeenCalledWith(frame);
    });

    it('does not reach clients on a different channel', () => {
      const fleet = makeClient();
      const device = makeClient();
      hub.subscribe('throughput:fleet', fleet);
      hub.subscribe('throughput:device:abc', device);

      hub.publish('throughput:device:abc', 'throughput', {});

      expect(device.write).toHaveBeenCalledTimes(1);
      expect(fleet.write).not.toHaveBeenCalled();
    });

    it('is a no-op when the channel has no subscribers', () => {
      expect(() =>
        hub.publish('throughput:fleet', 'throughput', {})
      ).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('stops delivery to the returned client only', () => {
      const kept = makeClient();
      const dropped = makeClient();
      hub.subscribe('c', kept);
      const unsubscribe = hub.subscribe('c', dropped);

      unsubscribe();
      hub.publish('c', 'e', {});

      expect(kept.write).toHaveBeenCalledTimes(1);
      expect(dropped.write).not.toHaveBeenCalled();
    });

    it('is idempotent', () => {
      const client = makeClient();
      const unsubscribe = hub.subscribe('c', client);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
      expect(hub.clientCount()).toBe(0);
    });
  });

  describe('failing clients', () => {
    // a dead socket must not throw into the event-dispatch loop publishing to it
    it('evicts a client whose write throws, without propagating', () => {
      const broken = makeClient();
      broken.write.mockImplementation(() => {
        throw new Error('EPIPE');
      });
      const healthy = makeClient();
      hub.subscribe('c', broken);
      hub.subscribe('c', healthy);

      expect(() => hub.publish('c', 'e', {})).not.toThrow();

      expect(healthy.write).toHaveBeenCalledTimes(1);
      expect(hub.clientCount('c')).toBe(1);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('clientCount', () => {
    it('counts per channel and in total', () => {
      hub.subscribe('a', makeClient());
      hub.subscribe('a', makeClient());
      hub.subscribe('b', makeClient());

      expect(hub.clientCount('a')).toBe(2);
      expect(hub.clientCount('b')).toBe(1);
      expect(hub.clientCount('missing')).toBe(0);
      expect(hub.clientCount()).toBe(3);
    });
  });

  describe('heartbeat', () => {
    it('writes a comment frame to every client on the interval', () => {
      jest.useFakeTimers();
      const client = makeClient();
      hub.subscribe('c', client);

      jest.advanceTimersByTime(15_000);

      expect(client.write).toHaveBeenCalledWith(': ping\n\n');
    });

    it('stops once the last client leaves', () => {
      jest.useFakeTimers();
      const client = makeClient();
      const unsubscribe = hub.subscribe('c', client);
      unsubscribe();

      jest.advanceTimersByTime(60_000);

      expect(client.write).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('closeAll', () => {
    it('ends every client and empties the hub', () => {
      const a = makeClient();
      const b = makeClient();
      hub.subscribe('a', a);
      hub.subscribe('b', b);

      hub.closeAll();

      expect(a.end).toHaveBeenCalledTimes(1);
      expect(b.end).toHaveBeenCalledTimes(1);
      expect(hub.clientCount()).toBe(0);
    });

    it('survives a client that throws on end', () => {
      const broken = makeClient();
      broken.end.mockImplementation(() => {
        throw new Error('already destroyed');
      });
      hub.subscribe('c', broken);

      expect(() => hub.closeAll()).not.toThrow();
      expect(hub.clientCount()).toBe(0);
    });
  });
});
