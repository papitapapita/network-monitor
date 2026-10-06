import bcrypt from 'bcrypt';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  base32Decode,
  hotp
} from '../../../src/infrastructure/identity/services/TotpTwoFactorCodes';

export type TestRole = 'VENDOR' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

// Recovery codes from each account's setup, spent one per later sign-in, so
// repeated sign-ins never trip over a TOTP code already used (IDN-164).
const unusedRecoveryCodes = new Map<string, string[]>();

export async function seedUser(
  prisma: PrismaClient,
  email: string,
  password: string,
  role: TestRole = 'ADMIN'
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      disabledAt: null,
      failedSignIns: 0,
      signInPausedUntil: null,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastStep: null,
      recoveryCodeHashes: []
    },
    create: { email, passwordHash, role }
  });
  unusedRecoveryCodes.delete(email);
}

// The code an authenticator app would show now, `offset` steps away.
export function appCode(secret: string, offset = 0): string {
  const step = Math.floor(Date.now() / 30_000) + offset;
  return hotp(base32Decode(secret)!, step);
}

export async function passwordStep(
  app: Application,
  email: string,
  password: string
): Promise<{
  twoFactor: 'verify' | 'setup';
  challengeToken: string;
}> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(
      `Login failed (${res.status}): ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data;
}

export async function setUpTwoFactor(
  app: Application,
  challengeToken: string
): Promise<{
  token: string;
  secret: string;
  recoveryCodes: string[];
}> {
  const started = await request(app)
    .post('/api/auth/two-factor/setup')
    .set('Authorization', `Bearer ${challengeToken}`);
  if (started.status !== 200) {
    throw new Error(`Setup failed (${started.status})`);
  }
  const { secret } = started.body.data;
  const confirmed = await request(app)
    .post('/api/auth/two-factor/setup/confirm')
    .set('Authorization', `Bearer ${challengeToken}`)
    .send({ code: appCode(secret) });
  if (confirmed.status !== 200) {
    throw new Error(
      `Confirm failed (${confirmed.status}): ${JSON.stringify(confirmed.body)}`
    );
  }
  return {
    token: confirmed.body.data.token,
    secret,
    recoveryCodes: confirmed.body.data.recoveryCodes
  };
}

// The whole sign-in: password, then two-factor setup the first time or a
// recovery code afterwards.
export async function getToken(
  app: Application,
  email: string,
  password: string
): Promise<string> {
  const { twoFactor, challengeToken } = await passwordStep(
    app,
    email,
    password
  );

  if (twoFactor === 'setup') {
    const { token, recoveryCodes } = await setUpTwoFactor(
      app,
      challengeToken
    );
    unusedRecoveryCodes.set(email, recoveryCodes);
    return token;
  }

  const recoveryCode = unusedRecoveryCodes.get(email)?.shift();
  if (!recoveryCode) {
    throw new Error(`No recovery code left for ${email}`);
  }
  const res = await request(app)
    .post('/api/auth/two-factor/verify')
    .set('Authorization', `Bearer ${challengeToken}`)
    .send({ recoveryCode });
  if (res.status !== 200) {
    throw new Error(
      `Verify failed (${res.status}): ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data.token as string;
}

export async function seedAndGetToken(
  app: Application,
  prisma: PrismaClient,
  role: TestRole
): Promise<string> {
  const email = `${role.toLowerCase()}-test@example.local`;
  const password = 'integration-test-pass';
  await seedUser(prisma, email, password, role);
  return getToken(app, email, password);
}
