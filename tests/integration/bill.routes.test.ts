// Source: src/presentation/http/routes/bill.routes.ts
// Tests the full HTTP stack for bill generation and lifecycle via
// supertest against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanBills,
  cleanCustomers,
  seedCustomer,
  seedServicePlan,
  seedActiveContractedService,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Bill Routes — /api/bills', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;

  let customerId: string;
  let servicePlanId: string;

  const auth = () => `Bearer ${token}`;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    servicePlanId = await seedServicePlan(prisma, {
      name: 'Test Plan 50/10',
      monthlyPrice: 80000
    });
    await seedActiveContractedService(
      prisma,
      customerId,
      servicePlanId
    );
  });

  async function generateBill(body: {
    customerId: string;
    year: number;
    month: number;
    issueDate?: string;
    dueDate?: string;
  }): Promise<request.Response> {
    return request(app)
      .post('/api/bills/generate')
      .set('Authorization', auth())
      .send(body);
  }

  describe('Authentication', () => {
    it('401 — rejects every route without a token', async () => {
      const generate = await request(app)
        .post('/api/bills/generate')
        .send({ customerId, year: 2026, month: 1 });
      expect(generate.status).toBe(401);

      const generateBulk = await request(app)
        .post('/api/bills/generate-bulk')
        .send({ year: 2026, month: 1 });
      expect(generateBulk.status).toBe(401);

      const list = await request(app).get('/api/bills');
      expect(list.status).toBe(401);

      const getById = await request(app).get(
        `/api/bills/${GHOST_ID}`
      );
      expect(getById.status).toBe(401);

      const pay = await request(app).post(
        `/api/bills/${GHOST_ID}/pay`
      );
      expect(pay.status).toBe(401);

      const overdue = await request(app).post(
        `/api/bills/${GHOST_ID}/overdue`
      );
      expect(overdue.status).toBe(401);

      const cancel = await request(app).post(
        `/api/bills/${GHOST_ID}/cancel`
      );
      expect(cancel.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('400 — rejects a malformed customerId', async () => {
      const res = await generateBill({
        customerId: INVALID_ID,
        year: 2026,
        month: 1
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects month 13', async () => {
      const res = await generateBill({
        customerId,
        year: 2026,
        month: 13
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — rejects a year out of range', async () => {
      const res = await generateBill({
        customerId,
        year: 2101,
        month: 1
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/bills/generate', () => {
    it('201 — generates a bill with snapshot line items and correct total', async () => {
      const res = await generateBill({
        customerId,
        year: 2026,
        month: 1
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        customerId,
        period: '2026-01',
        status: 'PENDING',
        total: 80000
      });
      expect(res.body.data.lineItems).toHaveLength(1);
      expect(res.body.data.lineItems[0]).toMatchObject({
        servicePlanId,
        planName: 'Test Plan 50/10',
        monthlyPrice: 80000
      });
      expect(res.body.data.paidAt).toBeNull();
    });

    it('409 — a duplicate bill for the same customer and period is rejected', async () => {
      const first = await generateBill({
        customerId,
        year: 2026,
        month: 2
      });
      expect(first.status).toBe(201);

      const second = await generateBill({
        customerId,
        year: 2026,
        month: 2
      });
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });

    it('201 — regenerating the same period succeeds after the prior bill is cancelled', async () => {
      const first = await generateBill({
        customerId,
        year: 2026,
        month: 3
      });
      expect(first.status).toBe(201);

      const cancelRes = await request(app)
        .post(`/api/bills/${first.body.data.id}/cancel`)
        .set('Authorization', auth());
      expect(cancelRes.status).toBe(200);

      const second = await generateBill({
        customerId,
        year: 2026,
        month: 3
      });
      expect(second.status).toBe(201);
      expect(second.body.data.id).not.toBe(first.body.data.id);
    });

    it('409 — a customer with no active contracted services cannot be billed', async () => {
      const bareCustomerId = await seedCustomer(prisma, {
        phone: '3009999997'
      });

      const res = await generateBill({
        customerId: bareCustomerId,
        year: 2026,
        month: 1
      });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/bills', () => {
    it('200 — lists bills and filters by status, customerId and period', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 4
      });
      expect(generated.status).toBe(201);
      const billId = generated.body.data.id;

      const all = await request(app)
        .get('/api/bills')
        .set('Authorization', auth());
      expect(all.status).toBe(200);
      expect(all.body.success).toBe(true);
      expect(all.body.data.total).toBeGreaterThanOrEqual(1);

      const byCustomer = await request(app)
        .get(`/api/bills?customerId=${customerId}`)
        .set('Authorization', auth());
      expect(byCustomer.status).toBe(200);
      expect(
        byCustomer.body.data.bills.every(
          (b: { customerId: string }) => b.customerId === customerId
        )
      ).toBe(true);

      const byStatus = await request(app)
        .get('/api/bills?status=PENDING')
        .set('Authorization', auth());
      expect(byStatus.status).toBe(200);
      expect(
        byStatus.body.data.bills.every(
          (b: { status: string }) => b.status === 'PENDING'
        )
      ).toBe(true);

      const byPeriod = await request(app)
        .get('/api/bills?year=2026&month=4')
        .set('Authorization', auth());
      expect(byPeriod.status).toBe(200);
      expect(
        byPeriod.body.data.bills.some(
          (b: { id: string }) => b.id === billId
        )
      ).toBe(true);
    });
  });

  describe('GET /api/bills/:id', () => {
    it('200 — returns a bill by id', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 5
      });
      const billId = generated.body.data.id;

      const res = await request(app)
        .get(`/api/bills/${billId}`)
        .set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(billId);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/bills/${GHOST_ID}`)
        .set('Authorization', auth());
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/bills/:id/pay', () => {
    it('200 — marks a pending bill paid and sets paidAt', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 6
      });
      const billId = generated.body.data.id;

      const res = await request(app)
        .post(`/api/bills/${billId}/pay`)
        .set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidAt).not.toBeNull();
    });

    it('409 — paying an already-paid bill is rejected', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 7
      });
      const billId = generated.body.data.id;

      const first = await request(app)
        .post(`/api/bills/${billId}/pay`)
        .set('Authorization', auth());
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/api/bills/${billId}/pay`)
        .set('Authorization', auth());
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });
  });

  describe('POST /api/bills/:id/cancel', () => {
    it('409 — cannot cancel a paid bill', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 8
      });
      const billId = generated.body.data.id;

      const paid = await request(app)
        .post(`/api/bills/${billId}/pay`)
        .set('Authorization', auth());
      expect(paid.status).toBe(200);

      const cancelRes = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', auth());
      expect(cancelRes.status).toBe(409);
      expect(cancelRes.body.success).toBe(false);
    });
  });

  describe('POST /api/bills/:id/overdue', () => {
    it('409 — a bill is not overdue before its due date', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 9
      });
      const billId = generated.body.data.id;

      const res = await request(app)
        .post(`/api/bills/${billId}/overdue`)
        .set('Authorization', auth());
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('200 — a bill generated with a past due date can be marked overdue', async () => {
      const generated = await generateBill({
        customerId,
        year: 2026,
        month: 10,
        issueDate: '2020-01-01T00:00:00.000Z',
        dueDate: '2020-01-15T00:00:00.000Z'
      });
      expect(generated.status).toBe(201);
      const billId = generated.body.data.id;

      const res = await request(app)
        .post(`/api/bills/${billId}/overdue`)
        .set('Authorization', auth());
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('OVERDUE');
    });
  });

  describe('POST /api/bills/generate-bulk', () => {
    it('200 — partitions generated and skipped bills across customers', async () => {
      const otherCustomerId = await seedCustomer(prisma, {
        phone: '3009999998'
      });
      const otherPlanId = await seedServicePlan(prisma, {
        name: 'Bulk Test Plan',
        monthlyPrice: 50000
      });
      await seedActiveContractedService(
        prisma,
        otherCustomerId,
        otherPlanId
      );

      const year = 2026;
      const month = 11;

      const preBilled = await generateBill({
        customerId,
        year,
        month
      });
      expect(preBilled.status).toBe(201);

      const res = await request(app)
        .post('/api/bills/generate-bulk')
        .set('Authorization', auth())
        .send({ year, month });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBe('2026-11');
      expect(Array.isArray(res.body.data.failed)).toBe(true);
      expect(res.body.data.failed).toHaveLength(0);
      expect(
        res.body.data.generated.some(
          (b: { customerId: string }) =>
            b.customerId === otherCustomerId
        )
      ).toBe(true);
      expect(
        res.body.data.skipped.some(
          (s: { customerId: string }) => s.customerId === customerId
        )
      ).toBe(true);
    });
  });
});
