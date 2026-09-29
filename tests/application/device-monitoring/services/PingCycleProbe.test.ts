import { PingCycleProbe } from '../../../../src/application/device-monitoring/services/PingCycleProbe';
import { IPingService } from '../../../../src/application/device-monitoring/interfaces/IPingService';
import { Result } from '../../../../src/domain/shared/core/Result';

const TEST_IP = '192.168.1.50';

function makePingService(): jest.Mocked<IPingService> {
  return { ping: jest.fn() };
}

const reachable = (latencyMs: number) =>
  Result.ok({ isReachable: true, latencyMs });
const unreachable = () =>
  Result.ok({ isReachable: false, latencyMs: null });

describe('PingCycleProbe', () => {
  let pingService: jest.Mocked<IPingService>;
  let probe: PingCycleProbe;

  beforeEach(() => {
    pingService = makePingService();
    probe = new PingCycleProbe(pingService, 0);
  });

  describe('a device that answers', () => {
    it('stops at the first reply and reports its latency', async () => {
      pingService.ping
        .mockResolvedValueOnce(unreachable())
        .mockResolvedValueOnce(reachable(18));

      const outcome = await probe.run(TEST_IP, 3);

      expect(outcome).toEqual({
        kind: 'measured',
        isReachable: true,
        latencyMs: 18,
        attempts: 2
      });
      expect(pingService.ping).toHaveBeenCalledTimes(2);
    });

    it('pings the given address', async () => {
      pingService.ping.mockResolvedValue(reachable(5));

      await probe.run(TEST_IP, 3);

      expect(pingService.ping).toHaveBeenCalledWith(TEST_IP);
    });
  });

  describe('a device that never answers', () => {
    it('uses the whole attempt budget before calling it unreachable', async () => {
      pingService.ping.mockResolvedValue(unreachable());

      const outcome = await probe.run(TEST_IP, 4);

      expect(outcome).toEqual({
        kind: 'measured',
        isReachable: false,
        latencyMs: null,
        attempts: 4
      });
      expect(pingService.ping).toHaveBeenCalledTimes(4);
    });
  });

  describe('the ping program cannot be executed', () => {
    it('retries through execution errors and recovers on a later attempt', async () => {
      pingService.ping
        .mockResolvedValueOnce(Result.fail('spawn EAGAIN'))
        .mockResolvedValueOnce(reachable(7));

      const outcome = await probe.run(TEST_IP, 3);

      expect(outcome).toEqual({
        kind: 'measured',
        isReachable: true,
        latencyMs: 7,
        attempts: 2
      });
    });

    it('reports probe-unavailable only when no attempt ran', async () => {
      pingService.ping.mockResolvedValue(Result.fail('spawn ENOENT'));

      const outcome = await probe.run(TEST_IP, 3);

      expect(outcome).toEqual({
        kind: 'probe-unavailable',
        error: 'spawn ENOENT',
        attempts: 3
      });
    });

    it('treats one real "no reply" among execution errors as unreachable', async () => {
      pingService.ping
        .mockResolvedValueOnce(Result.fail('spawn EAGAIN'))
        .mockResolvedValueOnce(unreachable())
        .mockResolvedValueOnce(Result.fail('spawn EAGAIN'));

      const outcome = await probe.run(TEST_IP, 3);

      expect(outcome).toEqual({
        kind: 'measured',
        isReachable: false,
        latencyMs: null,
        attempts: 3
      });
    });
  });

  it('waits between attempts, not before the first', async () => {
    jest.useFakeTimers();
    try {
      probe = new PingCycleProbe(pingService, 1_000);
      pingService.ping.mockResolvedValue(unreachable());

      const running = probe.run(TEST_IP, 2);
      await jest.advanceTimersByTimeAsync(0);
      expect(pingService.ping).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(999);
      expect(pingService.ping).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await running;
      expect(pingService.ping).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
