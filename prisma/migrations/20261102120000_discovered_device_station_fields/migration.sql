-- AlterTable
ALTER TABLE "discovered_devices" ADD COLUMN     "access_point_id" UUID,
ADD COLUMN     "hostname" VARCHAR(100),
ADD COLUMN     "model" VARCHAR(100);
