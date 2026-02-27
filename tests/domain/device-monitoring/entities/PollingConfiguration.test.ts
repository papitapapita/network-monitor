import {
  PollingInterval,
  PollingConfiguration,
  PollingConfigurationId,
  NetworkDeviceId,
  RetryPolicy,
  BackoffStrategy
} from '../../../src/domain/device-inventory';

describe('PollingConfiguration', () => {
  let networkDeviceId: NetworkDeviceId;
  let interval: PollingInterval;
  let retryPolicy: RetryPolicy;

  beforeEach(() => {
    networkDeviceId = NetworkDeviceId.create().value;
    interval = PollingInterval.create(60).value;
    retryPolicy = RetryPolicy.createDefault();
  });

  describe('create', () => {
    it('should create a valid PollingConfiguration with all required props', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingConfiguration);
      expect(result.value.networkDeviceId).toBe(networkDeviceId);
      expect(result.value.interval).toBe(interval);
      expect(result.value.enabled).toBe(true);
      expect(result.value.retryPolicy).toBe(retryPolicy);
      expect(result.value.pingCount).toBe(4);
    });

    it('should auto-generate ID when not provided', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.value.id).toBeDefined();
      expect(result.value.id).toBeInstanceOf(PollingConfigurationId);
    });

    it('should use provided ID when specified', () => {
      const customId = PollingConfigurationId.create().value;
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        customId
      );

      expect(result.value.id).toBe(customId);
    });

    it('should fail when networkDeviceId is null', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId: null as any,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('networkDeviceId');
    });

    it('should fail when interval is null', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: null as any,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('interval');
    });

    it('should fail when enabled is null', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: null as any,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('enabled');
    });

    it('should fail when retryPolicy is null', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy: null as any,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('retryPolicy');
    });

    it('should fail when pingCount is null', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: null as any,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should fail when pingCount is not a number', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 'invalid' as any,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should fail when pingCount is below minimum (1)', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 0,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should fail when pingCount is above maximum (10)', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 11,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should round pingCount to integer if decimal provided', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4.7,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.pingCount).toBe(5);
    });

    it('should accept minimum pingCount of 1', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 1,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.pingCount).toBe(1);
    });

    it('should accept maximum pingCount of 10', () => {
      const result = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 10,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.pingCount).toBe(10);
    });
  });

  describe('createDefault', () => {
    it('should create a PollingConfiguration with default values', () => {
      const result = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.networkDeviceId).toBe(networkDeviceId);
      expect(result.value.interval).toBe(interval);
      expect(result.value.enabled).toBe(true);
      expect(result.value.pingCount).toBe(
        PollingConfiguration.DEFAULT_PING_COUNT
      );
      expect(result.value.lastScheduledAt).toBeNull();
      expect(result.value.nextScheduledAt).toBeNull();
    });

    it('should use default retry policy', () => {
      const result = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      );

      expect(result.value.retryPolicy).toEqual(
        RetryPolicy.createDefault()
      );
    });
  });

  describe('enable', () => {
    it('should enable a disabled configuration', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('should return stateChanged=true when enabling disabled configuration', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
      expect(result.value.stateChanged).toBe(true);
    });

    it('should be idempotent when already enabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(true);
    });

    it('should return stateChanged=false when already enabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.enable();

      expect(result.isSuccess).toBe(true);
      expect(result.value.stateChanged).toBe(false);
    });
  });

  describe('disable', () => {
    it('should disable an enabled configuration', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(false);
    });

    it('should return stateChanged=true when disabling enabled configuration', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
      expect(result.value.stateChanged).toBe(true);
    });

    it('should clear nextScheduledAt when disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: new Date(),
          nextScheduledAt: new Date(Date.now() + 60000)
        },
        PollingConfigurationId.create().value
      ).value;

      config.disable();

      expect(config.nextScheduledAt).toBeNull();
    });

    it('should be idempotent when already disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
      expect(config.enabled).toBe(false);
    });

    it('should return stateChanged=false when already disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.disable();

      expect(result.isSuccess).toBe(true);
      expect(result.value.stateChanged).toBe(false);
    });
  });

  describe('updateInterval', () => {
    it('should update the interval', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const newInterval = PollingInterval.create(120).value;
      const result = config.updateInterval(newInterval);

      expect(result.isSuccess).toBe(true);
      expect(config.interval).toBe(newInterval);
    });

    it('should return the previous interval value', () => {
      const originalInterval = PollingInterval.create(60).value;
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        originalInterval
      ).value;

      const newInterval = PollingInterval.create(120).value;
      const result = config.updateInterval(newInterval);

      expect(result.isSuccess).toBe(true);
      expect(result.value.previousInterval).toBe(originalInterval);
      expect(result.value.previousInterval.seconds).toBe(60);
    });

    it('should return previous interval even when updating to same value', () => {
      const originalInterval = PollingInterval.create(60).value;
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        originalInterval
      ).value;

      const sameInterval = PollingInterval.create(60).value;
      const result = config.updateInterval(sameInterval);

      expect(result.isSuccess).toBe(true);
      expect(result.value.previousInterval).toBe(originalInterval);
    });

    it('should fail when newInterval is null', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updateInterval(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('interval');
    });

    it('should reschedule when enabled and has lastScheduledAt', () => {
      const lastScheduled = new Date();
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: lastScheduled,
          nextScheduledAt: new Date(lastScheduled.getTime() + 60000)
        },
        PollingConfigurationId.create().value
      ).value;

      const newInterval = PollingInterval.create(120).value;
      config.updateInterval(newInterval);

      // Should reschedule with new interval (120 seconds)
      const expectedNext = new Date(lastScheduled.getTime() + 120000);
      expect(config.nextScheduledAt?.getTime()).toBe(
        expectedNext.getTime()
      );
    });

    it('should not reschedule when disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const newInterval = PollingInterval.create(120).value;
      config.updateInterval(newInterval);

      expect(config.nextScheduledAt).toBeNull();
    });

    it('should not reschedule when no lastScheduledAt', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const newInterval = PollingInterval.create(120).value;
      config.updateInterval(newInterval);

      expect(config.nextScheduledAt).toBeNull();
    });
  });

  describe('updatePingCount', () => {
    it('should update the ping count', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(6);

      expect(result.isSuccess).toBe(true);
      expect(config.pingCount).toBe(6);
    });

    it('should return the previous ping count value', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const originalPingCount = config.pingCount; // DEFAULT_PING_COUNT is 4
      const result = config.updatePingCount(6);

      expect(result.isSuccess).toBe(true);
      expect(result.value.previousPingCount).toBe(originalPingCount);
      expect(result.value.previousPingCount).toBe(4);
    });

    it('should return previous ping count even when updating to same value', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const currentPingCount = config.pingCount;
      const result = config.updatePingCount(currentPingCount);

      expect(result.isSuccess).toBe(true);
      expect(result.value.previousPingCount).toBe(currentPingCount);
    });

    it('should round decimal values', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      config.updatePingCount(6.8);

      expect(config.pingCount).toBe(7);
    });

    it('should fail when count is null', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should fail when count is not a number', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount('invalid' as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('pingCount');
    });

    it('should fail when count is below minimum', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(0);

      expect(result.isFailure).toBe(true);
    });

    it('should fail when count is above maximum', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(11);

      expect(result.isFailure).toBe(true);
    });

    it('should accept minimum value of 1', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(1);

      expect(result.isSuccess).toBe(true);
      expect(config.pingCount).toBe(1);
    });

    it('should accept maximum value of 10', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updatePingCount(10);

      expect(result.isSuccess).toBe(true);
      expect(config.pingCount).toBe(10);
    });
  });

  describe('updateRetryPolicy', () => {
    it('should update the retry policy', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const newPolicy = RetryPolicy.create({
        maxAttempts: 5,
        baseDelayMs: 2000,
        backoffStrategy: BackoffStrategy.LINEAR
      }).value;

      const result = config.updateRetryPolicy(newPolicy);

      expect(result.isSuccess).toBe(true);
      expect(config.retryPolicy).toBe(newPolicy);
    });

    it('should fail when newRetryPolicy is null', () => {
      const config = PollingConfiguration.createDefault(
        networkDeviceId,
        PollingConfigurationId.create().value,
        interval
      ).value;

      const result = config.updateRetryPolicy(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('retryPolicy');
    });
  });

  describe('scheduleNext', () => {
    it('should schedule next poll time based on interval', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.create(60).value, // 60 seconds
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const fromTime = new Date('2024-01-01T10:00:00Z');
      const result = config.scheduleNext(fromTime);

      expect(result.isSuccess).toBe(true);
      expect(config.lastScheduledAt).toEqual(fromTime);

      const expectedNext = new Date('2024-01-01T10:01:00Z'); // +60 seconds
      expect(config.nextScheduledAt?.getTime()).toBe(
        expectedNext.getTime()
      );
    });

    it('should fail when polling is disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.scheduleNext(new Date());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('disabled');
    });

    it('should fail when fromTime is null', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const result = config.scheduleNext(null as any);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('fromTime');
    });

    it('should correctly calculate next time with different intervals', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.fromMinutes(5).value, // 300 seconds
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const fromTime = new Date('2024-01-01T10:00:00Z');
      config.scheduleNext(fromTime);

      const expectedNext = new Date('2024-01-01T10:05:00Z'); // +5 minutes
      expect(config.nextScheduledAt?.getTime()).toBe(
        expectedNext.getTime()
      );
    });
  });

  describe('canPoll', () => {
    it('should return false when disabled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.canPoll(new Date())).toBe(false);
    });

    it('should return true when enabled and never scheduled', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.canPoll(new Date())).toBe(true);
    });

    it('should return true when current time is at scheduled time', () => {
      const scheduledTime = new Date('2024-01-01T10:00:00Z');
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: new Date('2024-01-01T09:59:00Z'),
          nextScheduledAt: scheduledTime
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.canPoll(scheduledTime)).toBe(true);
    });

    it('should return true when current time is past scheduled time', () => {
      const scheduledTime = new Date('2024-01-01T10:00:00Z');
      const currentTime = new Date('2024-01-01T10:01:00Z');
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: new Date('2024-01-01T09:59:00Z'),
          nextScheduledAt: scheduledTime
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.canPoll(currentTime)).toBe(true);
    });

    it('should return false when current time is before scheduled time', () => {
      const scheduledTime = new Date('2024-01-01T10:00:00Z');
      const currentTime = new Date('2024-01-01T09:59:00Z');
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: new Date('2024-01-01T09:58:00Z'),
          nextScheduledAt: scheduledTime
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.canPoll(currentTime)).toBe(false);
    });
  });

  describe('toDisplayString', () => {
    it('should display enabled status correctly', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.create(60).value,
          enabled: true,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const display = config.toDisplayString();

      expect(display).toContain('Enabled');
      expect(display).toContain('1 minute'); // 60 seconds is displayed as "1 minute"
      expect(display).toContain('4 pings');
    });

    it('should display disabled status correctly', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.create(60).value,
          enabled: false,
          retryPolicy,
          pingCount: 4,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const display = config.toDisplayString();

      expect(display).toContain('Disabled');
    });

    it('should use singular "ping" for count of 1', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.create(60).value,
          enabled: true,
          retryPolicy,
          pingCount: 1,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const display = config.toDisplayString();

      expect(display).toContain('1 ping per poll');
      expect(display).not.toContain('pings');
    });

    it('should use plural "pings" for count > 1', () => {
      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval: PollingInterval.create(60).value,
          enabled: true,
          retryPolicy,
          pingCount: 5,
          lastScheduledAt: null,
          nextScheduledAt: null
        },
        PollingConfigurationId.create().value
      ).value;

      const display = config.toDisplayString();

      expect(display).toContain('5 pings per poll');
    });
  });

  describe('constants', () => {
    it('should have correct MIN_PING_COUNT', () => {
      expect(PollingConfiguration.MIN_PING_COUNT).toBe(1);
    });

    it('should have correct MAX_PING_COUNT', () => {
      expect(PollingConfiguration.MAX_PING_COUNT).toBe(10);
    });

    it('should have correct DEFAULT_PING_COUNT', () => {
      expect(PollingConfiguration.DEFAULT_PING_COUNT).toBe(4);
    });
  });

  describe('getters', () => {
    it('should expose all properties via getters', () => {
      const lastScheduled = new Date('2024-01-01T09:00:00Z');
      const nextScheduled = new Date('2024-01-01T10:00:00Z');

      const config = PollingConfiguration.create(
        {
          networkDeviceId,
          interval,
          enabled: true,
          retryPolicy,
          pingCount: 5,
          lastScheduledAt: lastScheduled,
          nextScheduledAt: nextScheduled
        },
        PollingConfigurationId.create().value
      ).value;

      expect(config.networkDeviceId).toBe(networkDeviceId);
      expect(config.interval).toBe(interval);
      expect(config.enabled).toBe(true);
      expect(config.retryPolicy).toBe(retryPolicy);
      expect(config.pingCount).toBe(5);
      expect(config.lastScheduledAt).toBe(lastScheduled);
      expect(config.nextScheduledAt).toBe(nextScheduled);
    });
  });
});
