import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    url: env('DATABASE_URL'),
    // @ts-expect-error directUrl not yet typed in PrismaConfig but supported at runtime

    directUrl: env('DIRECT_URL') // Use direct connection for migrations and CLI operations
  }
});
