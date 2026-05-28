-- =====================================================================
-- BOOT & LOOT — CONSOLIDATED SCHEMA (REFERENCE ONLY)
-- The actual schema is managed by Prisma (prisma/schema.prisma).
-- This file exists as a reference for the original SQL design.
-- Do not apply this file directly to the database.
-- =====================================================================


-- =====================================================================
-- 1. MAPS, ROOMS, AND CONNECTIONS
-- =====================================================================

CREATE TABLE maps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id              UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  is_entrance         BOOLEAN NOT NULL DEFAULT FALSE,
  is_exit             BOOLEAN NOT NULL DEFAULT FALSE,
  is_market           BOOLEAN NOT NULL DEFAULT FALSE,
  has_artifact_slot   BOOLEAN NOT NULL DEFAULT FALSE,
  monster_count       INT NOT NULL DEFAULT 0 CHECK (monster_count >= 0),
  position_x          INT,
  position_y          INT,
  UNIQUE (map_id, name)
);

CREATE INDEX idx_rooms_map ON rooms (map_id);

CREATE TABLE room_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  to_room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  movement_cost   INT NOT NULL DEFAULT 1 CHECK (movement_cost > 0),
  requires_tool   TEXT,
  description     TEXT,
  CHECK (from_room_id <> to_room_id),
  UNIQUE (from_room_id, to_room_id)
);

CREATE INDEX idx_connections_from ON room_connections (from_room_id);

CREATE TABLE tool_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  cost_gold     INT NOT NULL DEFAULT 0 CHECK (cost_gold >= 0)
);

CREATE TABLE artifact_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  description         TEXT,
  reputation_points   INT NOT NULL CHECK (reputation_points >= 0),
  flavor_text         TEXT
);

CREATE TABLE map_artifact_placements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id                  UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  room_id                 UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  artifact_definition_id  UUID NOT NULL REFERENCES artifact_definitions(id),
  UNIQUE (map_id, room_id)
);

CREATE TABLE card_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  card_type           TEXT NOT NULL CHECK (card_type IN ('monster', 'device', 'companion')),
  pool                TEXT NOT NULL CHECK (pool IN ('starter', 'static', 'dynamic')),
  cost_gold           INT NOT NULL DEFAULT 0 CHECK (cost_gold >= 0),
  is_one_time_use     BOOLEAN NOT NULL DEFAULT FALSE,
  triggers_horde      BOOLEAN NOT NULL DEFAULT FALSE,
  is_killable_threat  BOOLEAN NOT NULL DEFAULT FALSE,
  description         TEXT,
  flavor_text         TEXT,
  total_quantity      INT NOT NULL CHECK (total_quantity > 0)
);

CREATE TABLE card_effects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_definition_id   UUID NOT NULL REFERENCES card_definitions(id) ON DELETE CASCADE,
  display_order        INT NOT NULL DEFAULT 0,
  effect_type          TEXT NOT NULL,
  amount               INT NOT NULL DEFAULT 0,
  parameters_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (card_definition_id, display_order)
);

CREATE INDEX idx_card_effects_card ON card_effects (card_definition_id, display_order);

CREATE TABLE card_resolution_options (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_definition_id          UUID NOT NULL REFERENCES card_definitions(id) ON DELETE CASCADE,
  label                       TEXT NOT NULL,
  display_order               INT NOT NULL DEFAULT 0,
  cost_attacks                INT NOT NULL DEFAULT 0 CHECK (cost_attacks >= 0),
  cost_gold                   INT NOT NULL DEFAULT 0 CHECK (cost_gold >= 0),
  cost_attention              INT NOT NULL DEFAULT 0 CHECK (cost_attention >= 0),
  cost_health                 INT NOT NULL DEFAULT 0 CHECK (cost_health >= 0),
  special_cost_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_gold                 INT NOT NULL DEFAULT 0 CHECK (reward_gold >= 0),
  reward_reputation           INT NOT NULL DEFAULT 0 CHECK (reward_reputation >= 0),
  CHECK (
    cost_attacks + cost_gold + cost_attention + cost_health > 0
    OR special_cost_json <> '{}'::jsonb
  )
);

CREATE INDEX idx_resolution_options_card ON card_resolution_options (card_definition_id, display_order);

CREATE TABLE games (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status                  TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  map_id                  UUID NOT NULL REFERENCES maps(id),
  max_players             INT NOT NULL DEFAULT 5 CHECK (max_players BETWEEN 2 AND 5),
  attention_pool_size     INT NOT NULL DEFAULT 20,
  horde_damage_amount     INT NOT NULL DEFAULT 3,
  current_turn_id         UUID,
  winner_player_id        UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id                 UUID,
  name                    TEXT NOT NULL,
  turn_order              INT NOT NULL CHECK (turn_order >= 0),
  current_room_id         UUID REFERENCES rooms(id),
  max_health              INT NOT NULL DEFAULT 10 CHECK (max_health > 0),
  current_health          INT NOT NULL DEFAULT 10 CHECK (current_health >= 0),
  gold                    INT NOT NULL DEFAULT 0,
  attention_points        INT NOT NULL DEFAULT 0 CHECK (attention_points >= 0),
  artifact_capacity       INT NOT NULL DEFAULT 1 CHECK (artifact_capacity > 0),
  has_exited              BOOLEAN NOT NULL DEFAULT FALSE,
  is_dead                 BOOLEAN NOT NULL DEFAULT FALSE,
  reputation_final        INT,
  exited_at               TIMESTAMPTZ,
  died_at                 TIMESTAMPTZ,
  UNIQUE (game_id, turn_order),
  UNIQUE (game_id, name)
);

CREATE INDEX idx_players_game ON players (game_id);

CREATE TABLE player_tools (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id             UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tool_definition_id    UUID NOT NULL REFERENCES tool_definitions(id),
  acquired_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, tool_definition_id)
);

CREATE INDEX idx_player_tools_player ON player_tools (player_id);

CREATE TABLE game_artifacts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                  UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  artifact_definition_id   UUID NOT NULL REFERENCES artifact_definitions(id),
  room_id                  UUID REFERENCES rooms(id),
  held_by_player_id        UUID REFERENCES players(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (room_id IS NOT NULL AND held_by_player_id IS NULL) OR
    (room_id IS NULL AND held_by_player_id IS NOT NULL)
  )
);

CREATE INDEX idx_game_artifacts_game ON game_artifacts (game_id);
CREATE INDEX idx_game_artifacts_room ON game_artifacts (room_id);
CREATE INDEX idx_game_artifacts_holder ON game_artifacts (held_by_player_id);

CREATE TABLE game_cards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  card_definition_id      UUID NOT NULL REFERENCES card_definitions(id),
  location                TEXT NOT NULL CHECK (location IN (
    'static_market', 'dynamic_market', 'dynamic_deck',
    'player_deck', 'player_hand', 'player_play_area', 'player_discard', 'trashed'
  )),
  player_id               UUID REFERENCES players(id),
  dynamic_slot_index      INT CHECK (dynamic_slot_index BETWEEN 0 AND 4),
  deck_position           INT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (location IN ('player_deck','player_hand','player_play_area','player_discard') AND player_id IS NOT NULL)
    OR (location IN ('static_market','dynamic_market','dynamic_deck','trashed') AND player_id IS NULL)
  ),
  CHECK (
    (location = 'dynamic_market' AND dynamic_slot_index IS NOT NULL)
    OR (location <> 'dynamic_market' AND dynamic_slot_index IS NULL)
  )
);

CREATE INDEX idx_game_cards_lookup ON game_cards (game_id, location, player_id);
CREATE INDEX idx_game_cards_dyn_slot ON game_cards (game_id, dynamic_slot_index) WHERE location = 'dynamic_market';

CREATE TABLE turns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id               UUID NOT NULL REFERENCES players(id),
  turn_number             INT NOT NULL CHECK (turn_number > 0),
  starting_room_id        UUID REFERENCES rooms(id),
  starting_health         INT,
  starting_attention      INT,
  gold_earned             INT NOT NULL DEFAULT 0,
  gold_spent              INT NOT NULL DEFAULT 0,
  movement_used           INT NOT NULL DEFAULT 0,
  attacks_used            INT NOT NULL DEFAULT 0,
  actions                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ,
  UNIQUE (game_id, turn_number)
);

CREATE INDEX idx_turns_game ON turns (game_id, turn_number);

CREATE TABLE achievement_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  reputation_points   INT NOT NULL CHECK (reputation_points >= 0)
);

CREATE TABLE player_achievements (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id                   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_definition_id   UUID NOT NULL REFERENCES achievement_definitions(id),
  earned_on_turn_id           UUID REFERENCES turns(id),
  earned_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, achievement_definition_id)
);

CREATE TABLE horde_attacks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                 UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn_id                 UUID NOT NULL REFERENCES turns(id),
  triggering_card_id      UUID REFERENCES game_cards(id),
  pool_size_before        INT NOT NULL,
  points_removed          INT NOT NULL,
  damage_distribution     JSONB NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE games
  ADD CONSTRAINT games_current_turn_fk
  FOREIGN KEY (current_turn_id) REFERENCES turns(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE games
  ADD CONSTRAINT games_winner_fk
  FOREIGN KEY (winner_player_id) REFERENCES players(id)
  DEFERRABLE INITIALLY DEFERRED;
