-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('monster', 'device', 'companion');

-- CreateEnum
CREATE TYPE "CardPool" AS ENUM ('starter', 'static', 'dynamic');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('waiting', 'active', 'finished');

-- CreateEnum
CREATE TYPE "CardLocation" AS ENUM ('static_market', 'dynamic_market', 'dynamic_deck', 'player_deck', 'player_hand', 'player_play_area', 'player_discard', 'trashed');

-- CreateTable
CREATE TABLE "maps" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_entrance" BOOLEAN NOT NULL DEFAULT false,
    "is_exit" BOOLEAN NOT NULL DEFAULT false,
    "is_market" BOOLEAN NOT NULL DEFAULT false,
    "has_artifact_slot" BOOLEAN NOT NULL DEFAULT false,
    "monster_count" INTEGER NOT NULL DEFAULT 0,
    "position_x" INTEGER,
    "position_y" INTEGER,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_connections" (
    "id" UUID NOT NULL,
    "from_room_id" UUID NOT NULL,
    "to_room_id" UUID NOT NULL,
    "movement_cost" INTEGER NOT NULL DEFAULT 1,
    "requires_tool" TEXT,
    "description" TEXT,

    CONSTRAINT "room_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost_gold" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_definitions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reputation_points" INTEGER NOT NULL,
    "flavor_text" TEXT,

    CONSTRAINT "artifact_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_artifact_placements" (
    "id" UUID NOT NULL,
    "map_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "artifact_definition_id" UUID NOT NULL,

    CONSTRAINT "map_artifact_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_definitions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "card_type" "CardType" NOT NULL,
    "pool" "CardPool" NOT NULL,
    "cost_gold" INTEGER NOT NULL DEFAULT 0,
    "is_one_time_use" BOOLEAN NOT NULL DEFAULT false,
    "triggers_horde" BOOLEAN NOT NULL DEFAULT false,
    "is_killable_threat" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "flavor_text" TEXT,
    "total_quantity" INTEGER NOT NULL,

    CONSTRAINT "card_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_effects" (
    "id" UUID NOT NULL,
    "card_definition_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "effect_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "parameters_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "card_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_resolution_options" (
    "id" UUID NOT NULL,
    "card_definition_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "cost_attacks" INTEGER NOT NULL DEFAULT 0,
    "cost_gold" INTEGER NOT NULL DEFAULT 0,
    "cost_attention" INTEGER NOT NULL DEFAULT 0,
    "cost_health" INTEGER NOT NULL DEFAULT 0,
    "special_cost_json" JSONB NOT NULL DEFAULT '{}',
    "reward_gold" INTEGER NOT NULL DEFAULT 0,
    "reward_reputation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "card_resolution_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'waiting',
    "map_id" UUID NOT NULL,
    "max_players" INTEGER NOT NULL DEFAULT 5,
    "attention_pool_size" INTEGER NOT NULL DEFAULT 20,
    "horde_damage_amount" INTEGER NOT NULL DEFAULT 3,
    "current_turn_id" UUID,
    "winner_player_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "turn_order" INTEGER NOT NULL,
    "current_room_id" UUID,
    "max_health" INTEGER NOT NULL DEFAULT 10,
    "current_health" INTEGER NOT NULL DEFAULT 10,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "attention_points" INTEGER NOT NULL DEFAULT 0,
    "artifact_capacity" INTEGER NOT NULL DEFAULT 1,
    "has_exited" BOOLEAN NOT NULL DEFAULT false,
    "is_dead" BOOLEAN NOT NULL DEFAULT false,
    "reputation_final" INTEGER,
    "exited_at" TIMESTAMPTZ,
    "died_at" TIMESTAMPTZ,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_tools" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "tool_definition_id" UUID NOT NULL,
    "acquired_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_artifacts" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "artifact_definition_id" UUID NOT NULL,
    "room_id" UUID,
    "held_by_player_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_cards" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "card_definition_id" UUID NOT NULL,
    "location" "CardLocation" NOT NULL,
    "player_id" UUID,
    "dynamic_slot_index" INTEGER,
    "deck_position" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "starting_room_id" UUID,
    "starting_health" INTEGER,
    "starting_attention" INTEGER,
    "gold_earned" INTEGER NOT NULL DEFAULT 0,
    "gold_spent" INTEGER NOT NULL DEFAULT 0,
    "movement_used" INTEGER NOT NULL DEFAULT 0,
    "attacks_used" INTEGER NOT NULL DEFAULT 0,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reputation_points" INTEGER NOT NULL,

    CONSTRAINT "achievement_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_achievements" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "achievement_definition_id" UUID NOT NULL,
    "earned_on_turn_id" UUID,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horde_attacks" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "turn_id" UUID NOT NULL,
    "triggering_card_id" UUID,
    "pool_size_before" INTEGER NOT NULL,
    "points_removed" INTEGER NOT NULL,
    "damage_distribution" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horde_attacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maps_name_key" ON "maps"("name");

-- CreateIndex
CREATE INDEX "rooms_map_id_idx" ON "rooms"("map_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_map_id_name_key" ON "rooms"("map_id", "name");

-- CreateIndex
CREATE INDEX "room_connections_from_room_id_idx" ON "room_connections"("from_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_connections_from_room_id_to_room_id_key" ON "room_connections"("from_room_id", "to_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "tool_definitions_code_key" ON "tool_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_definitions_name_key" ON "artifact_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "map_artifact_placements_map_id_room_id_key" ON "map_artifact_placements"("map_id", "room_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_definitions_name_key" ON "card_definitions"("name");

-- CreateIndex
CREATE INDEX "card_effects_card_definition_id_display_order_idx" ON "card_effects"("card_definition_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "card_effects_card_definition_id_display_order_key" ON "card_effects"("card_definition_id", "display_order");

-- CreateIndex
CREATE INDEX "card_resolution_options_card_definition_id_display_order_idx" ON "card_resolution_options"("card_definition_id", "display_order");

-- CreateIndex
CREATE INDEX "players_game_id_idx" ON "players"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_game_id_turn_order_key" ON "players"("game_id", "turn_order");

-- CreateIndex
CREATE UNIQUE INDEX "players_game_id_name_key" ON "players"("game_id", "name");

-- CreateIndex
CREATE INDEX "player_tools_player_id_idx" ON "player_tools"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_tools_player_id_tool_definition_id_key" ON "player_tools"("player_id", "tool_definition_id");

-- CreateIndex
CREATE INDEX "game_artifacts_game_id_idx" ON "game_artifacts"("game_id");

-- CreateIndex
CREATE INDEX "game_artifacts_room_id_idx" ON "game_artifacts"("room_id");

-- CreateIndex
CREATE INDEX "game_artifacts_held_by_player_id_idx" ON "game_artifacts"("held_by_player_id");

-- CreateIndex
CREATE INDEX "game_cards_game_id_location_player_id_idx" ON "game_cards"("game_id", "location", "player_id");

-- CreateIndex
CREATE INDEX "game_cards_game_id_dynamic_slot_index_idx" ON "game_cards"("game_id", "dynamic_slot_index");

-- CreateIndex
CREATE INDEX "turns_game_id_turn_number_idx" ON "turns"("game_id", "turn_number");

-- CreateIndex
CREATE UNIQUE INDEX "turns_game_id_turn_number_key" ON "turns"("game_id", "turn_number");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definitions_code_key" ON "achievement_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "player_achievements_player_id_achievement_definition_id_key" ON "player_achievements"("player_id", "achievement_definition_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_connections" ADD CONSTRAINT "room_connections_from_room_id_fkey" FOREIGN KEY ("from_room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_connections" ADD CONSTRAINT "room_connections_to_room_id_fkey" FOREIGN KEY ("to_room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_artifact_placements" ADD CONSTRAINT "map_artifact_placements_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_artifact_placements" ADD CONSTRAINT "map_artifact_placements_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_artifact_placements" ADD CONSTRAINT "map_artifact_placements_artifact_definition_id_fkey" FOREIGN KEY ("artifact_definition_id") REFERENCES "artifact_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_effects" ADD CONSTRAINT "card_effects_card_definition_id_fkey" FOREIGN KEY ("card_definition_id") REFERENCES "card_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_resolution_options" ADD CONSTRAINT "card_resolution_options_card_definition_id_fkey" FOREIGN KEY ("card_definition_id") REFERENCES "card_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_current_turn_id_fkey" FOREIGN KEY ("current_turn_id") REFERENCES "turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_player_id_fkey" FOREIGN KEY ("winner_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_current_room_id_fkey" FOREIGN KEY ("current_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_tools" ADD CONSTRAINT "player_tools_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_tools" ADD CONSTRAINT "player_tools_tool_definition_id_fkey" FOREIGN KEY ("tool_definition_id") REFERENCES "tool_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_artifacts" ADD CONSTRAINT "game_artifacts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_artifacts" ADD CONSTRAINT "game_artifacts_artifact_definition_id_fkey" FOREIGN KEY ("artifact_definition_id") REFERENCES "artifact_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_artifacts" ADD CONSTRAINT "game_artifacts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_artifacts" ADD CONSTRAINT "game_artifacts_held_by_player_id_fkey" FOREIGN KEY ("held_by_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_cards" ADD CONSTRAINT "game_cards_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_cards" ADD CONSTRAINT "game_cards_card_definition_id_fkey" FOREIGN KEY ("card_definition_id") REFERENCES "card_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_cards" ADD CONSTRAINT "game_cards_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_starting_room_id_fkey" FOREIGN KEY ("starting_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_achievement_definition_id_fkey" FOREIGN KEY ("achievement_definition_id") REFERENCES "achievement_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_earned_on_turn_id_fkey" FOREIGN KEY ("earned_on_turn_id") REFERENCES "turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horde_attacks" ADD CONSTRAINT "horde_attacks_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horde_attacks" ADD CONSTRAINT "horde_attacks_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "turns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horde_attacks" ADD CONSTRAINT "horde_attacks_triggering_card_id_fkey" FOREIGN KEY ("triggering_card_id") REFERENCES "game_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
