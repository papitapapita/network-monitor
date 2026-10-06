// Source: src/presentation/http/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import {
  createAuthenticateMiddleware,
  CROSS_SITE_REFUSED
} from '../../../../src/presentation/http/middleware/authenticate';
import {
  ITokenService,
  TokenPayload
} from '../../../../src/application/identity/interfaces/ITokenService';
import { Result } from '../../../../src/domain/shared/core/Result';
import {
  AuthenticatedUser,
  SessionValidator
} from '../../../../src/application/identity/services/SessionValidator';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTokenService(): jest.Mocked<ITokenService> {
  return {
    sign: jest.fn(),
    verify: jest.fn(),
    signChallenge: jest.fn(),
    verifyChallenge: jest.fn()
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
  role: 'OPERATOR',
  tokenVersion: 0
};

// What the account says now — the role changed since the token was signed.
const SESSION_USER: AuthenticatedUser = {
  userId: 'user-uuid-123',
  email: 'alice@example.com',
  role: 'ADMIN'
};

function makeSessions(): jest.Mocked<
  Pick<SessionValidator, 'validate'>
> {
  return {
    validate: jest.fn().mockResolvedValue(Result.ok(SESSION_USER))
  };
}

// ---------------------------------------------------------------------------

describe('createAuthenticateMiddleware', () => {
  let tokenService: jest.Mocked<ITokenService>;
  let sessions: jest.Mocked<Pick<SessionValidator, 'validate'>>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    tokenService = makeTokenService();
    sessions = makeSessions();
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('when Authorization header is missing', () => {
    it('should return 401 when Authorization header is absent', async () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should not call next() when Authorization header is absent', async () => {
      const { res } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call tokenService.verify when header is absent', async () => {
      const { res } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe("when Authorization header does not start with 'Bearer '", () => {
    it('should return 401 for a Basic auth header', async () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Basic dXNlcjpwYXNz' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 401 for a header with "bearer " lowercase', async () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'bearer sometoken' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 401 for a raw token with no scheme prefix', async () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'rawtoken' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should not call next() when header scheme is wrong', async () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Token abc' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when tokenService.verify returns a failure', () => {
    it('should return 401 when token verification fails', async () => {
      tokenService.verify.mockReturnValue(
        Result.fail('token expired')
      );
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer expired.jwt.here' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
    });

    it('should not call next() when token is invalid', async () => {
      tokenService.verify.mockReturnValue(
        Result.fail('invalid signature')
      );
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer bad.token' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call tokenService.verify with the extracted token string', async () => {
      tokenService.verify.mockReturnValue(Result.fail('expired'));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer my.jwt.value' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).toHaveBeenCalledWith(
        'my.jwt.value'
      );
    });
  });

  // =========================================================================
  describe('when token is valid', () => {
    it('should call next() with no arguments on successful verification', async () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('[IDN-065] should attach the account as it is now, not the token claims', async () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(sessions.validate).toHaveBeenCalledWith(VALID_PAYLOAD);
      expect((req as Request).user).toEqual(SESSION_USER);
    });

    it('should not call res.status() on successful verification', async () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should extract the token after the "Bearer " prefix (7 chars)', async () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer header.payload.sig' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );

      await middleware(req as Request, res as Response, mockNext);

      expect(tokenService.verify).toHaveBeenCalledWith(
        'header.payload.sig'
      );
    });
  });

  // =========================================================================
  describe('[IDN-065] when the account no longer stands behind the token', () => {
    const run = async () => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid.jwt.token' }
      });
      const middleware = createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator
      );
      await middleware(req as Request, res as Response, mockNext);
      return { statusMock, jsonMock };
    };

    it('should answer 401 Invalid token', async () => {
      sessions.validate.mockResolvedValue(
        Result.fail('Invalid token')
      );

      const { statusMock, jsonMock } = await run();

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should answer 500 when the account cannot be checked', async () => {
      sessions.validate.mockResolvedValue(
        Result.fail('Failed to check session: db down')
      );

      const { statusMock, jsonMock } = await run();

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  // =========================================================================
  describe('session cookie', () => {
    const DASHBOARD = 'https://app.isp.example';

    const run = async (
      method: string,
      headers: Record<string, string>
    ) => {
      tokenService.verify.mockReturnValue(Result.ok(VALID_PAYLOAD));
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({ method, headers });
      await createAuthenticateMiddleware(
        tokenService,
        sessions as unknown as SessionValidator,
        [DASHBOARD]
      )(req as Request, res as Response, mockNext);
      return { statusMock, jsonMock };
    };

    it('[IDN-084] signs a read in with the cookie alone', async () => {
      await run('GET', { cookie: 'other=1; nms_session=cookie.jwt' });

      expect(tokenService.verify).toHaveBeenCalledWith('cookie.jwt');
      expect(mockNext).toHaveBeenCalled();
    });

    it('[IDN-084] prefers the Bearer header over the cookie', async () => {
      await run('GET', {
        authorization: 'Bearer header.jwt',
        cookie: 'nms_session=cookie.jwt'
      });

      expect(tokenService.verify).toHaveBeenCalledWith('header.jwt');
    });

    it('[IDN-085] accepts a change from an allowed dashboard', async () => {
      await run('POST', {
        cookie: 'nms_session=cookie.jwt',
        origin: DASHBOARD
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it.each([
      ['another site', { origin: 'https://evil.example' }],
      ['no Origin at all', {}]
    ])(
      '[IDN-085] refuses a cookie-signed change from %s',
      async (_label, extra) => {
        const { statusMock, jsonMock } = await run('DELETE', {
          cookie: 'nms_session=cookie.jwt',
          ...extra
        });

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: CROSS_SITE_REFUSED
        });
        expect(tokenService.verify).not.toHaveBeenCalled();
      }
    );

    it('[IDN-085] a Bearer change needs no Origin', async () => {
      await run('POST', { authorization: 'Bearer header.jwt' });

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
