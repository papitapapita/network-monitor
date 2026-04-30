import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
config({ path: envFile });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    url: env('DATABASE_URL'),
    // @ts-expect-error directUrl not yet typed in PrismaConfig but supported at runtime
    directUrl: env('DIRECT_URL')
  }
});
