import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponsTable1743700300000 implements MigrationInterface {
  name = 'CreateCouponsTable1743700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "discount_type_enum" AS ENUM ('percentage', 'flat');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "discount_type" "discount_type_enum" NOT NULL,
        "discount_value" decimal(10,2) NOT NULL,
        "min_order_amount" decimal(12,2) DEFAULT NULL,
        "max_uses" integer DEFAULT NULL,
        "used_count" integer NOT NULL DEFAULT 0,
        "expires_at" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupons_code" UNIQUE ("code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "discount_type_enum"`);
  }
}
