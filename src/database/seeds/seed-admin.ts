/**
 * Seed the first Super Admin user.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-admin.ts
 *
 * Set environment variables before running:
 *   ADMIN_SEED_EMAIL=your@email.com
 *   ADMIN_SEED_PASSWORD=YourSecurePassword123!
 *   ADMIN_SEED_NAME="Your Name"
 *   DATABASE_URL=postgresql://...
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com';
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'password';
  const name = process.env.ADMIN_SEED_NAME ?? 'Super Admin';

  if (!email || !password) {
    console.error(
      'ERROR: Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD before running this script.',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ERROR: Seed password must be at least 12 characters.');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [AdminUser],
    synchronize: false,
    ssl: process.env.DATABASE_URL?.includes('supabase.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  await ds.initialize();

  const repo = ds.getRepository(AdminUser);

  const existing = await repo.findOne({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log(`Admin user ${email} already exists. Skipping.`);
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await repo.save(
    repo.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    }),
  );

  console.log(`✅ Super Admin created: ${email}`);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
