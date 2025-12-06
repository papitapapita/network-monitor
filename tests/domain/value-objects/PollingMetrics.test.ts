import { PollingMetrics } from '../../../src/domain';

describe('PollingMetrics ValueObject', () => {
  const validResponseTimes = [23.5, 24.1, 23.8, 24.3];

  it('should create valid metrics and compute statistics correctly', () => {
    const result = PollingMetrics.create({
      responseTimes: validResponseTimes,
      totalPings: 4,
      successfulPings: 4
    });

    expect(result.isSuccess).toBe(true);
    const metrics = result.value as PollingMetrics;

    expect(metrics.averageResponseTime).toBeCloseTo(23.93);
    expect(metrics.minResponseTime).toBe(23.5);
    expect(metrics.maxResponseTime).toBe(24.3);
    expect(metrics.jitter).toBeCloseTo(0.33);
    expect(metrics.packetLoss).toBe(0);
  });

  it('should fail if responseTimes is not array', () => {
    const result = PollingMetrics.create({
      // @ts-ignore
      responseTimes: 'not-array',
      totalPings: 3,
      successfulPings: 3
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('responseTimes must be an array');
  });

  it('should fail if totalPings below minimum', () => {
    const result = PollingMetrics.create({
      responseTimes: [],
      totalPings: 0,
      successfulPings: 0
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain('totalPings');
  });

  it('should fail if successfulPings exceeds totalPings', () => {
    const result = PollingMetrics.create({
      responseTimes: [20],
      totalPings: 1,
      successfulPings: 2
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain(
      'successfulPings cannot exceed totalPings'
    );
  });

  it('should fail if responseTimes length does not match successfulPings', () => {
    const result = PollingMetrics.create({
      responseTimes: [20, 25],
      totalPings: 3,
      successfulPings: 1
    });

    expect(result.isSuccess).toBe(false);
    expect(result.error).toContain(
      'array length must equal successfulPings'
    );
  });

  it('should calculate packet loss correctly', () => {
    const result = PollingMetrics.create({
      responseTimes: [23.5, 24.1],
      totalPings: 4,
      successfulPings: 2
    });

    const metrics = result.value as PollingMetrics;
    expect(metrics.packetLoss).toBeCloseTo(50);
  });

  it('should set all values to zero for failed poll', () => {
    const result = PollingMetrics.createForFailedPoll(5);
    const metrics = result.value as PollingMetrics;

    expect(metrics.successfulPings).toBe(0);
    expect(metrics.packetLoss).toBe(100);
    expect(metrics.isCompleteFailure()).toBe(true);
  });

  it('should detect full success', () => {
    const result = PollingMetrics.create({
      responseTimes: [23, 24, 25],
      totalPings: 3,
      successfulPings: 3
    });

    const metrics = result.value as PollingMetrics;
    expect(metrics.isFullySuccessful()).toBe(true);
    expect(metrics.isCompleteFailure()).toBe(false);
  });

  it('should detect high jitter condition', () => {
    const result = PollingMetrics.create({
      responseTimes: [5, 100],
      totalPings: 2,
      successfulPings: 2
    });

    const metrics = result.value as PollingMetrics;
    expect(metrics.hasHighJitter(30)).toBe(true);
  });

  it('should generate display string correctly', () => {
    const result = PollingMetrics.create({
      responseTimes: [20, 30],
      totalPings: 2,
      successfulPings: 2
    });

    const metrics = result.value as PollingMetrics;
    expect(metrics.toDisplayString()).toContain('Avg:');
    expect(metrics.toDisplayString()).toContain('Loss: 0%');
  });

  it('should return proper toString()', () => {
    const result = PollingMetrics.create({
      responseTimes: [10, 20, 30],
      totalPings: 3,
      successfulPings: 3
    });

    const metrics = result.value as PollingMetrics;
    expect(metrics.toString()).toContain('avg (3/3 pings)');
  });

  it('should compute quality score (mix jitter and loss)', () => {
    const result = PollingMetrics.create({
      responseTimes: [30, 200], // Large jitter
      totalPings: 4,
      successfulPings: 2
    });

    const metrics = result.value as PollingMetrics;
    const score = metrics.getQualityScore();

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
