import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the admin authentication infrastructure:
 *   1. `admin_users`  — stores admin credentials, roles, and session metadata.
 *   2. `audit_logs`   — immutable record of every admin action.
 */
export class CreateAdminUsersAndAuditLogs1744000000000
  implements MigrationInterface
{
  name = 'CreateAdminUsersAndAuditLogs1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Admin role enum ────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "admin_role_enum" AS ENUM ('super_admin', 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── 2. admin_users ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_users" (
        "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
        "name"                   VARCHAR(255) NOT NULL,
        "email"                  VARCHAR(255) NOT NULL,
        "password_hash"          VARCHAR(255) NOT NULL,
        "role"                   "admin_role_enum" NOT NULL DEFAULT 'admin',
        "is_active"              BOOLEAN     NOT NULL DEFAULT TRUE,
        "last_login_at"          TIMESTAMPTZ,
        "last_login_ip"          VARCHAR(45),
        "refresh_token_hash"     VARCHAR(255),
        "failed_login_attempts"  INT         NOT NULL DEFAULT 0,
        "locked_until"           TIMESTAMPTZ,
        "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_admin_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_users_email"
        ON "admin_users" ("email")
    `);

    // ── 3. audit_logs ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
        "admin_user_id"  UUID,
        "admin_email"    VARCHAR(255),
        "admin_role"     VARCHAR(50),
        "action"         VARCHAR(100) NOT NULL,
        "resource"       VARCHAR(100),
        "resource_id"    VARCHAR(255),
        "metadata"       JSONB,
        "ip_address"     VARCHAR(45),
        "user_agent"     TEXT,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_admin_user_id"
        ON "audit_logs" ("admin_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at"
        ON "audit_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "admin_role_enum"`);
  }
}
