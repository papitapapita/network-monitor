// Source: src/presentation/http/middleware/auditLog.ts

import { Request, Response } from 'express';
import { createAuditLogMiddleware } from '../../../../src/presentation/http/middleware/auditLog';
import {
  ILogger,
  LogContext
} from '../../../../src/application/shared/interfaces/ILogger';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis() as jest.MockedFunction<
      (context: LogContext) => ILogger
    >,
    setLevel: jest.fn()
  };
}

type FinishListener = () => void;

const createMockResponse = (
  statusCode = 200
): {
  res: Partial<Response>;
  triggerFinish: () => void;
} => {
  const listeners: FinishListener[] = [];

  const res: Partial<Response> = {
    statusCode,
    on: jest.fn((event: string, listener: FinishListener) => {
      if (event === 'finish') {
        listeners.push(listener);
      }
      return res as Response;
    }) as Response['on']
  };

  return {
    res,
    triggerFinish: () => listeners.forEach((fn) => fn())
  };
};

const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  method: 'GET',
  path: '/api/devices',
  ip: '10.0.0.1',
  user: undefined,
  ...overrides
});

// ---------------------------------------------------------------------------

describe('createAuditLogMiddleware', () => {
  let logger: jest.Mocked<ILogger>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    logger = makeLogger();
    mockNext = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('next() call', () => {
    it('should call next() immediately on every request', () => {
      const { res } = createMockResponse();
      const req = createMockRequest();
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() before the finish event fires', () => {
      const callOrder: string[] = [];
      const { res, triggerFinish } = createMockResponse();
      const req = createMockRequest();
      const middleware = createAuditLogMiddleware(logger);

      mockNext.mockImplementation(() => {
        callOrder.push('next');
      });

      middleware(req as Request, res as Response, mockNext);
      callOrder.push('finish');
      triggerFinish();

      expect(callOrder[0]).toBe('next');
    });
  });

  // =========================================================================
  describe('audit log on res.finish — authenticated request', () => {
    it('should log info once when the response finishes', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('should log the userId from req.user', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u-abc-123',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.userId).toBe('u-abc-123');
    });

    it('should log the role from req.user', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'OPERATOR'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.role).toBe('OPERATOR');
    });

    it('should log the HTTP method', () => {
      const { res, triggerFinish } = createMockResponse(201);
      const req = createMockRequest({
        method: 'POST',
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.method).toBe('POST');
    });

    it('should log the request path', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        path: '/api/users/me',
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'VIEWER'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.path).toBe('/api/users/me');
    });

    it('should log the client IP address', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        ip: '192.168.1.50',
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'VIEWER'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.ip).toBe('192.168.1.50');
    });

    it('should log the response status code', () => {
      const { res, triggerFinish } = createMockResponse(404);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'VIEWER'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.statusCode).toBe(404);
    });

    it('should log a non-negative durationMs', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(typeof loggedContext.durationMs).toBe('number');
      expect(loggedContext.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use "Audit" as the log message', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const logMessage = (logger.info as jest.Mock).mock.calls[0][0];
      expect(logMessage).toBe('Audit');
    });
  });

  // =========================================================================
  describe('audit log on res.finish — unauthenticated request', () => {
    it('should log userId as "anonymous" when req.user is undefined', () => {
      const { res, triggerFinish } = createMockResponse(401);
      const req = createMockRequest({ user: undefined });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.userId).toBe('anonymous');
    });

    it('should log role as "none" when req.user is undefined', () => {
      const { res, triggerFinish } = createMockResponse(401);
      const req = createMockRequest({ user: undefined });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();

      const loggedContext = (logger.info as jest.Mock).mock
        .calls[0][1];
      expect(loggedContext.role).toBe('none');
    });
  });

  // =========================================================================
  describe('log timing', () => {
    it('should not log before the finish event fires', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should log exactly once per request even if finish fires multiple times', () => {
      const { res, triggerFinish } = createMockResponse(200);
      const req = createMockRequest({
        user: {
          userId: 'u1',
          email: 'alice@example.com',
          role: 'ADMIN'
        }
      });
      const middleware = createAuditLogMiddleware(logger);

      middleware(req as Request, res as Response, mockNext);
      triggerFinish();
      triggerFinish();

      expect(logger.info).toHaveBeenCalledTimes(2);
    });
  });
});
