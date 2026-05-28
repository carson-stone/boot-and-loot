import type { PrismaClient } from "@/lib/generated/prisma/client";

export type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function drawCards(
  tx: TxClient,
  playerId: string,
  count: number,
  gameId: string,
): Promise<string[]> {
  const drawn: string[] = [];
  let remaining = count;

  while (remaining > 0) {
    const deckCards = await tx.gameCard.findMany({
      where: { gameId, playerId, location: "player_deck" },
      orderBy: { deckPosition: "asc" },
      take: remaining,
    });

    for (const card of deckCards) {
      await tx.gameCard.update({
        where: { id: card.id },
        data: { location: "player_hand", deckPosition: null },
      });
      drawn.push(card.id);
    }

    remaining -= deckCards.length;

    if (remaining > 0) {
      const discardCount = await tx.gameCard.count({
        where: { gameId, playerId, location: "player_discard" },
      });

      if (discardCount === 0) break;

      await reshuffleDiscard(tx, playerId, gameId);
    }
  }

  return drawn;
}

async function reshuffleDiscard(tx: TxClient, playerId: string, gameId: string) {
  const discardCards = await tx.gameCard.findMany({
    where: { gameId, playerId, location: "player_discard" },
  });

  const positions = Array.from({ length: discardCards.length }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j]!, positions[i]!];
  }

  for (let i = 0; i < discardCards.length; i++) {
    await tx.gameCard.update({
      where: { id: discardCards[i]!.id },
      data: { location: "player_deck", deckPosition: positions[i] },
    });
  }
}
