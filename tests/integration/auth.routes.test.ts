import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from './helpers/createTestApp';
import { cleanDatabase } from './helpers/db';
import { DependencyContainer } from '../../src/infrastructure/di/container';
import {
  appCode,
  passwordStep,
  seedUser,
  seedAndGetToken,
  setUpTwoFactor
} from './helpers/auth';
import { GHOST_ID } from './helpers/db';
import { JwtTokenService } from '../../src/infrastructure/identity/services/JwtTokenService';

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASS = 'admin-secret-pass';

describe('Auth Routes — /api/auth', () => {
  let app: Application;
  let container: DependencyContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, container } = await createTestApp());
    prisma = container.getPrisma();
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/auth/login
  // ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('[IDN-166] 200 — the right password opens two-factor setup, not a session', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          twoFactor: 'setup',
          challengeToken: expect.any(String)
        }
      });
    });

    it('200 — normalises email to lowercase before lookup', async () => {
      await seedUser(prisma, 'case@test.local', 'pass', 'VIEWER');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'CASE@TEST.LOCAL', password: 'pass' });

      expect(res.status).toBe(200);
    });

    it('401 — rejects wrong password', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('401 — rejects unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.local', password: 'whatever' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('401 — wrong-password and unknown-email return the same error message', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const badPassRes = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'bad' });

      const unknownRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@test.local', password: 'pass' });

      expect(badPassRes.status).toBe(401);
      expect(unknownRes.status).toBe(401);
      expect(badPassRes.body.error).toBe(unknownRes.body.error);
    });

    it('400 — rejects missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: ADMIN_PASS });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: ADMIN_PASS });

      expect(res.status).toBe(400);
    });

    it('400 — rejects empty body', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Authentication enforcement on protected routes
  // ─────────────────────────────────────────────────────────────

  describe('[IDN-104] per-address budget', () => {
    it('counts requests that carry no token', async () => {
      const res = await request(app).get('/api/locations');

      expect(res.status).toBe(401);
      expect(res.headers['ratelimit-limit']).toBe('1000');
    });

    it('counts the agent door too', async () => {
      const res = await request(app).get('/agent/v1/not-a-route');

      expect(res.headers['ratelimit-limit']).toBe('1000');
    });
  });

  describe('Authentication enforcement on protected routes', () => {
    it('401 — GET /api/locations without a token', async () => {
      const res = await request(app).get('/api/locations');

      expect(res.status).toBe(401);
    });

    it('401 — POST /api/locations without a token', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ name: 'Tower', type: 'TOWER' });

      expect(res.status).toBe(401);
    });

    it('401 — returns 401 with a malformed Bearer token', async () => {
      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(res.status).toBe(401);
    });

    it('401 — returns 401 with a non-Bearer Authorization scheme', async () => {
      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
    });

    it('401 — GET /api/devices without a token', async () => {
      const res = await request(app).get('/api/devices');

      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Role-based authorization (RBAC)
  // ─────────────────────────────────────────────────────────────

  describe('Role-based authorization', () => {
    it('200 — ADMIN token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'ADMIN');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('200 — VIEWER token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('200 — OPERATOR token allows GET /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'OPERATOR');

      const res = await request(app)
        .get('/api/locations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('201 — ADMIN token allows POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'ADMIN');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Admin Tower', type: 'TOWER' });

      expect(res.status).toBe(201);
    });

    it('201 — OPERATOR token allows POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'OPERATOR');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Operator Tower', type: 'TOWER' });

      expect(res.status).toBe(201);
    });

    it('403 — VIEWER token blocks POST /api/locations', async () => {
      const token = await seedAndGetToken(app, prisma, 'VIEWER');

      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Forbidden Tower', type: 'TOWER' });

      expect(res.status).toBe(403);
    });

    it('403 — VIEWER token blocks PATCH /api/locations/:id', async () => {
      const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');
      const create = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Target Location', type: 'TOWER' });
      const id = create.body.data.id as string;

      const viewerToken = await seedAndGetToken(
        app,
        prisma,
        'VIEWER'
      );

      const res = await request(app)
        .patch(`/api/locations/${id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(403);
    });

    it('403 — OPERATOR token blocks DELETE /api/vendors/:id', async () => {
      const opToken = await seedAndGetToken(app, prisma, 'OPERATOR');

      // authorize('delete') runs before the controller — OPERATOR gets 403 before any DB lookup
      const res = await request(app)
        .delete(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(403);
    });

    it('404 — ADMIN token is not blocked by RBAC on DELETE /api/vendors/:id', async () => {
      const adminToken = await seedAndGetToken(app, prisma, 'ADMIN');

      // authorize passes for ADMIN → controller runs → 404 because vendor doesn't exist
      const res = await request(app)
        .delete(`/api/vendors/${GHOST_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(403);
      expect(res.status).toBe(404);
    });
  });

  // Its own app: the per-address budget lives in the limiter instance, and
  // the failures above would otherwise share it.
  describe('POST /api/auth/login — repeated failures', () => {
    let freshApp: Application;
    let freshContainer: DependencyContainer;

    beforeEach(async () => {
      ({ app: freshApp, container: freshContainer } =
        await createTestApp());
    });

    afterEach(async () => {
      await freshContainer.disconnect();
    });

    const login = (email: string, password: string) =>
      request(freshApp)
        .post('/api/auth/login')
        .send({ email, password });

    it('[IDN-044] 429 — the right password is refused after five wrong ones', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');
      for (let i = 0; i < 5; i++)
        await login(ADMIN_EMAIL, 'wrong-password');

      const res = await login(ADMIN_EMAIL, ADMIN_PASS);

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        success: false,
        error: 'Too many failed sign-in attempts. Try again later.'
      });
    });

    it('[IDN-103] 429 — an address is refused after ten failed sign-ins', async () => {
      for (let i = 0; i < 10; i++) {
        expect(
          (await login(`ghost${i}@test.local`, 'pass')).status
        ).toBe(401);
      }

      const res = await login('ghost@test.local', 'pass');

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Too many requests');
    });

    it('[IDN-103] successful sign-ins never spend the address budget', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      for (let i = 0; i < 12; i++) {
        expect((await login(ADMIN_EMAIL, ADMIN_PASS)).status).toBe(
          200
        );
      }
    });
  });

  // Its own app, so wrong codes here do not spend the address budget the
  // tests above share.
  describe('Two-factor sign-in — /api/auth/two-factor', () => {
    let freshApp: Application;
    let freshContainer: DependencyContainer;

    beforeEach(async () => {
      ({ app: freshApp, container: freshContainer } =
        await createTestApp());
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');
    });

    afterEach(async () => {
      await freshContainer.disconnect();
    });

    const bearer = (token: string) => `Bearer ${token}`;
    const post = (path: string, token: string | null, body = {}) => {
      const req = request(freshApp).post(
        `/api/auth/two-factor${path}`
      );
      return (
        token ? req.set('Authorization', bearer(token)) : req
      ).send(body);
    };
    const login = () =>
      passwordStep(freshApp, ADMIN_EMAIL, ADMIN_PASS);
    const enrolled = async () =>
      setUpTwoFactor(freshApp, (await login()).challengeToken);

    it('[IDN-168] 200 — setup returns the secret and the app link', async () => {
      const { challengeToken } = await login();

      const res = await post('/setup', challengeToken);

      expect(res.status).toBe(200);
      expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
      expect(res.body.data.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    });

    it('[IDN-169] 200 — confirm returns a working session and ten recovery codes', async () => {
      const { token, recoveryCodes } = await enrolled();

      const res = await request(freshApp)
        .get('/api/locations')
        .set('Authorization', bearer(token));

      expect(recoveryCodes).toHaveLength(10);
      expect(res.status).toBe(200);
    });

    it('[IDN-169] 401 — a wrong code during setup', async () => {
      const { challengeToken } = await login();
      await post('/setup', challengeToken);

      const res = await post('/setup/confirm', challengeToken, {
        code: '000000'
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid code');
    });

    it('[IDN-169] 400 — a code that is not six digits', async () => {
      const { challengeToken } = await login();

      const res = await post('/setup/confirm', challengeToken, {
        code: '12ab'
      });

      expect(res.status).toBe(400);
    });

    it('[IDN-165] 409 — setup cannot replace a working one', async () => {
      const { challengeToken } = await login();
      await setUpTwoFactor(freshApp, challengeToken);

      const res = await post('/setup', challengeToken);

      expect(res.status).toBe(409);
    });

    it('[IDN-166] once on, the password leads to the code step', async () => {
      await enrolled();

      expect((await login()).twoFactor).toBe('verify');
    });

    it('[IDN-170] 200 — a fresh app code signs in', async () => {
      const { secret } = await enrolled();
      const { challengeToken } = await login();

      const res = await post('/verify', challengeToken, {
        code: appCode(secret, 1)
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
      expect(typeof res.body.data.token).toBe('string');
    });

    it('[IDN-164] 401 — the code used during setup is not accepted again', async () => {
      const { secret } = await enrolled();
      const { challengeToken } = await login();

      const res = await post('/verify', challengeToken, {
        code: appCode(secret)
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid code');
    });

    it('[IDN-163] 200 — a recovery code signs in once', async () => {
      const { recoveryCodes } = await enrolled();
      const first = await post(
        '/verify',
        (await login()).challengeToken,
        {
          recoveryCode: recoveryCodes[0]
        }
      );
      const again = await post(
        '/verify',
        (await login()).challengeToken,
        {
          recoveryCode: recoveryCodes[0]
        }
      );

      expect(first.status).toBe(200);
      expect(again.status).toBe(401);
    });

    it('[IDN-170] 400 — both a code and a recovery code, or neither', async () => {
      const { recoveryCodes } = await enrolled();
      const { challengeToken } = await login();

      const both = await post('/verify', challengeToken, {
        code: '123456',
        recoveryCode: recoveryCodes[0]
      });
      const neither = await post('/verify', challengeToken, {});

      expect(both.status).toBe(400);
      expect(neither.status).toBe(400);
    });

    it('[IDN-044] 429 — five wrong codes pause the account', async () => {
      const { secret } = await enrolled();
      const { challengeToken } = await login();
      for (let i = 0; i < 5; i++)
        await post('/verify', challengeToken, { code: '000000' });

      const res = await post('/verify', challengeToken, {
        code: appCode(secret, 1)
      });

      expect(res.status).toBe(429);
    });

    it('[IDN-167] 401 — a challenge never opens a protected route', async () => {
      const { challengeToken } = await login();

      const res = await request(freshApp)
        .get('/api/locations')
        .set('Authorization', bearer(challengeToken));

      expect(res.status).toBe(401);
    });

    it('[IDN-167] 401 — a session token does not pass as a challenge', async () => {
      const { token } = await enrolled();

      const res = await post('/verify', token, { code: '123456' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe(
        'Sign-in step expired. Sign in again.'
      );
    });

    it('[IDN-167] 401 — a setup challenge does not open the code step', async () => {
      const { challengeToken } = await login();

      const res = await post('/verify', challengeToken, {
        code: '123456'
      });

      expect(res.status).toBe(401);
    });

    const rememberedBrowser = async () => {
      const { secret } = await enrolled();
      const res = await post(
        '/verify',
        (await login()).challengeToken,
        {
          code: appCode(secret, 1),
          rememberBrowser: true
        }
      );
      return res.body.data.trustedBrowserToken as string;
    };

    it('[IDN-171] 200 — a remembered browser signs in with the password alone', async () => {
      const trustedBrowserToken = await rememberedBrowser();

      const res = await request(freshApp)
        .post('/api/auth/login')
        .send({
          email: ADMIN_EMAIL,
          password: ADMIN_PASS,
          trustedBrowserToken
        });
      const used = await request(freshApp)
        .get('/api/locations')
        .set('Authorization', bearer(res.body.data.token));

      expect(res.status).toBe(200);
      expect(res.body.data.twoFactor).toBeUndefined();
      expect(used.status).toBe(200);
    });

    it('[IDN-171] 401 — a remembered browser is no session', async () => {
      const trustedBrowserToken = await rememberedBrowser();

      const res = await request(freshApp)
        .get('/api/locations')
        .set('Authorization', bearer(trustedBrowserToken));

      expect(res.status).toBe(401);
    });

    it('[IDN-171] 401 — a remembered browser still needs the right password', async () => {
      const trustedBrowserToken = await rememberedBrowser();

      const res = await request(freshApp)
        .post('/api/auth/login')
        .send({
          email: ADMIN_EMAIL,
          password: 'wrong-password',
          trustedBrowserToken
        });

      expect(res.status).toBe(401);
    });

    const cookieFrom = (res: request.Response, name: string) =>
      ((res.headers['set-cookie'] ?? []) as unknown as string[])
        .find((c) => c.startsWith(`${name}=`))
        ?.split(';')[0];

    const cookieSession = async () => {
      const { secret } = await enrolled();
      const res = await post(
        '/verify',
        (await login()).challengeToken,
        {
          code: appCode(secret, 1),
          rememberBrowser: true
        }
      );
      return {
        session: cookieFrom(res, 'nms_session')!,
        browser: cookieFrom(res, 'nms_trusted_browser')!,
        setCookies: res.headers['set-cookie'] as unknown as string[]
      };
    };

    it('[IDN-066] the sign-in sets an httpOnly session cookie that opens the API alone', async () => {
      const { session, setCookies } = await cookieSession();

      const res = await request(freshApp)
        .get('/api/locations')
        .set('Cookie', session);

      expect(setCookies.join('\n')).toMatch(
        /nms_session=[^;]+;.*HttpOnly.*Secure.*SameSite=Strict/
      );
      expect(res.status).toBe(200);
    });

    it('[IDN-085] 403 — a cookie-signed change without our Origin', async () => {
      const { session } = await cookieSession();

      const foreign = await request(freshApp)
        .post('/api/locations')
        .set('Cookie', session)
        .set('Origin', 'https://evil.example')
        .send({});
      const ours = await request(freshApp)
        .post('/api/locations')
        .set('Cookie', session)
        .set('Origin', 'http://localhost:3001')
        .send({});

      expect(foreign.status).toBe(403);
      expect(foreign.body.error).toBe('Cross-site request refused');
      expect(ours.status).toBe(400);
    });

    it('[IDN-171] the remembered-browser cookie skips the code at login', async () => {
      const { browser } = await cookieSession();

      const res = await request(freshApp)
        .post('/api/auth/login')
        .set('Cookie', browser)
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

      expect(res.status).toBe(200);
      expect(cookieFrom(res, 'nms_session')).toBeDefined();
    });

    it('[IDN-062] logout clears the session cookie', async () => {
      const res = await request(freshApp).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(
        (res.headers['set-cookie'] as unknown as string[])[0]
      ).toMatch(/^nms_session=;.*Expires=Thu, 01 Jan 1970/);
    });

    it('[IDN-167] 401 — no challenge at all', async () => {
      const res = await post('/setup', null);

      expect(res.status).toBe(401);
    });
  });

  // Its own app: the password reset budget (IDN-105) lives in the limiter
  // instance and is ten an hour.
  describe('Forgotten password — /api/auth/password', () => {
    let resetApp: Application;
    let resetContainer: DependencyContainer;
    const tokens = new JwtTokenService();

    beforeAll(async () => {
      ({ app: resetApp, container: resetContainer } =
        await createTestApp());
    });

    afterAll(async () => {
      await resetContainer.disconnect();
    });

    const linkFor = async (email: string) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email }
      });
      return tokens.signChallenge({
        userId: user.id,
        tokenVersion: user.tokenVersion,
        kind: 'password-reset'
      });
    };

    it('[IDN-182] 200 — the same answer for a known and an unknown address', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');

      const known = await request(resetApp)
        .post('/api/auth/password/forgot')
        .send({ email: ADMIN_EMAIL });
      const unknown = await request(resetApp)
        .post('/api/auth/password/forgot')
        .send({ email: 'nobody@test.local' });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual({ success: true, data: null });
      expect(unknown.body).toEqual(known.body);
    });

    it('[IDN-183] 200 — the link sets the password once and ends the sessions', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');
      const token = await linkFor(ADMIN_EMAIL);

      const res = await request(resetApp)
        .post('/api/auth/password/reset')
        .send({ token, password: 'a-brand-new-password' });
      const again = await request(resetApp)
        .post('/api/auth/password/reset')
        .send({ token, password: 'another-new-password' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: null });
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(again.status).toBe(400);
      expect(again.body.error).toBe(
        'Reset link expired or already used'
      );
      const step = await passwordStep(
        resetApp,
        ADMIN_EMAIL,
        'a-brand-new-password'
      );
      expect(step.twoFactor).toBe('setup');
      const row = await prisma.user.findUniqueOrThrow({
        where: { email: ADMIN_EMAIL }
      });
      expect(row.tokenVersion).toBe(1);
    });

    it('[IDN-142] 400 — a short password, and the link still works', async () => {
      await seedUser(prisma, ADMIN_EMAIL, ADMIN_PASS, 'ADMIN');
      const token = await linkFor(ADMIN_EMAIL);

      const res = await request(resetApp)
        .post('/api/auth/password/reset')
        .send({ token, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        'Password must be at least 12 characters'
      );
    });

    it('[IDN-183] 400 — a session token is not a reset link', async () => {
      const session = await seedAndGetToken(
        resetApp,
        prisma,
        'VIEWER'
      );

      const res = await request(resetApp)
        .post('/api/auth/password/reset')
        .send({ token: session, password: 'a-brand-new-password' });

      expect(res.status).toBe(400);
    });

    it('400 — validates both bodies', async () => {
      const forgot = await request(resetApp)
        .post('/api/auth/password/forgot')
        .send({ email: 'not-an-email' });
      const reset = await request(resetApp)
        .post('/api/auth/password/reset')
        .send({ password: 'a-brand-new-password' });

      expect(forgot.status).toBe(400);
      expect(reset.status).toBe(400);
    });

    it('[IDN-105] 429 — an address gets ten requests an hour', async () => {
      const { app: fresh, container: freshContainer } =
        await createTestApp();
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 11; i++) {
          const res = await request(fresh)
            .post('/api/auth/password/forgot')
            .send({ email: 'nobody@test.local' });
          statuses.push(res.status);
        }

        expect(statuses[9]).toBe(200);
        expect(statuses[10]).toBe(429);
      } finally {
        await freshContainer.disconnect();
      }
    });
  });
});
