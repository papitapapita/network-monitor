import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
config({ path: envFile });

// This file is read only by the Prisma CLI (migrate, generate, studio) —
// never by the running app, which builds its own PrismaPg driver adapter
// straight from DATABASE_URL in container.ts. Prisma ORM v7 removed
// datasource.directUrl from prisma.config.ts (consolidated into a single
// `url`, see https://pris.ly/d/prisma-config), so a separate pooled-vs-direct
// split has to happen here instead: `migrate deploy`'s advisory lock
// (pg_advisory_lock) needs a session-stable connection and times out
// (P1002) through a PgBouncer/Neon pooler. DIRECT_URL is optional — local
// dev's Postgres container has no pooler, so DATABASE_URL is already direct.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''
  }
});
