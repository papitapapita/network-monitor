// Source: src/infrastructure/logging/WinstonLogger.ts

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Winston mock — must be declared before any import that pulls in winston
// ---------------------------------------------------------------------------

const mockDebug  = jest.fn();
const mockInfo   = jest.fn();
const mockWarn   = jest.fn();
const mockError  = jest.fn();
const mockAdd    = jest.fn();

// Mutable reference so tests can inspect the level property
const mockWinstonLogger = {
  debug:  mockDebug,
  info:   mockInfo,
  warn:   mockWarn,
  error:  mockError,
  add:    mockAdd,
  level:  'info'
};

const mockCreateLogger  = jest.fn(() => mockWinstonLogger);
const mockConsoleCtor   = jest.fn();
const mockFileCtor      = jest.fn();
const mockTimestamp     = jest.fn(() => ({}));
const mockErrors        = jest.fn(() => ({}));
const mockJson          = jest.fn(() => ({}));
const mockColorize      = jest.fn(() => ({}));
const mockPrintf        = jest.fn(() => ({}));
const mockCombine       = jest.fn(() => ({}));

jest.mock('winston', () => ({
  __esModule: true,
  default: {
    createLogger: mockCreateLogger,
    format: {
      combine:   mockCombine,
      timestamp: mockTimestamp,
      errors:    mockErrors,
      json:      mockJson,
      colorize:  mockColorize,
      printf:    mockPrintf
    },
    transports: {
      Console: mockConsoleCtor,
      File:    mockFileCtor
    }
  }
}));

// ---------------------------------------------------------------------------
// Subject under test (imported AFTER the mock is established)
// ---------------------------------------------------------------------------

import { WinstonLogger } from '../../../src/infrastructure/logging/WinstonLogger';
import { LogLevel }      from '../../../src/application/shared/interfaces/ILogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalNodeEnv = process.env.NODE_ENV;

function makeLogger(context: Record<string, unknown> = {}): WinstonLogger {
  return new WinstonLogger(context);
}

// ---------------------------------------------------------------------------

describe('WinstonLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mutable level field between tests
    mockWinstonLogger.level = 'info';
    // Restore env for each test unless overridden
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // =========================================================================
  describe('constructor', () => {
    // -----------------------------------------------------------------------
    describe('winston.createLogger initialisation', () => {
      it('should call winston.createLogger exactly once', () => {
        makeLogger();

        expect(mockCreateLogger).toHaveBeenCalledTimes(1);
      });

      it('should pass defaultMeta equal to the provided context', () => {
        const ctx = { service: 'api', version: '1.0' };
        makeLogger(ctx);

        const callArg = (mockCreateLogger.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0][0];
        expect(callArg.defaultMeta).toEqual(ctx);
      });

      it('should pass an empty object as defaultMeta when no context is provided', () => {
        makeLogger();

        const callArg = (mockCreateLogger.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0][0];
        expect(callArg.defaultMeta).toEqual({});
      });

      it('should include exactly one Console transport in non-production', () => {
        makeLogger();

        const callArg = (mockCreateLogger.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0][0];
        const transports = callArg.transports as unknown[];
        expect(transports).toHaveLength(1);
      });

      it('should instantiate winston.transports.Console', () => {
        makeLogger();

        expect(mockConsoleCtor).toHaveBeenCalledTimes(1);
      });
    });

    // -----------------------------------------------------------------------
    describe('production file transports', () => {
      it('should not call logger.add in non-production environments', () => {
        process.env.NODE_ENV = 'test';
        makeLogger();

        expect(mockAdd).not.toHaveBeenCalled();
      });

      it('should call logger.add exactly twice in production', () => {
        process.env.NODE_ENV = 'production';
        makeLogger();

        expect(mockAdd).toHaveBeenCalledTimes(2);
      });

      it('should add an error file transport in production', () => {
        process.env.NODE_ENV = 'production';
        makeLogger();

        expect(mockFileCtor).toHaveBeenCalledWith(
          expect.objectContaining({ filename: 'logs/error.log', level: 'error' })
        );
      });

      it('should add a combined file transport in production', () => {
        process.env.NODE_ENV = 'production';
        makeLogger();

        expect(mockFileCtor).toHaveBeenCalledWith(
          expect.objectContaining({ filename: 'logs/combined.log' })
        );
      });

      it('should instantiate winston.transports.File twice in production', () => {
        process.env.NODE_ENV = 'production';
        makeLogger();

        expect(mockFileCtor).toHaveBeenCalledTimes(2);
      });
    });
  });

  // =========================================================================
  describe('debug()', () => {
    it('should call the underlying logger.debug with the message', () => {
      const logger = makeLogger();
      logger.debug('debug message');

      expect(mockDebug).toHaveBeenCalledWith('debug message', expect.any(Object));
    });

    it('should merge the instance context into the log call', () => {
      const logger = makeLogger({ service: 'worker' });
      logger.debug('trace event');

      expect(mockDebug).toHaveBeenCalledWith(
        'trace event',
        expect.objectContaining({ service: 'worker' })
      );
    });

    it('should merge the call-site context into the log call', () => {
      const logger = makeLogger();
      logger.debug('trace event', { requestId: 'abc' });

      expect(mockDebug).toHaveBeenCalledWith(
        'trace event',
        expect.objectContaining({ requestId: 'abc' })
      );
    });

    it('should merge both instance context and call-site context', () => {
      const logger = makeLogger({ service: 'worker' });
      logger.debug('trace event', { requestId: 'abc' });

      expect(mockDebug).toHaveBeenCalledWith(
        'trace event',
        expect.objectContaining({ service: 'worker', requestId: 'abc' })
      );
    });
  });

  // =========================================================================
  describe('info()', () => {
    it('should call the underlying logger.info with the message', () => {
      const logger = makeLogger();
      logger.info('info message');

      expect(mockInfo).toHaveBeenCalledWith('info message', expect.any(Object));
    });

    it('should merge the instance context into the log call', () => {
      const logger = makeLogger({ env: 'staging' });
      logger.info('started');

      expect(mockInfo).toHaveBeenCalledWith(
        'started',
        expect.objectContaining({ env: 'staging' })
      );
    });

    it('should merge the call-site context into the log call', () => {
      const logger = makeLogger();
      logger.info('user logged in', { userId: '42' });

      expect(mockInfo).toHaveBeenCalledWith(
        'user logged in',
        expect.objectContaining({ userId: '42' })
      );
    });
  });

  // =========================================================================
  describe('warn()', () => {
    it('should call the underlying logger.warn with the message', () => {
      const logger = makeLogger();
      logger.warn('warn message');

      expect(mockWarn).toHaveBeenCalledWith('warn message', expect.any(Object));
    });

    it('should merge the instance context into the log call', () => {
      const logger = makeLogger({ module: 'scheduler' });
      logger.warn('retry attempt');

      expect(mockWarn).toHaveBeenCalledWith(
        'retry attempt',
        expect.objectContaining({ module: 'scheduler' })
      );
    });

    it('should merge the call-site context into the log call', () => {
      const logger = makeLogger();
      logger.warn('slow query', { duration: 5000 });

      expect(mockWarn).toHaveBeenCalledWith(
        'slow query',
        expect.objectContaining({ duration: 5000 })
      );
    });
  });

  // =========================================================================
  describe('error()', () => {
    it('should call the underlying logger.error with the message', () => {
      const logger = makeLogger();
      logger.error('something failed');

      expect(mockError).toHaveBeenCalledWith(
        'something failed',
        expect.any(Object)
      );
    });

    it('should include a serialised error object when an Error is provided', () => {
      const logger = makeLogger();
      const err = new Error('disk full');
      logger.error('write failed', err);

      expect(mockError).toHaveBeenCalledWith(
        'write failed',
        expect.objectContaining({
          error: {
            message: 'disk full',
            stack:   err.stack,
            name:    'Error'
          }
        })
      );
    });

    it('should set error to undefined when no Error argument is given', () => {
      const logger = makeLogger();
      logger.error('write failed');

      expect(mockError).toHaveBeenCalledWith(
        'write failed',
        expect.objectContaining({ error: undefined })
      );
    });

    it('should include the error name from a custom Error subclass', () => {
      class DatabaseError extends Error {
        constructor(msg: string) {
          super(msg);
          this.name = 'DatabaseError';
        }
      }

      const logger = makeLogger();
      const err = new DatabaseError('connection refused');
      logger.error('db unavailable', err);

      expect(mockError).toHaveBeenCalledWith(
        'db unavailable',
        expect.objectContaining({
          error: expect.objectContaining({ name: 'DatabaseError' })
        })
      );
    });

    it('should merge the instance context into the log call', () => {
      const logger = makeLogger({ service: 'api' });
      logger.error('handler failed');

      expect(mockError).toHaveBeenCalledWith(
        'handler failed',
        expect.objectContaining({ service: 'api' })
      );
    });

    it('should merge the call-site context into the log call', () => {
      const logger = makeLogger();
      logger.error('handler failed', undefined, { route: '/devices' });

      expect(mockError).toHaveBeenCalledWith(
        'handler failed',
        expect.objectContaining({ route: '/devices' })
      );
    });
  });

  // =========================================================================
  describe('fatal()', () => {
    it('should delegate to the underlying logger.error (not a separate level)', () => {
      const logger = makeLogger();
      logger.fatal('system crash');

      expect(mockError).toHaveBeenCalledWith(
        'system crash',
        expect.any(Object)
      );
    });

    it('should include level: "fatal" in the metadata', () => {
      const logger = makeLogger();
      logger.fatal('system crash');

      expect(mockError).toHaveBeenCalledWith(
        'system crash',
        expect.objectContaining({ level: 'fatal' })
      );
    });

    it('should include a serialised error object when an Error is provided', () => {
      const logger = makeLogger();
      const err = new Error('out of memory');
      logger.fatal('process terminated', err);

      expect(mockError).toHaveBeenCalledWith(
        'process terminated',
        expect.objectContaining({
          error: {
            message: 'out of memory',
            stack:   err.stack,
            name:    'Error'
          }
        })
      );
    });

    it('should set error to undefined when no Error argument is given', () => {
      const logger = makeLogger();
      logger.fatal('process terminated');

      expect(mockError).toHaveBeenCalledWith(
        'process terminated',
        expect.objectContaining({ error: undefined })
      );
    });

    it('should merge the instance context into the log call', () => {
      const logger = makeLogger({ pod: 'pod-1' });
      logger.fatal('oom killed');

      expect(mockError).toHaveBeenCalledWith(
        'oom killed',
        expect.objectContaining({ pod: 'pod-1' })
      );
    });

    it('should merge the call-site context into the log call', () => {
      const logger = makeLogger();
      logger.fatal('oom killed', undefined, { node: 'node-3' });

      expect(mockError).toHaveBeenCalledWith(
        'oom killed',
        expect.objectContaining({ node: 'node-3' })
      );
    });
  });

  // =========================================================================
  describe('child()', () => {
    it('should return a new WinstonLogger instance', () => {
      const parent = makeLogger({ service: 'api' });
      const child  = parent.child({ requestId: 'xyz' });

      expect(child).toBeInstanceOf(WinstonLogger);
    });

    it('should not return the same instance as the parent', () => {
      const parent = makeLogger({ service: 'api' });
      const child  = parent.child({ requestId: 'xyz' });

      expect(child).not.toBe(parent);
    });

    it('should create a new underlying winston logger for the child', () => {
      const parent = makeLogger();
      jest.clearAllMocks();

      parent.child({ requestId: 'xyz' });

      expect(mockCreateLogger).toHaveBeenCalledTimes(1);
    });

    it('should merge parent context into the child logger', () => {
      const parent = makeLogger({ service: 'api' });
      jest.clearAllMocks();

      parent.child({ requestId: 'xyz' });

      const callArg = (mockCreateLogger.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0][0];
      expect(callArg.defaultMeta).toEqual(
        expect.objectContaining({ service: 'api' })
      );
    });

    it('should include the child-specific context in the child logger', () => {
      const parent = makeLogger({ service: 'api' });
      jest.clearAllMocks();

      parent.child({ requestId: 'xyz' });

      const callArg = (mockCreateLogger.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[0][0];
      expect(callArg.defaultMeta).toEqual(
        expect.objectContaining({ requestId: 'xyz' })
      );
    });

    it('should have the merged context appear in subsequent log calls on the child', () => {
      const parent = makeLogger({ service: 'api' });
      const child  = parent.child({ requestId: 'xyz' });
      jest.clearAllMocks();

      child.info('request received');

      expect(mockInfo).toHaveBeenCalledWith(
        'request received',
        expect.objectContaining({ service: 'api', requestId: 'xyz' })
      );
    });

    it('should allow child context to override parent context for the same key', () => {
      const parent = makeLogger({ service: 'api' });
      const child  = parent.child({ service: 'worker' });
      jest.clearAllMocks();

      child.info('processing');

      expect(mockInfo).toHaveBeenCalledWith(
        'processing',
        expect.objectContaining({ service: 'worker' })
      );
    });
  });

  // =========================================================================
  describe('setLevel()', () => {
    it('should update the underlying winston logger level', () => {
      const logger = makeLogger();
      logger.setLevel(LogLevel.DEBUG);

      expect(mockWinstonLogger.level).toBe('debug');
    });

    it('should update the level to warn', () => {
      const logger = makeLogger();
      logger.setLevel(LogLevel.WARN);

      expect(mockWinstonLogger.level).toBe('warn');
    });

    it('should update the level to error', () => {
      const logger = makeLogger();
      logger.setLevel(LogLevel.ERROR);

      expect(mockWinstonLogger.level).toBe('error');
    });

    it('should update the level to info', () => {
      const logger = makeLogger();
      logger.setLevel(LogLevel.INFO);

      expect(mockWinstonLogger.level).toBe('info');
    });

    it('should update the level to fatal', () => {
      const logger = makeLogger();
      logger.setLevel(LogLevel.FATAL);

      expect(mockWinstonLogger.level).toBe('fatal');
    });
  });
});
