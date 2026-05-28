# Boot & Loot — Project Context

This document captures the design decisions, architecture, and rationale for
the Boot & Loot game project. Read this before making changes so you
understand WHY the code is shaped the way it is.

## Game Overview

Boot & Loot is a multiplayer turn-based deck-building dungeon crawler for
2–5 players. Players are adventurers descending into a shared dungeon,
collecting artifacts, fighting monsters and threats, and racing to escape
with the most Reputation Points before dying.

Core mechanics:

- Deck-building (Dominion-style): start with 10 identical cards, buy more
  from markets, deck-cycle each turn
- Shared map with rooms, tunnels, and gated passages
- Attention Points system: visible-to-all "noise" that triggers shared
  horde attacks
- Atomic combat against killable threats with multiple resolution options
- One-way drops, tool-gated passages, variable movement costs

The full ruleset is in `docs/rulebook.docx`. **Read it before changing
game logic.**

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Neon Postgres (prod), local Postgres (dev)
- **ORM**: Prisma with `@prisma/adapter-neon` for serverless
- **Sync model**: Polling (turns are slow; no websockets)
- **Language**: TypeScript, strict mode throughout
- **UI**: shadcn/ui + Tailwind CSS

## Architecture Principles

### 1. Database invariants > application invariants

Whenever a rule can be enforced at the database level via CHECK constraints,
foreign keys, or unique constraints, it is. Application bugs come and go;
the DB is forever. See `game_cards`, `game_artifacts`, and
`card_resolution_options` for examples — each has CHECK constraints that
make illegal states literally unrepresentable.

### 2. State columns over physical separation

A card in a player's deck, hand, discard, or in the market is all the same
thing — a card — in different states. They live in one table
(`game_cards`) with a `location` column. This makes moves into SQL UPDATEs
instead of cross-table moves and keeps queries simple.

### 3. Pure resolver, separate persistence

`lib/game/cardEffects.ts` is a pure function: `(effects, context) → StateDelta`.
It does not touch the database. The persistence layer is responsible for:

1. Loading state from the DB
2. Calling the resolver with that state
3. Validating the resulting delta
4. Applying it atomically in a transaction
5. Appending action log entries

### 4. Typed effects with an escape hatch

Card effects are a TypeScript discriminated union with ~19 primitive types.
The `scripted` escape hatch exists for future cards that don't fit
primitives, but currently no card uses it.

### 5. Data-driven cards, code-driven engine

Cards are rows in `card_definitions` + `card_effects`. The engine is code.
Adding a new card with standard effects = seed data change. Adding a new
effect type = code change to the resolver.

## Key Design Decisions

- **Hordes are killable threats** — sit in dynamic market after triggering
- **Combat is atomic** — single player, single turn, full cost or nothing
- **Resolution options exist** — different deck archetypes have viable paths
- **No activated abilities or on-discard effects** — only on-play and on-reveal
- **Broad effects over targeted PvP** — "every other player" not "choose one"
- **Retroactive modifier composition** — order of card play doesn't matter
- **Directed edges for tunnels** — one-way drops, tool-gated passages
- **Room monsters fought every entry** — permanent environmental hazards

## Files and Their Purpose

```
prisma/
  schema.prisma              Prisma schema (18 models, mirrors db/schema.sql)
  seed.ts                    Seed data script

db/
  schema.sql                 Reference SQL schema (do not apply directly)

lib/
  db.ts                      Prisma client singleton
  game/
    cardEffects.ts            Pure resolver: primitives, types, state delta
    cardEffects.test.ts       19 tests covering all primitives and edge cases
    setup.ts                  Game creation, joining, starting
    state.ts                  Load game state, build PlayContext
    persistence.ts            Apply StateDelta atomically
    deck.ts                   Card draw + reshuffle logic
    horde.ts                  Horde attack resolution
    movement.ts               Room traversal + room combat
    market.ts                 Buying cards/tools, market refill
    combat.ts                 Threat resolution
    turnFlow.ts               End-of-turn, escape
    achievements.ts           Achievement checking and awarding

app/api/games/                API routes (12 endpoints)

docs/
  rulebook.docx               Authoritative game rules
```

## Anti-Goals

- Don't add real-time websocket sync
- Don't store game logic in the database
- Don't add a third card lifecycle
- Don't flatten card_resolution_options into JSONB
- Don't merge starter, static, and dynamic card pools
