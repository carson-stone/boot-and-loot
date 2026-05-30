-- AlterTable
ALTER TABLE "card_resolution_options" ADD COLUMN     "reward_json" JSONB NOT NULL DEFAULT '{}';
