-- AlterTable
ALTER TABLE "card_definitions" ADD COLUMN     "cost_focus" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "focus" INTEGER NOT NULL DEFAULT 0;
