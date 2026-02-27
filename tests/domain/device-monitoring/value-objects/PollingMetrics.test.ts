import { PollingMetrics } from '../../../../src/domain/device-inventory';

describe('PollingMetrics', () => {
  describe('create', () => {
    describe('when valid metrics', () => {
      it('should create PollingMetrics with all successful pings', () => {
        const result = PollingMetrics.create({
          responseTimes: [23.5, 24.1, 23.8, 24.3],
          totalPings: 4,
          successfulPings: 4
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.totalPings).toBe(4);
        expect(result.value.successfulPings).toBe(4);
        expect(result.value.responseTimes).toHaveLength(4);
      });

      it('should calculate average response time correctly', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, 30, 40],
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.averageResponseTime).toBe(30);
      });

      it('should calculate min response time correctly', () => {
        const result = PollingMetrics.create({
          responseTimes: [23.5, 24.1, 23.8, 24.3],
          totalPings: 4,
          successfulPings: 4
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.minResponseTime).toBe(23.5);
      });

      it('should calculate max response time correctly', () => {
        const result = PollingMetrics.create({
          responseTimes: [23.5, 24.1, 23.8, 24.3],
          totalPings: 4,
          successfulPings: 4
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.maxResponseTime).toBe(24.3);
      });

      it('should calculate jitter (standard deviation) correctly', () => {
        const result = PollingMetrics.create({
          responseTimes: [23.5, 24.1, 23.8, 24.3],
          totalPings: 4,
          successfulPings: 4
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.jitter).toBeCloseTo(0.3, 1);
      });

      it('should calculate packet loss as 0% for all successful pings', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, 30],
          totalPings: 2,
          successfulPings: 2
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.packetLoss).toBe(0);
      });

      it('should calculate packet loss correctly for partial success', () => {
        const result = PollingMetrics.create({
          responseTimes: [23.5, 24.1],
          totalPings: 4,
          successfulPings: 2
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.packetLoss).toBe(50);
      });

      it('should create metrics with single ping', () => {
        const result = PollingMetrics.create({
          responseTimes: [25.5],
          totalPings: 1,
          successfulPings: 1
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.averageResponseTime).toBe(25.5);
        expect(result.value.minResponseTime).toBe(25.5);
        expect(result.value.maxResponseTime).toBe(25.5);
        expect(result.value.jitter).toBe(0);
      });

      it('should create metrics with maximum pings (10)', () => {
        const responseTimes = Array(10).fill(20);
        const result = PollingMetrics.create({
          responseTimes,
          totalPings: 10,
          successfulPings: 10
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.totalPings).toBe(10);
        expect(result.value.successfulPings).toBe(10);
      });

      it('should handle zero response times correctly', () => {
        const result = PollingMetrics.create({
          responseTimes: [0, 0, 0],
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.averageResponseTime).toBe(0);
        expect(result.value.jitter).toBe(0);
      });

      it('should handle large response times within limit', () => {
        const result = PollingMetrics.create({
          responseTimes: [29999],
          totalPings: 1,
          successfulPings: 1
        });

        expect(result.isSuccess).toBe(true);
        expect(result.value.averageResponseTime).toBe(29999);
      });

      it('should immutably freeze responseTimes array', () => {
        const result = PollingMetrics.create({
          responseTimes: [10, 20],
          totalPings: 2,
          successfulPings: 2
        });

        expect(result.isSuccess).toBe(true);
        expect(() => {
          // @ts-expect-error - Testing immutability
          result.value.responseTimes.push(30);
        }).toThrow();
      });
    });

    describe('when invalid responseTimes', () => {
      it('should fail for null responseTimes', () => {
        const result = PollingMetrics.create({
          responseTimes: null as any,
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('responseTimes');
      });

      it('should fail for undefined responseTimes', () => {
        const result = PollingMetrics.create({
          responseTimes: undefined as any,
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('responseTimes');
      });

      it('should fail for non-array responseTimes', () => {
        const result = PollingMetrics.create({
          responseTimes: 'not-array' as any,
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'responseTimes must be an array'
        );
      });

      it('should fail for responseTimes with NaN value', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, NaN, 30],
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid response time');
      });

      it('should fail for responseTimes with negative value', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, -5, 30],
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('out of range');
      });

      it('should fail for responseTimes exceeding maximum (30000ms)', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, 30001],
          totalPings: 2,
          successfulPings: 2
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('out of range');
      });

      it('should fail for responseTimes with non-number value', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, '30' as any, 40],
          totalPings: 3,
          successfulPings: 3
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid response time');
      });

      it('should fail when responseTimes length does not match successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, 25],
          totalPings: 3,
          successfulPings: 1
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'array length must equal successfulPings'
        );
      });

      it('should fail when responseTimes has more elements than successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [20, 25, 30],
          totalPings: 5,
          successfulPings: 2
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'array length must equal successfulPings'
        );
      });
    });

    describe('when invalid totalPings', () => {
      it('should fail for null totalPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: null as any,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });

      it('should fail for undefined totalPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: undefined as any,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });

      it('should fail for totalPings below minimum (0)', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 0,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });

      it('should fail for negative totalPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: -5,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });

      it('should fail for totalPings exceeding maximum (10)', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 11,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });

      it('should fail for non-number totalPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: '5' as any,
          successfulPings: 0
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('totalPings');
      });
    });

    describe('when invalid successfulPings', () => {
      it('should fail for null successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 5,
          successfulPings: null as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successfulPings');
      });

      it('should fail for undefined successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 5,
          successfulPings: undefined as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successfulPings');
      });

      it('should fail for successfulPings exceeding totalPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [20],
          totalPings: 1,
          successfulPings: 2
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain(
          'successfulPings cannot exceed totalPings'
        );
      });

      it('should fail for negative successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 5,
          successfulPings: -1
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successfulPings');
      });

      it('should fail for non-number successfulPings', () => {
        const result = PollingMetrics.create({
          responseTimes: [],
          totalPings: 5,
          successfulPings: '3' as any
        });

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('successfulPings');
      });
    });
  });

  describe('createForFailedPoll', () => {
    it('should create metrics for complete failure', () => {
      const result = PollingMetrics.createForFailedPoll(5);

      expect(result.isSuccess).toBe(true);
      expect(result.value.totalPings).toBe(5);
      expect(result.value.successfulPings).toBe(0);
      expect(result.value.packetLoss).toBe(100);
      expect(result.value.responseTimes).toHaveLength(0);
    });

    it('should set all metrics to zero for failed poll', () => {
      const result = PollingMetrics.createForFailedPoll(3);

      expect(result.isSuccess).toBe(true);
      expect(result.value.averageResponseTime).toBe(0);
      expect(result.value.minResponseTime).toBe(0);
      expect(result.value.maxResponseTime).toBe(0);
      expect(result.value.jitter).toBe(0);
    });

    it('should create for minimum ping count', () => {
      const result = PollingMetrics.createForFailedPoll(1);

      expect(result.isSuccess).toBe(true);
      expect(result.value.totalPings).toBe(1);
      expect(result.value.packetLoss).toBe(100);
    });

    it('should create for maximum ping count', () => {
      const result = PollingMetrics.createForFailedPoll(10);

      expect(result.isSuccess).toBe(true);
      expect(result.value.totalPings).toBe(10);
      expect(result.value.packetLoss).toBe(100);
    });

    it('should fail for invalid totalPings', () => {
      const result = PollingMetrics.createForFailedPoll(0);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('isFullySuccessful', () => {
    it('should return true when all pings succeeded', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [23, 24, 25],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.isFullySuccessful()).toBe(true);
    });

    it('should return false when there is packet loss', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [23, 24],
        totalPings: 3,
        successfulPings: 2
      }).value;

      expect(metrics.isFullySuccessful()).toBe(false);
    });

    it('should return false for complete failure', () => {
      const metrics = PollingMetrics.createForFailedPoll(5).value;

      expect(metrics.isFullySuccessful()).toBe(false);
    });
  });

  describe('isCompleteFailure', () => {
    it('should return true when all pings failed', () => {
      const metrics = PollingMetrics.createForFailedPoll(5).value;

      expect(metrics.isCompleteFailure()).toBe(true);
    });

    it('should return false when all pings succeeded', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics.isCompleteFailure()).toBe(false);
    });

    it('should return false when there is partial success', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      expect(metrics.isCompleteFailure()).toBe(false);
    });
  });

  describe('hasPacketLoss', () => {
    it('should return true when there is packet loss', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      expect(metrics.hasPacketLoss()).toBe(true);
    });

    it('should return true for complete failure', () => {
      const metrics = PollingMetrics.createForFailedPoll(5).value;

      expect(metrics.hasPacketLoss()).toBe(true);
    });

    it('should return false when all pings succeeded', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics.hasPacketLoss()).toBe(false);
    });
  });

  describe('hasHighJitter', () => {
    it('should return true when jitter exceeds threshold', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [5, 100],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics.hasHighJitter(30)).toBe(true);
    });

    it('should return false when jitter is below threshold', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1, 23.8, 24.3],
        totalPings: 4,
        successfulPings: 4
      }).value;

      expect(metrics.hasHighJitter(1)).toBe(false);
    });

    it('should return false when jitter equals threshold', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      const jitter = metrics.jitter;
      expect(metrics.hasHighJitter(jitter)).toBe(false);
    });

    it('should return false for zero jitter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 20, 20],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.hasHighJitter(10)).toBe(false);
      expect(metrics.jitter).toBe(0);
    });
  });

  describe('getQualityScore', () => {
    it('should return 100 for perfect metrics (no loss, low jitter)', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 20, 20],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.getQualityScore()).toBe(100);
    });

    it('should return 0 for complete failure', () => {
      const metrics = PollingMetrics.createForFailedPoll(5).value;

      expect(metrics.getQualityScore()).toBe(0);
    });

    it('should deduct points for packet loss', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      const score = metrics.getQualityScore();
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should deduct points for high jitter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [30, 200],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const score = metrics.getQualityScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return score between 0 and 100', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 50, 100],
        totalPings: 5,
        successfulPings: 3
      }).value;

      const score = metrics.getQualityScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('toDisplayString', () => {
    it('should display full metrics for successful poll', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      const display = metrics.toDisplayString();
      expect(display).toContain('Avg:');
      expect(display).toContain('ms');
      expect(display).toContain('Min:');
      expect(display).toContain('Max:');
      expect(display).toContain('Jitter:');
      expect(display).toContain('Loss: 0%');
    });

    it('should display packet loss percentage', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      const display = metrics.toDisplayString();
      expect(display).toContain('Loss: 50%');
    });

    it('should display failure message for complete failure', () => {
      const metrics = PollingMetrics.createForFailedPoll(5).value;

      const display = metrics.toDisplayString();
      expect(display).toContain('Failed');
      expect(display).toContain('5/5');
      expect(display).toContain('packets lost');
    });

    it('should include all metrics in display', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1, 23.8, 24.3],
        totalPings: 4,
        successfulPings: 4
      }).value;

      const display = metrics.toDisplayString();
      expect(display).toMatch(/Avg: [\d.]+ms/);
      expect(display).toMatch(/Min: [\d.]+ms/);
      expect(display).toMatch(/Max: [\d.]+ms/);
      expect(display).toMatch(/Jitter: [\d.]+ms/);
      expect(display).toMatch(/Loss: [\d.]+%/);
    });
  });

  describe('toString', () => {
    it('should return compact summary', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 20, 30],
        totalPings: 3,
        successfulPings: 3
      }).value;

      const str = metrics.toString();
      expect(str).toContain('avg');
      expect(str).toContain('(3/3 pings)');
      expect(str).toContain('ms');
    });

    it('should show correct ping ratio for partial success', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 5,
        successfulPings: 2
      }).value;

      const str = metrics.toString();
      expect(str).toContain('(2/5 pings)');
    });

    it('should show average response time', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 20, 30],
        totalPings: 3,
        successfulPings: 3
      }).value;

      const str = metrics.toString();
      expect(str).toContain('20ms');
    });
  });

  describe('getters', () => {
    it('should have correct responseTimes getter', () => {
      const responseTimes = [23.5, 24.1, 23.8, 24.3];
      const metrics = PollingMetrics.create({
        responseTimes,
        totalPings: 4,
        successfulPings: 4
      }).value;

      expect(metrics.responseTimes).toEqual(responseTimes);
    });

    it('should have correct totalPings getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 5,
        successfulPings: 2
      }).value;

      expect(metrics.totalPings).toBe(5);
    });

    it('should have correct successfulPings getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 5,
        successfulPings: 2
      }).value;

      expect(metrics.successfulPings).toBe(2);
    });

    it('should have correct averageResponseTime getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 20, 30],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.averageResponseTime).toBe(20);
    });

    it('should have correct minResponseTime getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 20, 30],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.minResponseTime).toBe(10);
    });

    it('should have correct maxResponseTime getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [10, 20, 30],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.maxResponseTime).toBe(30);
    });

    it('should have correct jitter getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 20, 20],
        totalPings: 3,
        successfulPings: 3
      }).value;

      expect(metrics.jitter).toBe(0);
    });

    it('should have correct packetLoss getter', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      expect(metrics.packetLoss).toBe(50);
    });
  });

  describe('equals', () => {
    it('should return true for same metrics values', () => {
      const metrics1 = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      const metrics2 = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics1.equals(metrics2)).toBe(true);
    });

    it('should return false for different response times', () => {
      const metrics1 = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      const metrics2 = PollingMetrics.create({
        responseTimes: [25, 35],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics1.equals(metrics2)).toBe(false);
    });

    it('should return false for different totalPings', () => {
      const metrics1 = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 2,
        successfulPings: 1
      }).value;

      const metrics2 = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 3,
        successfulPings: 1
      }).value;

      expect(metrics1.equals(metrics2)).toBe(false);
    });

    it('should return false for different successfulPings', () => {
      const metrics1 = PollingMetrics.create({
        responseTimes: [20],
        totalPings: 3,
        successfulPings: 1
      }).value;

      const metrics2 = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 3,
        successfulPings: 2
      }).value;

      expect(metrics1.equals(metrics2)).toBe(false);
    });

    it('should return false for null', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics.equals(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(metrics.equals(undefined as any)).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of props', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        metrics.props.totalPings = 5;
      }).toThrow();
    });

    it('should not allow reassignment of props reference', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      // TypeScript prevents this at compile time
      expect(() => {
        // @ts-expect-error - props is readonly
        metrics.props = {
          responseTimes: [10, 20],
          totalPings: 5,
          successfulPings: 5,
          averageResponseTime: 15,
          minResponseTime: 10,
          maxResponseTime: 20,
          jitter: 5,
          packetLoss: 0
        };
      }).toThrow();
    });

    it('should not allow modification of responseTimes array', () => {
      const metrics = PollingMetrics.create({
        responseTimes: [20, 30],
        totalPings: 2,
        successfulPings: 2
      }).value;

      expect(() => {
        // @ts-expect-error - Testing immutability
        metrics.responseTimes.push(40);
      }).toThrow();
    });
  });
});
