// Source: src/presentation/http/routes/scan.routes.ts

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase } from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { FakeNetworkScannerService } from './helpers/FakeNetworkScannerService';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import { ScanController } from '../../src/presentation/http/controllers/ScanController';
import {
  ScanNetworkSegmentUseCase,
  SCAN_NEEDS_SERVER_ON_SITE
} from '../../src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase';

const SCAN = '/api/network/scan';

describe('Scan Routes — POST /api/network/scan', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;

  // The real scanner sweeps the CIDR with ICMP; everything else is real.
  const scanner = new FakeNetworkScannerService();

  beforeAll(async () => {
    ({ app, container } = await createTestApp((c) => {
      const logger = c.getLogger();
      c.scanController = new ScanController(
        new ScanNetworkSegmentUseCase(scanner, logger),
        logger
      );
    }));
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    scanner.reset();
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  function scan(body?: object) {
    const req = request(app)
      .post(SCAN)
      .set('Authorization', `Bearer ${adminToken}`);
    return body === undefined ? req : req.send(body);
  }

  // ─────────────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────────────

  it('401 — rejects a request with no Authorization header', async () => {
    const res = await request(app)
      .post(SCAN)
      .send({ segment: '192.168.1.0/24' });

    expect(res.status).toBe(401);
    expect(scanner.callCount).toBe(0);
  });

  it('403 — a VIEWER cannot start a scan', async () => {
    const viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');

    const res = await request(app)
      .post(SCAN)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ segment: '192.168.1.0/24' });

    expect(res.status).toBe(403);
    expect(scanner.callCount).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('400 — segment field is missing', async () => {
      const res = await scan({});

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

    it('400 — segment is an empty string', async () => {
      const res = await scan({ segment: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(
        res.body.details.some((d: { field: string }) =>
          d.field.includes('segment')
        )
      ).toBe(true);
    });

    it('400 — body is empty', async () => {
      const res = await scan();

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(scanner.callCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path
  // ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('200 — returns the discovered hosts in the response envelope', async () => {
      scanner.setHosts([
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
      ]);

      const res = await scan({ segment: '192.168.1.0/24' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
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
      });
    });

    it('200 — reports zero responsive hosts when nothing answers', async () => {
      const res = await scan({ segment: '10.0.0.0/30' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        segment: '10.0.0.0/30',
        scannedCount: 2,
        responsiveCount: 0,
        discoveredHosts: []
      });
    });

    it('scans the requested segment exactly once, trimmed', async () => {
      await scan({ segment: '  10.0.0.0/30  ' });

      expect(scanner.callCount).toBe(1);
      expect(scanner.lastCidr).toBe('10.0.0.0/30');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Scanner failures
  // ─────────────────────────────────────────────────────────────

  describe('scanner failures', () => {
    it('400 — the scanner rejects a range that is too large', async () => {
      scanner.failWith(
        new Error(
          'CIDR range too large: maximum 1024 host addresses allowed'
        )
      );

      const res = await scan({ segment: '10.0.0.0/8' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('CIDR range too large');
    });

    it('500 — the scanner fails unexpectedly', async () => {
      scanner.failWith(new Error('raw socket unavailable'));

      const res = await scan({ segment: '192.168.1.0/24' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  it('404 — GET is not a supported method', async () => {
    const res = await request(app)
      .get(SCAN)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('[DEV-171] Scan Routes — a server hosted off site', () => {
  let app: Application;
  let container: DependencyContainer;
  const scanner = new FakeNetworkScannerService();

  beforeAll(async () => {
    process.env.SERVER_ON_SITE = 'false';
    try {
      ({ app, container } = await createTestApp((c) => {
        const logger = c.getLogger();
        c.scanController = new ScanController(
          new ScanNetworkSegmentUseCase(
            scanner,
            logger,
            c.serverOnSite
          ),
          logger
        );
      }));
    } finally {
      delete process.env.SERVER_ON_SITE;
    }
  });

  afterAll(async () => {
    await container.disconnect();
  });

  it('409 — refuses to scan', async () => {
    const prisma = container.getPrisma();
    await cleanDatabase(prisma);
    const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');

    const res = await request(app)
      .post(SCAN)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ segment: '192.168.1.0/24' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: SCAN_NEEDS_SERVER_ON_SITE
    });
    expect(scanner.callCount).toBe(0);
  });
});
