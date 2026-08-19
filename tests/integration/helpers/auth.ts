import bcrypt from 'bcrypt';
import request from 'supertest';
import { Application } from 'express';
import { PrismaClient } from '../../../src/generated/prisma/client';

export type TestRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export async function seedUser(
  prisma: PrismaClient,
  email: string,
  password: string,
  role: TestRole = 'ADMIN'
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, passwordHash, role }
  });
}

export async function getToken(
  app: Application,
  email: string,
  password: string
): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(
      `Login failed (${res.status}): ${JSON.stringify(res.body)}`
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
