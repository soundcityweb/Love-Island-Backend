/**
 * Seed default CMS static pages (Privacy Policy, Terms & Conditions).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-cms-pages.ts
 *
 * Requires DATABASE_URL.
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import { CmsPage, CmsPageStatus } from '../../entities/cms-page.entity';

const PAGES: Array<Pick<CmsPage, 'title' | 'slug' | 'content' | 'status'>> = [
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    content:
      '<h1>Privacy Policy</h1><p>Update this from admin panel</p>',
    status: CmsPageStatus.DRAFT,
  },
  {
    title: 'Terms & Conditions',
    slug: 'terms-conditions',
    content:
      '<h1>Terms & Conditions</h1><p>Update this from admin panel</p>',
    status: CmsPageStatus.DRAFT,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [CmsPage],
    synchronize: false,
    ssl: process.env.DATABASE_URL?.includes('supabase.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  await ds.initialize();
  const repo = ds.getRepository(CmsPage);

  for (const row of PAGES) {
    const existing = await repo.findOne({ where: { slug: row.slug } });
    if (existing) {
      console.log(`CMS page "${row.slug}" already exists. Skipping.`);
      continue;
    }
    await repo.save(repo.create(row));
    console.log(`✅ CMS page created: ${row.slug}`);
  }

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
