import { PrismaClient } from '../../../src/generated/prisma/client';
import { seedUser, TestRole } from './auth';

export const PUSH_KEYS = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA',
  auth: 'tBHItJI5svbpez7KI4CCXg'
};

/** Upserts a user and returns its id. */
export async function seedPushUser(
  prisma: PrismaClient,
  email: string,
  role: TestRole = 'OPERATOR'
): Promise<string> {
  await seedUser(prisma, email, 'integration-test-pass', role);
  const user = await prisma.user.findUniqueOrThrow({
    where: { email }
  });
  return user.id;
}

/** Inserts a push subscription for the user and returns its id. */
export async function seedPushSubscription(
  prisma: PrismaClient,
  userId: string,
  endpoint: string
): Promise<string> {
  const row = await prisma.pushSubscription.create({
    data: { userId, endpoint, ...PUSH_KEYS }
  });
  return row.id;
}
