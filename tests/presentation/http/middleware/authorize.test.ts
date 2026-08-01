// Source: src/presentation/http/middleware/authorize.ts

import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../../../src/presentation/http/middleware/authorize';
import { Permission } from '../../../../src/domain/identity/permissions/Permission';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const createMockRequest = (
  user?: Request['user']
): Partial<Request> => ({ user });

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

// ---------------------------------------------------------------------------

describe('authorize middleware', () => {
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('when req.user is not set', () => {
    it('should return 401 when req.user is undefined', () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest(undefined);

      authorize('read')(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should not call next() when req.user is undefined', () => {
      const { res } = createMockResponse();
      const req = createMockRequest(undefined);

      authorize('read')(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when the role has all required permissions', () => {
    it('should call next() when ADMIN requests a read permission', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u1',
        email: 'admin@example.com',
        role: 'ADMIN'
      });

      authorize('read')(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() when ADMIN requests delete permission', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u1',
        email: 'admin@example.com',
        role: 'ADMIN'
      });

      authorize('delete')(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('[DEV-144] should call next() when ADMIN requests manage-credentials', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u1',
        email: 'admin@example.com',
        role: 'ADMIN'
      });

      authorize('manage-credentials')(
        req as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() when OPERATOR requests create permission', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u2',
        email: 'ops@example.com',
        role: 'OPERATOR'
      });

      authorize('create')(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() when VIEWER requests read permission', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u3',
        email: 'view@example.com',
        role: 'VIEWER'
      });

      authorize('read')(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should call next() when ADMIN has all of multiple required permissions', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u1',
        email: 'admin@example.com',
        role: 'ADMIN'
      });

      authorize('read', 'delete', 'bulk-import')(
        req as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should not call res.status() when access is granted', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u1',
        email: 'admin@example.com',
        role: 'ADMIN'
      });

      authorize('read')(req as Request, res as Response, mockNext);

      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when the role lacks a required permission', () => {
    it('should return 403 when OPERATOR requests delete', () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u2',
        email: 'ops@example.com',
        role: 'OPERATOR'
      });

      authorize('delete')(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden'
      });
    });

    it('should return 403 when VIEWER requests create', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u3',
        email: 'view@example.com',
        role: 'VIEWER'
      });

      authorize('create')(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return 403 when VIEWER requests update', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u3',
        email: 'view@example.com',
        role: 'VIEWER'
      });

      authorize('update')(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('[DEV-144] should return 403 when OPERATOR requests manage-credentials', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u2',
        email: 'ops@example.com',
        role: 'OPERATOR'
      });

      authorize('manage-credentials')(
        req as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return 403 when OPERATOR has some but not all required permissions', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u2',
        email: 'ops@example.com',
        role: 'OPERATOR'
      });

      authorize('create', 'delete')(req as Request, res as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should not call next() when access is denied', () => {
      const { res } = createMockResponse();
      const req = createMockRequest({
        userId: 'u3',
        email: 'view@example.com',
        role: 'VIEWER'
      });

      authorize('delete')(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when the role is unknown', () => {
    it('should return 403 for an unrecognised role', () => {
      const { res, statusMock } = createMockResponse();
      const req = createMockRequest({
        userId: 'u9',
        email: 'ghost@example.com',
        role: 'SUPERUSER'
      });

      authorize('read' as Permission)(
        req as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });
});
