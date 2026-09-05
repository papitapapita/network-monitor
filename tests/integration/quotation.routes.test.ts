// Source: src/presentation/http/routes/quotation.routes.ts
// Tests the full HTTP stack for cotizaciones via supertest against a real
// Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanQuotations,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedCustomer,
  seedDeviceModel,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Quotation Routes — /api/quotations', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let viewerToken: string;

  let customerId: string;
  let deviceModelId: string;

  const VALID_UNTIL = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanQuotations(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);

    token = await seedAndGetToken(app, prisma, 'ADMIN');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    deviceModelId = await seedDeviceModel(prisma);
  });

  function validBody() {
    return {
      customerId,
      validUntil: VALID_UNTIL,
      lineItems: [{ deviceModelId, unitPrice: 199.99, quantity: 2 }]
    };
  }

  async function createQuotation(): Promise<request.Response> {
    return request(app)
      .post('/api/quotations')
      .set('Authorization', auth())
      .send(validBody());
  }

  describe('Authentication', () => {
    it('401 — rejects every route without a token', async () => {
      const create = await request(app)
        .post('/api/quotations')
        .send(validBody());
      expect(create.status).toBe(401);

      const list = await request(app).get('/api/quotations');
      expect(list.status).toBe(401);

      const getById = await request(app).get(
        `/api/quotations/${GHOST_ID}`
      );
      expect(getById.status).toBe(401);

      const getPdf = await request(app).get(
        `/api/quotations/${GHOST_ID}/pdf`
      );
      expect(getPdf.status).toBe(401);

      const updateLineItems = await request(app).patch(
        `/api/quotations/${GHOST_ID}/line-items`
      );
      expect(updateLineItems.status).toBe(401);

      const updateDetails = await request(app).patch(
        `/api/quotations/${GHOST_ID}`
      );
      expect(updateDetails.status).toBe(401);

      const send = await request(app).post(
        `/api/quotations/${GHOST_ID}/send`
      );
      expect(send.status).toBe(401);

      const accept = await request(app).post(
        `/api/quotations/${GHOST_ID}/accept`
      );
      expect(accept.status).toBe(401);

      const reject = await request(app).post(
        `/api/quotations/${GHOST_ID}/reject`
      );
      expect(reject.status).toBe(401);

      const expire = await request(app).post(
        `/api/quotations/${GHOST_ID}/expire`
      );
      expect(expire.status).toBe(401);
    });
  });

  describe('Authorization (RBAC)', () => {
    it('403 — rejects a VIEWER creating a quotation', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(validBody());

      expect(res.status).toBe(403);
    });

    it('403 — rejects a VIEWER sending a quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('200 — allows a VIEWER to read a quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .get(`/api/quotations/${created.body.data.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Validation', () => {
    it('400 — rejects a malformed deviceModelId', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', auth())
        .send({
          customerId,
          validUntil: VALID_UNTIL,
          lineItems: [
            { deviceModelId: INVALID_ID, unitPrice: 10, quantity: 1 }
          ]
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects an empty lineItems array', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', auth())
        .send({
          customerId,
          validUntil: VALID_UNTIL,
          lineItems: []
        });
      expect(res.status).toBe(400);
    });

    it('400 — rejects a non-ISO validUntil', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', auth())
        .send({ ...validBody(), validUntil: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('400 — rejects a reject with no reason', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/reject`)
        .set('Authorization', auth())
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/quotations', () => {
    it('201 — creates a DRAFT quotation with snapshotted line items', async () => {
      const res = await createQuotation();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.total).toBeCloseTo(399.98);
      expect(res.body.data.lineItems).toHaveLength(1);
    });

    it('404 — a customer that does not exist is rejected', async () => {
      const res = await request(app)
        .post('/api/quotations')
        .set('Authorization', auth())
        .send({ ...validBody(), customerId: GHOST_ID });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/quotations', () => {
    it('200 — lists quotations and filters by status and customerId', async () => {
      const created = await createQuotation();
      const id = created.body.data.id;

      const all = await request(app)
        .get('/api/quotations')
        .set('Authorization', auth());
      expect(all.status).toBe(200);
      expect(all.body.data.total).toBeGreaterThanOrEqual(1);

      const byStatus = await request(app)
        .get('/api/quotations?status=DRAFT')
        .set('Authorization', auth());
      expect(byStatus.status).toBe(200);
      expect(
        byStatus.body.data.quotations.every(
          (q: { status: string }) => q.status === 'DRAFT'
        )
      ).toBe(true);

      const byCustomer = await request(app)
        .get(`/api/quotations?customerId=${customerId}`)
        .set('Authorization', auth());
      expect(byCustomer.status).toBe(200);
      expect(
        byCustomer.body.data.quotations.some(
          (q: { id: string }) => q.id === id
        )
      ).toBe(true);
    });
  });

  describe('GET /api/quotations/:id', () => {
    it('200 — returns a quotation by id', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .get(`/api/quotations/${created.body.data.id}`)
        .set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.body.data.id);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/quotations/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/quotations/:id/pdf', () => {
    it('200 — returns a PDF with the correct headers', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .get(`/api/quotations/${created.body.data.id}/pdf`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(
        /attachment; filename="cotizacion-.*\.pdf"/
      );
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/quotations/:id/line-items', () => {
    it('200 — replaces the line items of a DRAFT quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .patch(`/api/quotations/${created.body.data.id}/line-items`)
        .set('Authorization', auth())
        .send({
          lineItems: [{ deviceModelId, unitPrice: 50, quantity: 1 }]
        });

      expect(res.status).toBe(200);
      expect(res.body.data.lineItems).toHaveLength(1);
      expect(res.body.data.total).toBeCloseTo(50);
    });

    it('409 — cannot modify line items after sending', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .patch(`/api/quotations/${created.body.data.id}/line-items`)
        .set('Authorization', auth())
        .send({
          lineItems: [{ deviceModelId, unitPrice: 50, quantity: 1 }]
        });

      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/quotations/:id', () => {
    it('200 — updates details of a DRAFT quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .patch(`/api/quotations/${created.body.data.id}`)
        .set('Authorization', auth())
        .send({ notes: 'Includes installation' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Includes installation');
    });
  });

  describe('POST /api/quotations/:id/send', () => {
    it('200 — sends a DRAFT quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SENT');
    });

    it('409 — cannot send an already-sent quotation', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/quotations/:id/accept', () => {
    it('200 — accepts a SENT quotation', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/accept`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACCEPTED');
    });

    it('409 — cannot accept a DRAFT quotation', async () => {
      const created = await createQuotation();

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/accept`)
        .set('Authorization', auth());

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/quotations/:id/reject', () => {
    it('200 — rejects a SENT quotation with a reason', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/reject`)
        .set('Authorization', auth())
        .send({ reason: 'Too expensive' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('Too expensive');
    });
  });

  describe('POST /api/quotations/:id/expire', () => {
    it('409 — a quotation is not expirable before its validity date', async () => {
      const created = await createQuotation();
      await request(app)
        .post(`/api/quotations/${created.body.data.id}/send`)
        .set('Authorization', auth());

      const res = await request(app)
        .post(`/api/quotations/${created.body.data.id}/expire`)
        .set('Authorization', auth());

      expect(res.status).toBe(409);
    });
  });
});
