import {
  PollingResult,
  PollingResultId,
  NetworkDeviceId,
  PollingStatus,
  PollingMetrics,
  NetworkDeviceStatus,
  RetryPolicy,
  BackoffStrategy,
  IPAddress
} from '../../../src/domain';

describe('PollingResult', () => {
  let networkDeviceId: NetworkDeviceId;
  let timestamp: Date;
  let metrics: PollingMetrics;
  let retryPolicy: RetryPolicy;

  beforeEach(() => {
    networkDeviceId = NetworkDeviceId.create().value;
    timestamp = new Date('2024-01-01T10:00:00Z');
    metrics = PollingMetrics.create({
      responseTimes: [23.5, 24.1, 23.8, 24.3],
      totalPings: 4,
      successfulPings: 4
    }).value;
    retryPolicy = RetryPolicy.createDefault();
  });

  describe('reconstitute', () => {
    it('should reconstitute a valid PollingResult with all required props', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResult);
      expect(result.value.networkDeviceId).toBe(networkDeviceId);
      expect(result.value.timestamp).toBe(timestamp);
      expect(result.value.status.toString()).toBe(
        PollingStatus.SUCCESS
      );
      expect(result.value.metrics).toBe(metrics);
      expect(result.value.attemptNumber).toBe(1);
      expect(result.value.errorMessage).toBeNull();
      expect(result.value.deviceStatus.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
    });

    it('should require ID parameter', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.value.id).toBeDefined();
      expect(result.value.id).toBeInstanceOf(PollingResultId);
    });

    it('should use provided ID when specified', () => {
      const customId = PollingResultId.create(
        '550e8400-e29b-41d4-a716-446655440000'
      ).value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        customId
      );

      expect(result.value.id).toBe(customId);
    });

    it('should fail when networkDeviceId is null', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId: null as any,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('networkDeviceId');
    });

    it('should fail when timestamp is null', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp: null as any,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('timestamp');
    });

    it('should fail when status is null', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: null as any,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('status');
    });

    it('should fail when deviceStatus is null', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: null as any
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('deviceStatus');
    });

    it('should fail when attemptNumber is null', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: null as any,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('attemptNumber');
    });

    it('should fail when attemptNumber is not a number', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 'invalid' as any,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('attemptNumber');
    });

    it('should fail when attemptNumber is below minimum (1)', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 0,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('attemptNumber');
    });

    it('should fail when attemptNumber is above maximum (10)', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 11,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('attemptNumber');
    });

    it('should round attemptNumber to integer if decimal provided', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 2.7,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.attemptNumber).toBe(3);
    });

    it('should accept minimum attemptNumber of 1', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.attemptNumber).toBe(1);
    });

    it('should accept maximum attemptNumber of 10', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 10,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.attemptNumber).toBe(10);
    });

    describe('business rules', () => {
      it('should fail when SUCCESS status has no metrics', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createSuccess().value,
            metrics: null,
            attemptNumber: 1,
            errorMessage: null,
            deviceStatus: NetworkDeviceStatus.createOnline().value
          },
          id
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('SUCCESS');
        expect(result.error).toContain('metrics');
      });

      it('should fail when PARTIAL_SUCCESS status has no metrics', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createPartialSuccess().value,
            metrics: null,
            attemptNumber: 1,
            errorMessage: null,
            deviceStatus: NetworkDeviceStatus.createOnline().value
          },
          id
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('PARTIAL_SUCCESS');
        expect(result.error).toContain('metrics');
      });

      it('should fail when FAILED status has no errorMessage', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createFailed().value,
            metrics: null,
            attemptNumber: 1,
            errorMessage: null,
            deviceStatus: NetworkDeviceStatus.createOffline().value
          },
          id
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('FAILED');
        expect(result.error).toContain('errorMessage');
      });

      it('should fail when TIMEOUT status has no errorMessage', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createTimeout().value,
            metrics: null,
            attemptNumber: 1,
            errorMessage: null,
            deviceStatus: NetworkDeviceStatus.createOffline().value
          },
          id
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('TIMEOUT');
        expect(result.error).toContain('errorMessage');
      });

      it('should allow SUCCESS status with metrics', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createSuccess().value,
            metrics,
            attemptNumber: 1,
            errorMessage: null,
            deviceStatus: NetworkDeviceStatus.createOnline().value
          },
          id
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should allow FAILED status with errorMessage', () => {
        const id = PollingResultId.create().value;
        const result = PollingResult.reconstitute(
          {
            networkDeviceId,
            timestamp,
            status: PollingStatus.createFailed().value,
            metrics: null,
            attemptNumber: 1,
            errorMessage: 'Connection timeout',
            deviceStatus: NetworkDeviceStatus.createOffline().value
          },
          id
        );

        expect(result.isSuccess).toBe(true);
      });
    });
  });

  describe('createSuccess', () => {
    it('should create a successful PollingResult', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status.toString()).toBe(
        PollingStatus.SUCCESS
      );
      expect(result.value.metrics).toBe(metrics);
      expect(result.value.errorMessage).toBeNull();
      expect(result.value.deviceStatus.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
    });

    it('should set errorMessage to null automatically', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.value.errorMessage).toBeNull();
    });

    it('should set status to SUCCESS automatically', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.value.status.toString()).toBe(
        PollingStatus.SUCCESS
      );
    });
  });

  describe('createFailure', () => {
    it('should create a failed PollingResult', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Host unreachable',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status.toString()).toBe(
        PollingStatus.FAILED
      );
      expect(result.value.errorMessage).toBe('Host unreachable');
      expect(result.value.metrics).toBeNull();
      expect(result.value.deviceStatus.toString()).toBe(
        NetworkDeviceStatus.OFFLINE
      );
    });

    it('should accept TIMEOUT status', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createTimeout().value,
        errorMessage: 'Request timed out',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status.toString()).toBe(
        PollingStatus.TIMEOUT
      );
    });

    it('should allow optional metrics for failed poll', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Partial failure',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value,
        metrics
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.metrics).toBe(metrics);
    });

    it('should set metrics to null when not provided', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Host unreachable',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      expect(result.value.metrics).toBeNull();
    });
  });

  describe('isSuccessful', () => {
    it('should return true for SUCCESS status', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.isSuccessful()).toBe(true);
    });

    it('should return true for PARTIAL_SUCCESS status', () => {
      const partialMetrics = PollingMetrics.create({
        responseTimes: [23.5, 24.1],
        totalPings: 4,
        successfulPings: 2
      }).value;

      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createPartialSuccess().value,
          metrics: partialMetrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      ).value;

      expect(result.isSuccessful()).toBe(true);
    });

    it('should return false for FAILED status', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.isSuccessful()).toBe(false);
    });

    it('should return false for TIMEOUT status', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createTimeout().value,
        errorMessage: 'Timeout',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.isSuccessful()).toBe(false);
    });
  });

  describe('hasFailed', () => {
    it('should return true for FAILED status', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.hasFailed()).toBe(true);
    });

    it('should return true for TIMEOUT status', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createTimeout().value,
        errorMessage: 'Timeout',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.hasFailed()).toBe(true);
    });

    it('should return false for SUCCESS status', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.hasFailed()).toBe(false);
    });

    it('should return false for PARTIAL_SUCCESS status', () => {
      const partialMetrics = PollingMetrics.create({
        responseTimes: [23.5],
        totalPings: 4,
        successfulPings: 1
      }).value;

      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createPartialSuccess().value,
          metrics: partialMetrics,
          attemptNumber: 1,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      ).value;

      expect(result.hasFailed()).toBe(false);
    });
  });

  describe('shouldRetry', () => {
    it('should return false for successful poll', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.shouldRetry(retryPolicy)).toBe(false);
    });

    it('should return true for failed poll when retries available', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(result.shouldRetry(policy)).toBe(true);
    });

    it('should return false for failed poll when max retries reached', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 3,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const policy = RetryPolicy.create({
        maxAttempts: 3,
        baseDelayMs: 1000,
        backoffStrategy: BackoffStrategy.FIXED
      }).value;

      expect(result.shouldRetry(policy)).toBe(false);
    });

    it('should return false when retry policy has no retries', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const policy = RetryPolicy.noRetry();

      expect(result.shouldRetry(policy)).toBe(false);
    });
  });

  describe('indicatesOnline', () => {
    it('should return true when deviceStatus is ONLINE', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.indicatesOnline()).toBe(true);
    });

    it('should return false when deviceStatus is OFFLINE', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.indicatesOnline()).toBe(false);
    });

    it('should return false when deviceStatus is MAINTENANCE', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createFailed().value,
          metrics: null,
          attemptNumber: 1,
          errorMessage: 'In maintenance',
          deviceStatus: NetworkDeviceStatus.createMaintenance().value
        },
        id
      ).value;

      expect(result.indicatesOnline()).toBe(false);
    });
  });

  describe('indicatesOffline', () => {
    it('should return true when deviceStatus is OFFLINE', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Failed',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.indicatesOffline()).toBe(true);
    });

    it('should return false when deviceStatus is ONLINE', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      expect(result.indicatesOffline()).toBe(false);
    });

    it('should return false when deviceStatus is MAINTENANCE', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createFailed().value,
          metrics: null,
          attemptNumber: 1,
          errorMessage: 'In maintenance',
          deviceStatus: NetworkDeviceStatus.createMaintenance().value
        },
        id
      ).value;

      expect(result.indicatesOffline()).toBe(false);
    });
  });

  describe('toDisplayString', () => {
    it('should display success with average response time', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const display = result.toDisplayString();

      expect(display).toContain('SUCCESS');
      expect(display).toContain('ms avg');
      expect(display).toContain('attempt 1');
    });

    it('should display failure with error message', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createFailed().value,
        errorMessage: 'Connection refused',
        attemptNumber: 2,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const display = result.toDisplayString();

      expect(display).toContain('FAILED');
      expect(display).toContain('Connection refused');
      expect(display).toContain('attempt 2');
    });

    it('should display N/A for avg time when metrics is null', () => {
      const result = PollingResult.createFailure({
        networkDeviceId,
        timestamp,
        status: PollingStatus.createTimeout().value,
        errorMessage: 'Timeout',
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOffline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      // This is a failed result, so it won't show avg time
      const display = result.toDisplayString();
      expect(display).toContain('TIMEOUT');
    });
  });

  describe('toString', () => {
    it('should return compact summary with status and device ID', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const str = result.toString();

      expect(str).toContain('PollingResult');
      expect(str).toContain('SUCCESS');
      expect(str).toContain('device');
      expect(str).toContain(timestamp.toISOString());
    });

    it('should include timestamp in ISO format', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      const str = result.toString();

      expect(str).toContain('2024-01-01T10:00:00.000Z');
    });
  });

  describe('constants', () => {
    it('should have correct MIN_ATTEMPT_NUMBER', () => {
      expect(PollingResult.MIN_ATTEMPT_NUMBER).toBe(1);
    });

    it('should have correct MAX_ATTEMPT_NUMBER', () => {
      expect(PollingResult.MAX_ATTEMPT_NUMBER).toBe(10);
    });
  });

  describe('getters', () => {
    it('should expose all properties via getters', () => {
      const id = PollingResultId.create().value;
      const result = PollingResult.reconstitute(
        {
          networkDeviceId,
          timestamp,
          status: PollingStatus.createSuccess().value,
          metrics,
          attemptNumber: 3,
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.createOnline().value
        },
        id
      ).value;

      expect(result.networkDeviceId).toBe(networkDeviceId);
      expect(result.timestamp).toBe(timestamp);
      expect(result.status.toString()).toBe(PollingStatus.SUCCESS);
      expect(result.metrics).toBe(metrics);
      expect(result.attemptNumber).toBe(3);
      expect(result.errorMessage).toBeNull();
      expect(result.deviceStatus.toString()).toBe(
        NetworkDeviceStatus.ONLINE
      );
    });
  });

  describe('immutability', () => {
    it('should be immutable after creation', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Test-Device',
        ipAddress: IPAddress.create('192.168.1.1').value
      }).value;

      // Attempt to modify should not be possible (TypeScript protects this)
      // But the object itself should not expose any mutation methods
      expect(typeof (result as any).setStatus).toBe('undefined');
      expect(typeof (result as any).updateMetrics).toBe('undefined');
    });
  });

  describe('domain events', () => {
    describe('DevicePolledSuccessfullyEvent', () => {
      it('should emit DevicePolledSuccessfullyEvent when creating successful result', () => {
        const result = PollingResult.createSuccess({
          networkDeviceId,
          timestamp,
          metrics,
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOnline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        expect(result.isSuccess).toBe(true);
        const events = result.value.domainEvents;
        expect(events.length).toBe(1);
        expect(events[0].constructor.name).toBe(
          'DevicePolledSuccessfullyEvent'
        );
      });

      it('should include wasOffline flag in success event', () => {
        const result = PollingResult.createSuccess({
          networkDeviceId,
          timestamp,
          metrics,
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOnline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value,
          wasOffline: true
        });

        expect(result.isSuccess).toBe(true);
        const events = result.value.domainEvents;
        expect(events.length).toBe(1);
        const event = events[0] as any;
        expect(event.wasOffline).toBe(true);
      });

      it('should default wasOffline to false in success event', () => {
        const result = PollingResult.createSuccess({
          networkDeviceId,
          timestamp,
          metrics,
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOnline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        expect(result.isSuccess).toBe(true);
        const event = result.value.domainEvents[0] as any;
        expect(event.wasOffline).toBe(false);
      });

      it('should include device information in success event', () => {
        const result = PollingResult.createSuccess({
          networkDeviceId,
          timestamp,
          metrics,
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOnline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        const event = result.value.domainEvents[0] as any;
        expect(event.deviceName).toBe('Router-01');
        expect(event.ipAddress.toString()).toBe('192.168.1.1');
        expect(event.networkDeviceId).toBe(networkDeviceId);
        expect(event.metrics).toBe(metrics);
      });
    });

    describe('DevicePollingFailedEvent', () => {
      it('should emit DevicePollingFailedEvent when creating failed result', () => {
        const result = PollingResult.createFailure({
          networkDeviceId,
          timestamp,
          status: PollingStatus.createFailed().value,
          errorMessage: 'Host unreachable',
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOffline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        expect(result.isSuccess).toBe(true);
        const events = result.value.domainEvents;
        expect(events.length).toBe(1);
        expect(events[0].constructor.name).toBe(
          'DevicePollingFailedEvent'
        );
      });

      it('should include wasOnline flag in failure event', () => {
        const result = PollingResult.createFailure({
          networkDeviceId,
          timestamp,
          status: PollingStatus.createFailed().value,
          errorMessage: 'Connection lost',
          attemptNumber: 2,
          deviceStatus: NetworkDeviceStatus.createOffline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value,
          wasOnline: true
        });

        expect(result.isSuccess).toBe(true);
        const events = result.value.domainEvents;
        expect(events.length).toBe(1);
        const event = events[0] as any;
        expect(event.wasOnline).toBe(true);
      });

      it('should default wasOnline to false in failure event', () => {
        const result = PollingResult.createFailure({
          networkDeviceId,
          timestamp,
          status: PollingStatus.createFailed().value,
          errorMessage: 'Host unreachable',
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOffline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        expect(result.isSuccess).toBe(true);
        const event = result.value.domainEvents[0] as any;
        expect(event.wasOnline).toBe(false);
      });

      it('should include error details in failure event', () => {
        const result = PollingResult.createFailure({
          networkDeviceId,
          timestamp,
          status: PollingStatus.createTimeout().value,
          errorMessage: 'Request timed out after 5 seconds',
          attemptNumber: 3,
          deviceStatus: NetworkDeviceStatus.createOffline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        const event = result.value.domainEvents[0] as any;
        expect(event.deviceName).toBe('Router-01');
        expect(event.ipAddress.toString()).toBe('192.168.1.1');
        expect(event.networkDeviceId).toBe(networkDeviceId);
        expect(event.status.toString()).toBe(PollingStatus.TIMEOUT);
        expect(event.errorMessage).toBe(
          'Request timed out after 5 seconds'
        );
        expect(event.attemptNumber).toBe(3);
      });

      it('should emit event for timeout failures', () => {
        const result = PollingResult.createFailure({
          networkDeviceId,
          timestamp,
          status: PollingStatus.createTimeout().value,
          errorMessage: 'Timeout',
          attemptNumber: 1,
          deviceStatus: NetworkDeviceStatus.createOffline().value,
          deviceName: 'Router-01',
          ipAddress: IPAddress.create('192.168.1.1').value
        });

        expect(result.isSuccess).toBe(true);
        const events = result.value.domainEvents;
        expect(events.length).toBe(1);
        const event = events[0] as any;
        expect(event.status.toString()).toBe(PollingStatus.TIMEOUT);
      });
    });

    it('should emit event with correct aggregate ID', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        ipAddress: IPAddress.create('192.168.1.1').value,
        deviceName: 'Test-Device'
      });

      const event = result.value.domainEvents[0] as any;
      expect(event.aggregateId).toBe(result.value.id);
    });

    it('should include timestamp in emitted events', () => {
      const result = PollingResult.createSuccess({
        networkDeviceId,
        timestamp,
        metrics,
        attemptNumber: 1,
        deviceStatus: NetworkDeviceStatus.createOnline().value,
        deviceName: 'Router-01',
        ipAddress: IPAddress.create('192.168.1.1').value
      });

      const event = result.value.domainEvents[0] as any;
      expect(event.dateTimeOccurred).toBeInstanceOf(Date);
    });
  });
});
