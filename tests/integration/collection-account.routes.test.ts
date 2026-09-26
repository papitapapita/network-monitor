// Source: src/presentation/http/routes/collection-account.routes.ts
// Tests the full HTTP stack for cuentas de cobro via supertest against a
// real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanCollectionAccounts,
  cleanBills,
  cleanCustomers,
  seedCustomer,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Collection Account Routes — /api/collection-accounts', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let viewerToken: string;
  let customerId: string;

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);

    token = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
  });

  function validBody() {
    return {
      customerName: 'María López',
      customerDocument: '1098765432',
      lineItems: [
        {
          description: 'Cámara IP 4MP',
          unitPrice: 185000,
          quantity: 4
        },
        { description: 'Instalación', unitPrice: 350000, quantity: 1 }
      ]
    };
  }

  async function createAccount(
    body: Record<string, unknown> = validBody()
  ): Promise<request.Response> {
    return request(app)
      .post('/api/collection-accounts')
      .set('Authorization', auth())
      .send(body);
  }

  describe('Authentication', () => {
    it('401 — rejects every route without a token', async () => {
      const responses = await Promise.all([
        request(app)
          .post('/api/collection-accounts')
          .send(validBody()),
        request(app).get('/api/collection-accounts'),
        request(app).get(`/api/collection-accounts/${GHOST_ID}`),
        request(app).get(`/api/collection-accounts/${GHOST_ID}/pdf`),
        request(app).post(`/api/collection-accounts/${GHOST_ID}/pay`),
        request(app).post(
          `/api/collection-accounts/${GHOST_ID}/cancel`
        )
      ]);

      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Authorization (RBAC)', () => {
    it('[BIL-250] 403 — rejects a VIEWER creating an account', async () => {
      const res = await request(app)
        .post('/api/collection-accounts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(validBody());

      expect(res.status).toBe(403);
    });

    it('[BIL-250] 403 — rejects a VIEWER marking an account paid', async () => {
      const created = await createAccount();

      const res = await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('[BIL-250] 200 — allows a VIEWER to read and download', async () => {
      const created = await createAccount();

      const get = await request(app)
        .get(`/api/collection-accounts/${created.body.data.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      const pdf = await request(app)
        .get(`/api/collection-accounts/${created.body.data.id}/pdf`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(get.status).toBe(200);
      expect(pdf.status).toBe(200);
    });

    it('[BIL-250] 404 — there is no DELETE route', async () => {
      const created = await createAccount();

      const res = await request(app)
        .delete(`/api/collection-accounts/${created.body.data.id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });

  describe('Validation', () => {
    it('400 — rejects an empty lineItems array', async () => {
      const res = await createAccount({
        ...validBody(),
        lineItems: []
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects a line item without a description', async () => {
      const res = await createAccount({
        ...validBody(),
        lineItems: [{ description: '', unitPrice: 1000, quantity: 1 }]
      });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a negative price and a fractional quantity', async () => {
      const negative = await createAccount({
        ...validBody(),
        lineItems: [{ description: 'x', unitPrice: -5, quantity: 1 }]
      });
      const fractional = await createAccount({
        ...validBody(),
        lineItems: [{ description: 'x', unitPrice: 5, quantity: 1.5 }]
      });

      expect(negative.status).toBe(400);
      expect(fractional.status).toBe(400);
    });

    it('400 — rejects a non-ISO dueDate', async () => {
      const res = await createAccount({
        ...validBody(),
        dueDate: 'next week'
      });

      expect(res.status).toBe(400);
    });

    it('[BIL-202] 400 — requires a customerId or customerName', async () => {
      const res = await createAccount({
        lineItems: validBody().lineItems
      });

      expect(res.status).toBe(400);
    });

    it('[BIL-205] 400 — rejects a due date before the issue date', async () => {
      const res = await createAccount({
        ...validBody(),
        issueDate: '2026-09-15T12:00:00.000Z',
        dueDate: '2026-09-01T12:00:00.000Z'
      });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed id', async () => {
      const res = await request(app)
        .get(`/api/collection-accounts/${INVALID_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/collection-accounts', () => {
    it('201 — creates a PENDING account with a CC number and total', async () => {
      const res = await createAccount();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.number).toMatch(/^CC-\d{4,}$/);
      expect(res.body.data.total).toBe(1090000);
      expect(res.body.data.createdBy).not.toBeNull();
    });

    it('201 — links an existing customer', async () => {
      const res = await createAccount({
        customerId,
        lineItems: validBody().lineItems
      });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBe(customerId);
    });

    it('404 — a customer that does not exist is rejected', async () => {
      const res = await createAccount({
        customerId: GHOST_ID,
        lineItems: validBody().lineItems
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/collection-accounts', () => {
    it('200 — lists and filters by status', async () => {
      const created = await createAccount();
      await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', auth());
      await createAccount();

      const res = await request(app)
        .get('/api/collection-accounts?status=PAID')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.collectionAccounts[0].id).toBe(
        created.body.data.id
      );
    });

    it('[BIL-240] 400 — rejects a limit over 100', async () => {
      const res = await request(app)
        .get('/api/collection-accounts?limit=101')
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/collection-accounts/:id', () => {
    it('200 — returns an account by id', async () => {
      const created = await createAccount();

      const res = await request(app)
        .get(`/api/collection-accounts/${created.body.data.id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.lineItems).toHaveLength(2);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/collection-accounts/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/collection-accounts/:id/pdf', () => {
    it('[BIL-230] 200 — returns a PDF named cuenta-de-cobro-CC-NNNN.pdf', async () => {
      const created = await createAccount();

      const res = await request(app)
        .get(`/api/collection-accounts/${created.body.data.id}/pdf`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="cuenta-de-cobro-${created.body.data.number}.pdf"`
      );
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/collection-accounts/:id/pay', () => {
    it('[BIL-221] 200 — marks a PENDING account paid', async () => {
      const created = await createAccount();

      const res = await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidAt).not.toBeNull();
    });

    it('[BIL-221] 409 — cannot pay twice', async () => {
      const created = await createAccount();
      await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', auth());

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/collection-accounts/:id/cancel', () => {
    it('[BIL-222] 200 — cancels a PENDING account', async () => {
      const created = await createAccount();

      const res = await request(app)
        .post(
          `/api/collection-accounts/${created.body.data.id}/cancel`
        )
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('[BIL-222] 409 — cannot cancel a paid account', async () => {
      const created = await createAccount();
      await request(app)
        .post(`/api/collection-accounts/${created.body.data.id}/pay`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(
          `/api/collection-accounts/${created.body.data.id}/cancel`
        )
        .set('Authorization', auth());

      expect(res.status).toBe(409);
    });
  });
});
