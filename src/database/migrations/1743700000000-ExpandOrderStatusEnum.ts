import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds 'processing' and 'delivered' to the order_status_enum PostgreSQL type.
 * ADD VALUE is non-transactional in PG — it cannot run inside a transaction block.
 */
export class ExpandOrderStatusEnum1743700000000 implements MigrationInterface {
  name = 'ExpandOrderStatusEnum1743700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "order_status_enum" ADD VALUE IF NOT EXISTS 'processing';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "order_status_enum" ADD VALUE IF NOT EXISTS 'delivered';
      EXCEPTION WHEN others THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values; a full recreate would be needed.
    // Intentionally left as no-op — removal requires a manual migration if ever needed.
  }
}
