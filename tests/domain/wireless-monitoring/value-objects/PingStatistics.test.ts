import { PingStatistics } from '../../../../src/domain/wireless-monitoring/value-objects/PingStatistics';

describe('[WLS-187] PingStatistics.fromReplies', () => {
  it('should report zero loss and no figures for no probes', () => {
    const stats = PingStatistics.fromReplies([]);

    expect(stats.sent).toBe(0);
    expect(stats.lossPercent).toBe(0);
    expect(stats.avgMs).toBeNull();
    expect(stats.jitterMs).toBeNull();
  });

  it('should report 100% loss when nothing replied', () => {
    const stats = PingStatistics.fromReplies([null, null, null]);

    expect(stats.sent).toBe(3);
    expect(stats.received).toBe(0);
    expect(stats.lossPercent).toBe(100);
    expect(stats.minMs).toBeNull();
  });

  it('should compute loss, min, avg and max over the replies', () => {
    const stats = PingStatistics.fromReplies([10, null, 20, 30]);

    expect(stats.sent).toBe(4);
    expect(stats.received).toBe(3);
    expect(stats.lossPercent).toBe(25);
    expect(stats.minMs).toBe(10);
    expect(stats.avgMs).toBe(20);
    expect(stats.maxMs).toBe(30);
  });

  it('should take jitter as the mean delta between consecutive replies, skipping losses', () => {
    // deltas: |20-10| = 10, |14-20| = 6 -> 8
    const stats = PingStatistics.fromReplies([10, null, 20, 14]);

    expect(stats.jitterMs).toBe(8);
  });

  it('should leave jitter null with a single reply', () => {
    expect(PingStatistics.fromReplies([12]).jitterMs).toBeNull();
  });

  it('should count replies at or above 150 ms as spikes', () => {
    const stats = PingStatistics.fromReplies([
      5,
      149,
      150,
      400,
      null
    ]);

    expect(stats.spikeCount).toBe(2);
  });

  it('should round to one decimal', () => {
    const stats = PingStatistics.fromReplies([1, 2, 2]);

    expect(stats.avgMs).toBe(1.7);
    expect(stats.lossPercent).toBe(0);
  });
});
