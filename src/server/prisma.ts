import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_DMk1czeCH3fp@ep-gentle-king-b34k3jm5-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: pg.Pool;
};

const pool =
  globalForPrisma.prismaPool ??
  new pg.Pool({
    connectionString,
    // Serverless instances serve few concurrent requests; Neon's pooler fans out from here.
    max: 5,
    // Fail fast rather than hold a request (billed as provisioned memory) open on a stalled
    // connection or a runaway query.
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
    idleTimeoutMillis: 10_000,
  });

const adapter = new PrismaPg(pool);

// Hot reload may retain a client created before a new Prisma model was generated.
export const prisma = globalForPrisma.prisma?.adminLoginAttempt
  ? globalForPrisma.prisma
  : new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}
