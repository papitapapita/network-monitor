-- AlterEnum
ALTER TYPE "ticket_category" ADD VALUE 'SITE_SURVEY';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "contact_name" VARCHAR(150),
ADD COLUMN     "contact_phone" VARCHAR(20);

-- A phone with no name is a number nobody knows who to ask for; the
-- TicketContact value object refuses it, and so does the table.
ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_contact_phone_requires_name"
CHECK ("contact_phone" IS NULL OR "contact_name" IS NOT NULL);
