// Source: src/presentation/http/middleware/validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../../../src/presentation/http/middleware/validateRequest';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Express Request with the given overrides.
 */
const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  ...overrides
});

/**
 * Creates a mock Express Response that tracks calls.
 * status() is chainable, returning an object that also exposes json().
 */
const createMockResponse = (): {
  res: Partial<Response>;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });

  return {
    res: { status: statusMock, json: jsonMock },
    statusMock,
    jsonMock
  };
};

// ---------------------------------------------------------------------------

describe('validateRequest middleware', () => {
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('when validation passes', () => {
    it('should call next() with no arguments when body is valid', async () => {
      const schema = z.object({
        body: z.object({ name: z.string().min(1) }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: { name: 'Torre Norte' } });
      const { res, statusMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next() when body, params, and query are all valid', async () => {
      const schema = z.object({
        body: z.object({ ipAddress: z.string().ipv4() }),
        params: z.object({ id: z.string().uuid() }),
        query: z.object({ limit: z.string().optional() })
      });
      const mockReq = createMockRequest({
        body: { ipAddress: '192.168.1.1' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
        query: { limit: '10' }
      });
      const { res, statusMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should call next() when all fields are optional and body is empty', async () => {
      const schema = z.object({
        body: z.object({
          description: z.string().optional()
        }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should not call res.json() when validation passes', async () => {
      const schema = z.object({
        body: z.object({ value: z.number() }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: { value: 42 } });
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('when a ZodError occurs (validation failure → HTTP 400)', () => {
    it('should return 400 and not call next() when a required body field is missing', async () => {
      const schema = z.object({
        body: z.object({ name: z.string().min(1, 'Name is required') }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('body.name'),
            message: expect.any(String),
            code: expect.any(String)
          })
        ])
      });
    });

    it('should include the exact custom message in the details array', async () => {
      const schema = z.object({
        body: z.object({
          email: z.string().email('Invalid email format')
        }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: { email: 'not-an-email' } });
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.email',
              message: 'Invalid email format'
            })
          ])
        })
      );
    });

    it('should include the Zod error code in each detail entry', async () => {
      const schema = z.object({
        body: z.object({ count: z.number() }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: { count: 'not-a-number' } });
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.count',
              code: 'invalid_type'
            })
          ])
        })
      );
    });

    it('should surface multiple error details when multiple fields fail', async () => {
      const schema = z.object({
        body: z.object({
          name: z.string().min(1, 'Name is required'),
          type: z.enum(['TOWER', 'OFFICE'])
        }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({
        body: { name: '', type: 'INVALID' }
      });
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'body.name' }),
            expect.objectContaining({ field: 'body.type' })
          ])
        })
      );
    });

    it('should return 400 for an invalid params field', async () => {
      const schema = z.object({
        body: z.object({}),
        params: z.object({ id: z.string().uuid('Invalid UUID') }),
        query: z.object({})
      });
      const mockReq = createMockRequest({ params: { id: 'not-a-uuid' } });
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'params.id',
              message: 'Invalid UUID'
            })
          ])
        })
      );
    });

    it('should return 400 for an invalid query parameter', async () => {
      const schema = z.object({
        body: z.object({}),
        params: z.object({}),
        query: z.object({
          limit: z.string().regex(/^\d+$/, 'Limit must be a number')
        })
      });
      const mockReq = createMockRequest({ query: { limit: 'abc' } });
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'query.limit',
              message: 'Limit must be a number'
            })
          ])
        })
      );
    });

    it('should use dot-separated path notation for nested field errors', async () => {
      const schema = z.object({
        body: z.object({
          device: z.object({
            config: z.object({ port: z.number() })
          })
        }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({
        body: { device: { config: { port: 'invalid' } } }
      });
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.device.config.port'
            })
          ])
        })
      );
    });

    it('should return 400 when body is null', async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: null as unknown as object });
      const { res, statusMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 when body is undefined', async () => {
      const schema = z.object({
        body: z.object({ name: z.string() }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: undefined });
      const { res, statusMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 400 and set success: false', async () => {
      const schema = z.object({
        body: z.object({ required: z.string() }),
        params: z.object({}),
        query: z.object({})
      });
      const mockReq = createMockRequest({ body: {} });
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });

  // =========================================================================
  describe('when an unexpected non-Zod error is thrown (→ HTTP 500)', () => {
    it('should return 500 when the schema throws a generic Error', async () => {
      const schema = {
        parseAsync: jest
          .fn()
          .mockRejectedValue(new Error('Unexpected crash'))
      } as unknown as ReturnType<typeof z.object>;
      const mockReq = createMockRequest();
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error during validation'
      });
    });

    it('should return 500 when the schema throws a TypeError', async () => {
      const schema = {
        parseAsync: jest
          .fn()
          .mockRejectedValue(
            new TypeError('Cannot read property of undefined')
          )
      } as unknown as ReturnType<typeof z.object>;
      const mockReq = createMockRequest();
      const { res, statusMock, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error during validation'
      });
    });

    it('should return 500 and not call next() on unexpected error', async () => {
      const schema = {
        parseAsync: jest
          .fn()
          .mockRejectedValue(new Error('DB timeout'))
      } as unknown as ReturnType<typeof z.object>;
      const mockReq = createMockRequest();
      const { res } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 with the generic error message (no internal details exposed)', async () => {
      const schema = {
        parseAsync: jest
          .fn()
          .mockRejectedValue(
            new Error('SELECT * FROM users; -- sensitive')
          )
      } as unknown as ReturnType<typeof z.object>;
      const mockReq = createMockRequest();
      const { res, jsonMock } = createMockResponse();

      await validateRequest(schema)(
        mockReq as Request,
        res as Response,
        mockNext
      );

      // The sensitive message must not be forwarded to the client
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error during validation'
      });
      expect(jsonMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('SELECT')
        })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// TODO: Test - validateRequest: verify that body, params, and query are read
//   from req at call time (not captured at middleware creation time)
// TODO: Test - validateRequest: verify behavior when ZodError has zero issues
//   (edge case — details array should be empty)
