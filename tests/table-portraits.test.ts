import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { projectHero } from "../server/tables-store.mjs";
import { createCharacter } from "../src/lib/defaults";
import type { SharedHero, TableSnapshot } from "../src/lib/tables/types";
import { BoardMemberCards } from "../src/views/tables/BoardMemberCards";

function renderSeat(tableId: string, avatarUrl?: string) {
  const character = createCharacter({ name: "Эйрин", ancestry: "Лесной Эльф" });
  if (avatarUrl) character.avatar = { url: avatarUrl, updatedAt: character.updatedAt };
  const hero = projectHero(character, { sections: [], notes: [] }) as SharedHero;
  const table: TableSnapshot = {
    id: tableId, name: "Стол", ownerId: "director", actorId: "director",
    archived: false, revision: 1, memberCount: 1, updatedAt: character.updatedAt,
    members: [{ userId: "player", name: "Игрок", role: "player", hero }],
    myHeroIds: [], visibility: {}, scenes: [], materials: [], events: [], offers: [], trades: [],
  };
  return renderToStaticMarkup(createElement(BoardMemberCards, {
    table, command: async () => null, busy: false,
  }));
}

describe("portraits at the table", () => {
  it("shows the attached hero's uploaded portrait on the collapsed seat", () => {
    const url = "/api/characters/hero/avatar?v=1";
    expect(renderSeat("table", url)).toContain(`src="${url}"`);
  });

  it("keeps the ancestry illustration as a fallback for the demo table", () => {
    expect(renderSeat("demo-old-road")).toContain('src="/art/previews/ancestries/wode-elf.png"');
    expect(renderSeat("table")).not.toContain("<img");
  });
});
