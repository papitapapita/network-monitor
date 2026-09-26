// Source: src/presentation/http/routes/bank-account.routes.ts
// Tests the full HTTP stack for the issuer's bank accounts via supertest
// against a real Postgres DB.

import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import {
  cleanBankAccounts,
  seedBankAccount,
  GHOST_ID,
  INVALID_ID
} from './helpers/db';
import { seedAndGetToken } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

describe('Bank Account Routes — /api/bank-accounts', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let token: string;
  let operatorToken: string;
  let viewerToken: string;

  const auth = () => `Bearer ${token}`;

  const validBody = {
    bankName: 'Bancolombia',
    accountType: 'SAVINGS',
    accountNumber: '39500002227'
  };

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanBankAccounts(prisma);
    token = await seedAndGetToken(app, prisma, 'ADMIN');
    operatorToken = await seedAndGetToken(app, prisma, 'OPERATOR');
    viewerToken = await seedAndGetToken(app, prisma, 'VIEWER');
  });

  describe('Authentication', () => {
    it('401 — rejects every route without a token', async () => {
      const responses = await Promise.all([
        request(app).post('/api/bank-accounts').send(validBody),
        request(app).get('/api/bank-accounts'),
        request(app).get(`/api/bank-accounts/${GHOST_ID}`),
        request(app).patch(`/api/bank-accounts/${GHOST_ID}`).send({}),
        request(app).delete(`/api/bank-accounts/${GHOST_ID}`)
      ]);

      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Authorization (RBAC)', () => {
    it('[BIL-263] 403 — rejects a VIEWER creating an account', async () => {
      const res = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('[BIL-263] 200 — lets a VIEWER list accounts', async () => {
      const res = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
    });

    it('[BIL-263] 403 — only an ADMIN can delete an account', async () => {
      const id = await seedBankAccount(prisma);

      const res = await request(app)
        .delete(`/api/bank-accounts/${id}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Validation', () => {
    it('[BIL-260] 400 — rejects an unknown account type', async () => {
      const res = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', auth())
        .send({ ...validBody, accountType: 'NEQUI' });

      expect(res.status).toBe(400);
    });

    it('[BIL-260] 400 — rejects a malformed account number', async () => {
      const res = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', auth())
        .send({ ...validBody, accountNumber: 'abc' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects a malformed id', async () => {
      const res = await request(app)
        .get(`/api/bank-accounts/${INVALID_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/bank-accounts', () => {
    it('[BIL-264] 201 — creates an account with a picker label', async () => {
      const res = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', auth())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data.label).toBe(
        'Bancolombia · Ahorros · 39500002227'
      );
    });

    it('[BIL-261] 409 — rejects a duplicate', async () => {
      await seedBankAccount(prisma);

      const res = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', auth())
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/bank-accounts', () => {
    it('200 — lists every account', async () => {
      await seedBankAccount(prisma);

      const res = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.bankAccounts).toHaveLength(1);
    });
  });

  describe('GET /api/bank-accounts/:id', () => {
    it('200 — returns an account', async () => {
      const id = await seedBankAccount(prisma);

      const res = await request(app)
        .get(`/api/bank-accounts/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .get(`/api/bank-accounts/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/bank-accounts/:id', () => {
    it('200 — updates the fields supplied', async () => {
      const id = await seedBankAccount(prisma);

      const res = await request(app)
        .patch(`/api/bank-accounts/${id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ accountType: 'CHECKING' });

      expect(res.status).toBe(200);
      expect(res.body.data.accountType).toBe('CHECKING');
      expect(res.body.data.accountNumber).toBe('39500002227');
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .patch(`/api/bank-accounts/${GHOST_ID}`)
        .set('Authorization', auth())
        .send({ bankName: 'Davivienda' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/bank-accounts/:id', () => {
    it('204 — deletes the account', async () => {
      const id = await seedBankAccount(prisma);

      const res = await request(app)
        .delete(`/api/bank-accounts/${id}`)
        .set('Authorization', auth());

      expect(res.status).toBe(204);
      expect(await prisma.bankAccount.count()).toBe(0);
    });

    it('404 — unknown id', async () => {
      const res = await request(app)
        .delete(`/api/bank-accounts/${GHOST_ID}`)
        .set('Authorization', auth());

      expect(res.status).toBe(404);
    });
  });
});
