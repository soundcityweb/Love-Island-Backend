import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a unique `slug` column to the `products` table.
 * Existing rows get a temporary slug derived from their id; update them
 * via the admin panel to real human-readable slugs before going live.
 */
export class AddProductSlug1739262300000 implements MigrationInterface {
  name = 'AddProductSlug1739262300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add as nullable first so existing rows don't violate NOT NULL
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "slug" varchar(256)
    `);

    // Back-fill existing rows with their id as a temporary slug
    await queryRunner.query(`
      UPDATE "products"
      SET "slug" = id::text
      WHERE "slug" IS NULL
    `);

    // Now enforce NOT NULL + unique
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "slug" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_products_slug'
        ) THEN
          ALTER TABLE "products"
          ADD CONSTRAINT "UQ_products_slug" UNIQUE ("slug");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_slug"
        ON "products" ("slug")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_slug"`);
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP CONSTRAINT IF EXISTS "UQ_products_slug"
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN IF EXISTS "slug"
    `);
  }
}
