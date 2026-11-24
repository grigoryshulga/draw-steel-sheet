import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TableSnapshot } from "../src/lib/tables/types";
vi.mock("../src/i18n/locale", () => ({ useLocale: () => ({ locale: "en", t: (_ru: string, en: string) => en }) }));
import { TableJournal } from "../src/views/tables/TableJournal";

describe("table locale", () => {
  it("translates journal controls while preserving authored names and notes", () => {
    const table = { actorId: "a", ownerId: "a", archived: false, members: [{ userId: "a", name: "Имя игрока" }], events: [{ id: "1", actor: "a", text: "Заметка героя", public: true, kind: "message", at: "2026-01-01T00:00:00Z" }] } as unknown as TableSnapshot;
    const before = structuredClone(table);
    const html = renderToStaticMarkup(createElement(TableJournal, { table, busy: false, command: vi.fn(), commandError: "" }));
    expect(html).toContain("Table journal");
    expect(html).toContain("Visible to players");
    expect(html).toContain("Имя игрока");
    expect(html).toContain("Заметка героя");
    expect(table).toEqual(before);
  });
});

import { createScene } from "../src/lib/tables/scenes";
import { SceneTracker } from "../src/views/tables/SceneTracker";
import { SceneChallengeSettings } from "../src/views/tables/SceneChallengeSettings";

it("localizes player combat status without exposing private scene data", () => {
  const scene = createScene("encounter", "Имя сцены");
  scene.directorNotes = "секрет";
  scene.combatants = [{ id: "one", name: "Имя существа", group: "", organization: "", faction: "enemy", revealed: true, turn: "ready", reactionUsed: false, conditions: [], health: "hurt", stamina: 31, maxStamina: 45 }];
  const before = structuredClone(scene);
  const html = renderToStaticMarkup(createElement(SceneTracker, { scene, director: false, onChange: vi.fn() }));
  expect(html).toContain("Hurt");
  expect(html).toContain("Имя существа");
  expect(html).not.toContain("секрет");
  expect(html).not.toContain("31");
  expect(scene).toEqual(before);
});

it("localizes the director's montage settings without changing the scene", () => {
  const scene = createScene("montage", "Авторская сцена");
  const before = structuredClone(scene);
  const html = renderToStaticMarkup(createElement(SceneChallengeSettings, { scene, heroes: 4, onChange: vi.fn() }));
  expect(html).toContain("Montage test");
  expect(html).toContain("Success limit");
  expect(html).toContain("Failure limit");
  expect(scene).toEqual(before);
});

import { creatureCategory, creatureDisplayName, tableItemError } from "../src/views/tables/table-display";
import { codexIndex } from "../src/rules/codex-navigation";
it("uses verified creature originals only while the saved name remains canonical", () => {
  const entry = codexIndex.find(item => item.director?.originalName && item.title !== item.director.originalName)!;
  expect(creatureDisplayName(entry.id, entry.title, "en")).toBe(entry.director?.originalName);
  expect(creatureDisplayName(entry.id, "Авторское имя", "en")).toBe("Авторское имя");
  expect(creatureDisplayName(entry.id, entry.title, "ru")).toBe(entry.title);
  expect(creatureDisplayName(undefined, entry.title, "en")).toBe(entry.title);
  expect(creatureCategory("Орда", "en")).toBe("Horde");
  expect(creatureCategory("Миньон", "en")).toBe("Minion");
  expect(creatureCategory("Авторский тип", "en")).toBe("Авторский тип");
});

it("localizes the local-mode trade error and preserves unknown diagnostics", () => {
  const message = "Для передачи предметов между игроками нужен стол в Supabase";
  expect(tableItemError(message, "en")).toBe("A Supabase table is required to transfer items between players.");
  expect(tableItemError(message, "ru")).toBe(message);
  expect(tableItemError("Другая ошибка", "en")).toBe("Другая ошибка");
});
