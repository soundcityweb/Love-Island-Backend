import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the categories table, seeds default categories derived from
 * existing product data, adds category_id FK to products, backfills it,
 * then drops the legacy category varchar column.
 */
export class CreateCategoriesAndMigrateProducts1743700200000
  implements MigrationInterface
{
  name = 'CreateCategoriesAndMigrateProducts1743700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create categories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "slug" varchar(120) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);

    // 2. Seed default categories
    await queryRunner.query(`
      INSERT INTO "categories" ("name", "slug", "sort_order") VALUES
        ('Apparel',     'apparel',     1),
        ('Accessories', 'accessories', 2),
        ('Lifestyle',   'lifestyle',   3)
      ON CONFLICT DO NOTHING
    `);

    // 3. Add category_id FK column (nullable for safety)
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    // 4. Backfill category_id from legacy category varchar (only if the column still exists)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category'
        ) THEN
          UPDATE "products" p
            SET "category_id" = c.id
            FROM "categories" c
            WHERE LOWER(p.category) = LOWER(c.name);
        END IF;
      END $$;
    `);

    // 5. Drop the legacy category varchar column
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "category"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add legacy column and restore from categories join
    await queryRunner.query(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category" varchar(64) NOT NULL DEFAULT 'Apparel'
    `);
    await queryRunner.query(`
      UPDATE "products" p
        SET "category" = COALESCE(c.name, 'Apparel')
        FROM "categories" c
        WHERE c.id = p.category_id
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "category_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
