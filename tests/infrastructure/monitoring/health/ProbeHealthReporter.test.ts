// Source: src/infrastructure/monitoring/health/ProbeHealthReporter.ts

import { ProbeHealthReporter } from '../../../../src/infrastructure/monitoring/health/ProbeHealthReporter';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  } as unknown as jest.Mocked<ILogger>;
}

const DEVICE_A = 'device-a';
const DEVICE_B = 'device-b';
const DEVICE_C = 'device-c';

describe('ProbeHealthReporter', () => {
  let logger: jest.Mocked<ILogger>;
  let reporter: ProbeHealthReporter;

  beforeEach(() => {
    logger = makeLogger();
    reporter = new ProbeHealthReporter(logger, {
      degradedDeviceThreshold: 3,
      windowMs: 60_000
    });
  });

  describe('below the threshold', () => {
    it('should not report degradation for a single failing device', () => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should not report degradation for repeated failures of the same device', () => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('reaching the threshold', () => {
    it('should report degradation once enough distinct devices fail', () => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][0]).toContain(
        'Device monitoring degraded'
      );
    });

    it('should include the affected device count', () => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');

      expect(logger.error.mock.calls[0][2]).toMatchObject({
        affectedDevices: 3
      });
    });

    it('should not repeat the alert while it stays degraded', () => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');

      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('recovery', () => {
    beforeEach(() => {
      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');
    });

    it('should not announce recovery while devices are still failing', () => {
      reporter.recordProbeExecuted(DEVICE_A);

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should announce recovery once every device probes again', () => {
      reporter.recordProbeExecuted(DEVICE_A);
      reporter.recordProbeExecuted(DEVICE_B);
      reporter.recordProbeExecuted(DEVICE_C);

      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info.mock.calls[0][0]).toContain(
        'Device monitoring recovered'
      );
    });

    it('should be able to report degradation again after recovering', () => {
      reporter.recordProbeExecuted(DEVICE_A);
      reporter.recordProbeExecuted(DEVICE_B);
      reporter.recordProbeExecuted(DEVICE_C);

      reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');
      reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');

      expect(logger.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('window expiry', () => {
    it('should forget failures older than the window', () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-07-22T10:00:00.000Z'));
        reporter.recordProbeExecutionFailure(DEVICE_A, 'spawn ENOENT');
        reporter.recordProbeExecutionFailure(DEVICE_B, 'spawn ENOENT');

        jest.setSystemTime(new Date('2026-07-22T10:05:00.000Z'));
        reporter.recordProbeExecutionFailure(DEVICE_C, 'spawn ENOENT');

        expect(logger.error).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
