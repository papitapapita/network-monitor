// Source: src/presentation/http/routes/scan.routes.ts

import express, { Express } from 'express';
import request from 'supertest';
import { createScanRoutes } from '../../src/presentation/http/routes/scan.routes';
import { ScanController } from '../../src/presentation/http/controllers/ScanController';
import { ScanNetworkSegmentUseCase } from 'application/device-inventory/use-cases';
import { ILogger } from 'application/shared/interfaces';
import { Result } from 'domain/shared/core';
import { ScanNetworkSegmentResponseDTO } from 'application/device-inventory/dtos';
import { ScanNetworkSegmentRequestDTO } from 'application/device-inventory/dtos';

jest.mock(
  'application/device-inventory/use-cases/ScanNetworkSegmentUseCase'
);

const MockedUseCase = ScanNetworkSegmentUseCase as jest.MockedClass<
  typeof ScanNetworkSegmentUseCase
>;

const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  setLevel: jest.fn()
};

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  const controller = new ScanController(
    new ScanNetworkSegmentUseCase({} as never, mockLogger),
    mockLogger
  );
  app.use('/', createScanRoutes(controller));
  return app;
}

describe('POST / — scan route integration', () => {
  let app: Express;
  let mockExecute: jest.MockedFunction<
    (
      req: ScanNetworkSegmentRequestDTO
    ) => Promise<Result<ScanNetworkSegmentResponseDTO>>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    MockedUseCase.mockClear();
    MockedUseCase.prototype.execute = jest.fn();
    mockExecute = MockedUseCase.prototype
      .execute as jest.MockedFunction<
      (
        req: ScanNetworkSegmentRequestDTO
      ) => Promise<Result<ScanNetworkSegmentResponseDTO>>
    >;
    app = buildApp();
  });

  describe('Zod validation', () => {
    it('should return 400 with validation error when segment field is missing', async () => {
      const res = await request(app)
        .post('/')
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(
        res.body.details.some((d: { field: string }) =>
          d.field.includes('segment')
        )
      ).toBe(true);
    });

    it('should return 400 with validation error when segment is an empty string', async () => {
      const res = await request(app)
        .post('/')
        .send({ segment: '' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(
        res.body.details.some((d: { field: string }) =>
          d.field.includes('segment')
        )
      ).toBe(true);
    });

    it('should return 400 with validation error when body is empty', async () => {
      const res = await request(app).post('/');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('happy path', () => {
    it('should return 200 with scan results when use case succeeds', async () => {
      const responseDTO: ScanNetworkSegmentResponseDTO = {
        segment: '192.168.1.0/24',
        scannedCount: 254,
        responsiveCount: 2,
        discoveredHosts: [
          {
            ipAddress: '192.168.1.1',
            latencyMs: 2,
            macAddress: 'A4:C3:F0:85:AC:11',
            manufacturer: 'TP-Link'
          },
          {
            ipAddress: '192.168.1.20',
            latencyMs: 5,
            macAddress: null,
            manufacturer: null
          }
        ]
      };
      mockExecute.mockResolvedValueOnce(Result.ok(responseDTO));

      const res = await request(app)
        .post('/')
        .send({ segment: '192.168.1.0/24' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(responseDTO);
    });
  });

  describe('use case failure mapping', () => {
    it('should return 400 when use case fails with "segment is required"', async () => {
      mockExecute.mockResolvedValueOnce(
        Result.fail('segment is required')
      );

      const res = await request(app)
        .post('/')
        .send({ segment: '192.168.1.0/24' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('segment is required');
    });

    it('should return 400 when use case fails with "CIDR range too large"', async () => {
      mockExecute.mockResolvedValueOnce(
        Result.fail(
          'CIDR range too large: maximum 1024 host addresses allowed'
        )
      );

      const res = await request(app)
        .post('/')
        .send({ segment: '10.0.0.0/8' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when use case fails with "DeviceModel not found"', async () => {
      mockExecute.mockResolvedValueOnce(
        Result.fail('DeviceModel not found')
      );

      const res = await request(app)
        .post('/')
        .send({ segment: '192.168.1.0/24' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when use case fails with an unknown error message', async () => {
      mockExecute.mockResolvedValueOnce(
        Result.fail('Something blew up')
      );

      const res = await request(app)
        .post('/')
        .send({ segment: '192.168.1.0/24' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 with generic message when use case throws unexpectedly', async () => {
      mockExecute.mockRejectedValueOnce(new Error('unexpected'));

      const res = await request(app)
        .post('/')
        .send({ segment: '192.168.1.0/24' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Internal server error');
    });
  });

  describe('use case invocation contract', () => {
    it('should call execute exactly once with the segment from the request body', async () => {
      mockExecute.mockResolvedValueOnce(
        Result.ok<ScanNetworkSegmentResponseDTO>({
          segment: '10.0.0.0/30',
          scannedCount: 2,
          responsiveCount: 1,
          discoveredHosts: [
            {
              ipAddress: '10.0.0.1',
              latencyMs: 1,
              macAddress: null,
              manufacturer: null
            }
          ]
        })
      );

      await request(app)
        .post('/')
        .send({ segment: '10.0.0.0/30' })
        .set('Content-Type', 'application/json');

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith({
        segment: '10.0.0.0/30'
      });
    });
  });

  describe('unsupported HTTP methods', () => {
    it('should return 404 for GET requests to /', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(404);
    });
  });
});
