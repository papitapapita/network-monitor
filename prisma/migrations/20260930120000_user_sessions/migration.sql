-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabled_at" TIMESTAMPTZ,
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;
