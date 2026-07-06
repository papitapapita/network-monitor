// Source: src/presentation/http/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import { createAuthenticateMiddleware } from '../../../../src/presentation/http/middleware/authenticate';
import {
  ITokenService,
  TokenPayload
} from '../../../../src/application/identity/interfaces/ITokenService';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTokenService(): jest.Mocked<ITokenService> {
  return {
    sign: jest.fn(),
    verify: jest.fn()
  };
}

const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  headers: {},
  ...overrides
});

const createMockResponse = (): {
  res: Partial<Response>;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock } as Partial<Response>,
    statusMock,
    jsonMock
  };
};

const VALID_PAYLOAD: TokenPayload = {
  userId: 'user-uuid-123',
  email: 'alice@example.com',
  role: 'OPERATOR'
};

// ---------------------------------------------------------------------------

describe('createAuthenticateMiddleware', () => {
  let tokenService: jest.Mocked<ITokenService>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    tokenService = makeTokenService();
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('when Authorization header is missing', () => {
    it('should return 401 when Authorization header is absent', () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should not call next() when Authorization header is absent', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call tokenService.verify when header is absent', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe("when Authorization header does not start with 'Bearer '", () => {
    it('should return 401 for a Basic auth header', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Basic dXNlcjpwYXNz' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 401 for a header with "bearer " lowercase', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'bearer sometoken' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 401 for a raw token with no scheme prefix', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'rawtoken' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should not call next() when header scheme is wrong', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Token abc' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when tokenService.verify returns a failure', () => {
    it('should return 401 when token verification fails', () => {
      tokenService.verify.mockReturnValue(Result.fail('token expired'));
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer expired.jwt.here' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
    });

    it('should not call next() when token is invalid', () => {
      tokenService.verify.mockReturnValue(Result.fail('invalid signature'));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer bad.token' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call tokenService.verify with the extracted token string', () => {
      tokenService.verify.mockReturnValue(Result.fail('expired'));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer my.jwt.value' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).toHaveBeenCalledWith('my.jwt.value');
    });
  });

  // =========================================================================
  describe('when token is valid', () => {
    it('should call next() with no arguments on successful verification', () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should attach the token payload to req.user', () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect((req as Request).user).toEqual(VALID_PAYLOAD);
    });

    it('should not call res.status() on successful verification', () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should extract the token after the "Bearer " prefix (7 chars)', () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer header.payload.sig' }
      });
      const middleware = createAuthenticateMiddleware(tokenService);

      middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).toHaveBeenCalledWith('header.payload.sig');
    });
  });
});
