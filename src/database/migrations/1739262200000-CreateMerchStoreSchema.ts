import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Merch store schema: products, product_images, orders, order_items, payments, carts, cart_items.
 * Indexes on product_id and order_id for lookups. No denormalization.
 */
export class CreateMerchStoreSchema1739262200000 implements MigrationInterface {
  name = 'CreateMerchStoreSchema1739262200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_status_enum" AS ENUM (
          'pending', 'paid', 'failed', 'shipped', 'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "slug" varchar(256) NOT NULL,
        "description" text,
        "base_price" decimal(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'NGN',
        "category" varchar(64) NOT NULL DEFAULT 'Apparel',
        "stock" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_slug"
        ON "products" ("slug")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "url" varchar(512) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_product_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_images_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_images_product_id"
        ON "product_images" ("product_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_number" varchar NOT NULL,
        "customer_first_name" varchar NOT NULL,
        "customer_last_name" varchar NOT NULL,
        "customer_email" varchar NOT NULL,
        "customer_phone" varchar(32),
        "shipping_address" varchar NOT NULL,
        "shipping_city" varchar NOT NULL,
        "shipping_state" varchar NOT NULL,
        "subtotal_amount" decimal(12,2) NOT NULL,
        "shipping_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "total_amount" decimal(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "status" "order_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_number" UNIQUE ("order_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "price_snapshot" decimal(12,2) NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_order_id"
        ON "order_items" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_items_product_id"
        ON "order_items" ("product_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "gateway_reference" varchar,
        "status" varchar(64) NOT NULL,
        "payload_json" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_order_id"
        ON "payments" ("order_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" varchar(512) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_carts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "cart_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_cart_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cart_items_cart" FOREIGN KEY ("cart_id")
          REFERENCES "carts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cart_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cart_items_cart_id"
        ON "cart_items" ("cart_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cart_items_product_id"
        ON "cart_items" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_items_product_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_items_cart_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_order_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_product_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_items_order_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_images_product_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_images"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_slug"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
  }
}
