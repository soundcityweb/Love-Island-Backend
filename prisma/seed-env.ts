/**
 * PgBouncer / Supabase transaction pooler: Prisma must use `pgbouncer=true` or you get
 * "prepared statement \"s0\" already exists". Applied before PrismaClient loads.
 */
const u = process.env.DATABASE_URL;
if (u && !u.includes('pgbouncer=true')) {
  const pooled =
    /:6543(\/|\?|$)/.test(u) ||
    /\.pooler\./i.test(u) ||
    process.env.FORCE_PRISMA_PGBOUNCER_MODE === '1';
  if (pooled) {
    process.env.DATABASE_URL = u.includes('?')
      ? `${u}&pgbouncer=true`
      : `${u}?pgbouncer=true`;
  }
}
