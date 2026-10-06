// Source: src/presentation/http/routes/user.routes.ts
//         src/presentation/http/middleware/authenticate.ts (IDN-065)

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase, GHOST_ID } from './helpers/db';
import { getToken, seedAndGetToken, seedUser } from './helpers/auth';
import { DependencyContainer } from '../../src/infrastructure/di/container';

const PATH = '/api/users';
const PASSWORD = 'staff-password';

describe('User Routes — /api/users', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let adminToken: string;

  const as = (token: string) => `Bearer ${token}`;
  const idOf = async (email: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  // A staff account and a token for it.
  const staff = async (
    email = 'staff@isp.example',
    role: 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'OPERATOR'
  ) => {
    await seedUser(prisma, email, PASSWORD, role);
    return {
      id: await idOf(email),
      token: await getToken(app, email, PASSWORD)
    };
  };

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
  });

  describe('Authentication and authorization', () => {
    it('401 — rejects every route without a token', async () => {
      const responses = await Promise.all([
        request(app).get(PATH),
        request(app).post(PATH),
        request(app).patch(`${PATH}/${GHOST_ID}`),
        request(app).post(`${PATH}/${GHOST_ID}/two-factor/reset`),
        request(app).post(`${PATH}/me/password`)
      ]);

      for (const res of responses) expect(res.status).toBe(401);
    });

    it.each(['OPERATOR', 'VIEWER'] as const)(
      '[IDN-140] 403 — an %s cannot manage users',
      async (role) => {
        const token = await seedAndGetToken(app, prisma, role);

        const responses = await Promise.all([
          request(app).get(PATH).set('Authorization', as(token)),
          request(app)
            .post(PATH)
            .set('Authorization', as(token))
            .send({
              email: 'x@isp.example',
              password: PASSWORD,
              role: 'VIEWER'
            }),
          request(app)
            .patch(`${PATH}/${GHOST_ID}`)
            .set('Authorization', as(token))
            .send({ disabled: true }),
          request(app)
            .post(`${PATH}/${GHOST_ID}/two-factor/reset`)
            .set('Authorization', as(token))
        ]);

        for (const res of responses) expect(res.status).toBe(403);
      }
    );
  });

  describe('GET /api/users', () => {
    it('[IDN-140] 200 — lists the staff without the vendor account', async () => {
      await seedUser(
        prisma,
        'vendor@nms.example',
        'vendor-password!',
        'VENDOR'
      );
      await staff();

      const res = await request(app)
        .get(PATH)
        .set('Authorization', as(adminToken));

      expect(res.status).toBe(200);
      const emails = res.body.data.users.map(
        (u: { email: string }) => u.email
      );
      expect(emails).toContain('staff@isp.example');
      expect(emails).not.toContain('vendor@nms.example');
      expect(res.body.data.users[0]).not.toHaveProperty(
        'passwordHash'
      );
    });

    it('[IDN-140] 200 — the vendor sees its own account', async () => {
      const vendorToken = await seedAndGetToken(
        app,
        prisma,
        'VENDOR'
      );

      const res = await request(app)
        .get(PATH)
        .set('Authorization', as(vendorToken));

      expect(
        res.body.data.users.map((u: { role: string }) => u.role)
      ).toContain('VENDOR');
    });
  });

  describe('POST /api/users', () => {
    const create = (body: object) =>
      request(app)
        .post(PATH)
        .set('Authorization', as(adminToken))
        .send(body);

    it('[IDN-140] 201 — creates an account that can sign in', async () => {
      const res = await create({
        email: 'new@isp.example',
        password: PASSWORD,
        role: 'VIEWER'
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        email: 'new@isp.example',
        role: 'VIEWER',
        disabled: false,
        disabledAt: null
      });
      await expect(
        getToken(app, 'new@isp.example', PASSWORD)
      ).resolves.toEqual(expect.any(String));
    });

    it('[IDN-004] 409 — the email is taken', async () => {
      await staff('taken@isp.example');

      const res = await create({
        email: 'taken@isp.example',
        password: PASSWORD,
        role: 'VIEWER'
      });

      expect(res.status).toBe(409);
    });

    it.each([
      ['[IDN-141] the VENDOR role', { role: 'VENDOR' }],
      ['[IDN-142] a short password', { password: 'short' }],
      ['a malformed email', { email: 'nope' }],
      ['a missing role', { role: undefined }]
    ])('400 — %s', async (_label, override) => {
      const res = await create({
        email: 'new@isp.example',
        password: PASSWORD,
        role: 'VIEWER',
        ...override
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/users/:id', () => {
    const patch = (id: string, body: object, token = adminToken) =>
      request(app)
        .patch(`${PATH}/${id}`)
        .set('Authorization', as(token))
        .send(body);

    it('[IDN-013] disabling ends the open session and blocks sign-in', async () => {
      const { id, token } = await staff();

      const res = await patch(id, { disabled: true });

      expect(res.status).toBe(200);
      expect(res.body.data.disabled).toBe(true);
      const after = await request(app)
        .get('/api/installation')
        .set('Authorization', as(token));
      expect(after.status).toBe(401);
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'staff@isp.example', password: PASSWORD });
      expect(login.status).toBe(401);
    });

    it('[IDN-013] re-enabling lets the account sign in again', async () => {
      const { id } = await staff();
      await patch(id, { disabled: true });

      const res = await patch(id, { disabled: false });

      expect(res.status).toBe(200);
      await expect(
        getToken(app, 'staff@isp.example', PASSWORD)
      ).resolves.toEqual(expect.any(String));
    });

    it('[IDN-065] a role change applies at once: the old token stops, a new sign-in carries the role', async () => {
      const { id, token } = await staff(
        'staff@isp.example',
        'VIEWER'
      );

      await patch(id, { role: 'ADMIN' });

      const stale = await request(app)
        .get(PATH)
        .set('Authorization', as(token));
      expect(stale.status).toBe(401);
      const fresh = await getToken(
        app,
        'staff@isp.example',
        PASSWORD
      );
      const res = await request(app)
        .get(PATH)
        .set('Authorization', as(fresh));
      expect(res.status).toBe(200);
    });

    it('[IDN-140] a password reset replaces the old password', async () => {
      const { id } = await staff();

      await patch(id, { password: 'reset-password' });

      await expect(
        getToken(app, 'staff@isp.example', 'reset-password')
      ).resolves.toEqual(expect.any(String));
      const old = await request(app)
        .post('/api/auth/login')
        .send({ email: 'staff@isp.example', password: PASSWORD });
      expect(old.status).toBe(401);
    });

    it('[IDN-141] 403 — the customer cannot touch the vendor account', async () => {
      await seedUser(
        prisma,
        'vendor@nms.example',
        'vendor-password!',
        'VENDOR'
      );

      const res = await patch(await idOf('vendor@nms.example'), {
        disabled: true
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        'The vendor account is managed by the vendor'
      );
    });

    it('[IDN-143] 403 — an administrator cannot change their own account', async () => {
      const res = await patch(
        await idOf('admin-test@example.local'),
        {
          disabled: true
        }
      );

      expect(res.status).toBe(403);
    });

    it('404 — an unknown user', async () => {
      expect((await patch(GHOST_ID, { disabled: true })).status).toBe(
        404
      );
    });

    it.each([
      ['an empty body', {}],
      ['[IDN-141] the VENDOR role', { role: 'VENDOR' }],
      ['an unknown field', { email: 'x@isp.example' }]
    ])('400 — %s', async (_label, body) => {
      const { id } = await staff();

      expect((await patch(id, body)).status).toBe(400);
    });
  });

  describe('[IDN-172] POST /api/users/:id/two-factor/reset', () => {
    const reset = (id: string, token = adminToken) =>
      request(app)
        .post(`${PATH}/${id}/two-factor/reset`)
        .set('Authorization', as(token));

    it('200 — ends the sessions and the next sign-in sets two-factor up again', async () => {
      const { id, token } = await staff();

      const res = await reset(id);

      expect(res.status).toBe(200);
      expect(res.body.data.twoFactorEnabled).toBe(false);
      const stale = await request(app)
        .get('/api/installation')
        .set('Authorization', as(token));
      expect(stale.status).toBe(401);
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'staff@isp.example', password: PASSWORD });
      expect(login.body.data.twoFactor).toBe('setup');
    });

    it('[IDN-140] the account list shows who has two-factor on', async () => {
      await staff();

      const res = await request(app)
        .get(PATH)
        .set('Authorization', as(adminToken));

      expect(
        res.body.data.users.every(
          (u: { twoFactorEnabled: boolean }) => u.twoFactorEnabled
        )
      ).toBe(true);
    });

    it('403 — an administrator cannot reset an administrator', async () => {
      const { id } = await staff('second-admin@isp.example', 'ADMIN');

      const res = await reset(id);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe(
        "Only the vendor can reset an administrator's two-factor sign-in"
      );
    });

    it('200 — the vendor resets an administrator', async () => {
      const vendorToken = await seedAndGetToken(
        app,
        prisma,
        'VENDOR'
      );

      const res = await reset(
        await idOf('admin-test@example.local'),
        vendorToken
      );

      expect(res.status).toBe(200);
    });

    it('[IDN-141] 403 — nobody resets the vendor account', async () => {
      const vendorToken = await seedAndGetToken(
        app,
        prisma,
        'VENDOR'
      );

      const res = await reset(
        await idOf('vendor-test@example.local'),
        vendorToken
      );

      expect(res.status).toBe(403);
    });

    it('409 — two-factor was never set up', async () => {
      await seedUser(prisma, 'new@isp.example', PASSWORD, 'OPERATOR');

      const res = await reset(await idOf('new@isp.example'));

      expect(res.status).toBe(409);
    });

    it('404 — an unknown user', async () => {
      expect((await reset(GHOST_ID)).status).toBe(404);
    });

    it('400 — a malformed id', async () => {
      expect((await reset('not-a-uuid')).status).toBe(400);
    });
  });

  describe('[IDN-144] POST /api/users/me/password', () => {
    it('200 — any role changes its own password and gets a new token', async () => {
      const { token } = await staff('viewer@isp.example', 'VIEWER');

      const res = await request(app)
        .post(`${PATH}/me/password`)
        .set('Authorization', as(token))
        .send({
          currentPassword: PASSWORD,
          newPassword: 'my-new-password'
        });

      expect(res.status).toBe(200);
      const old = await request(app)
        .get('/api/installation')
        .set('Authorization', as(token));
      expect(old.status).toBe(401);
      const fresh = await request(app)
        .get('/api/installation')
        .set('Authorization', as(res.body.data.token));
      expect(fresh.status).toBe(200);
    });

    it('[IDN-066] a cookie-signed change replaces the session cookie', async () => {
      const { token } = await staff('viewer@isp.example', 'VIEWER');

      const res = await request(app)
        .post(`${PATH}/me/password`)
        .set('Cookie', `nms_session=${token}`)
        .set('Origin', 'http://localhost:3001')
        .send({
          currentPassword: PASSWORD,
          newPassword: 'my-new-password'
        });

      const cookie = (
        res.headers['set-cookie'] as unknown as string[]
      )[0].split(';')[0];
      expect(cookie).toBe(`nms_session=${res.body.data.token}`);
      const fresh = await request(app)
        .get('/api/installation')
        .set('Cookie', cookie);
      expect(fresh.status).toBe(200);
    });

    it('400 — the current password is wrong', async () => {
      const { token } = await staff();

      const res = await request(app)
        .post(`${PATH}/me/password`)
        .set('Authorization', as(token))
        .send({
          currentPassword: 'guess',
          newPassword: 'my-new-password'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Current password is incorrect');
    });
  });

  it('[IDN-065] 401 — a token signed before sessions were versioned', async () => {
    const id = await idOf('admin-test@example.local');
    const legacy = jwt.sign(
      {
        userId: id,
        email: 'admin-test@example.local',
        role: 'ADMIN'
      },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .get(PATH)
      .set('Authorization', as(legacy));

    expect(res.status).toBe(401);
  });
});
