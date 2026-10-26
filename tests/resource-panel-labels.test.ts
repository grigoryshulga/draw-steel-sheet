import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { previewGameAction } from "../src/lib/game-actions";
import { resourceGainLabels } from "../src/lib/resources";
import { beginRound, currentRuntime, markTrigger } from "../src/lib/runtime";
import type { Character } from "../src/types";

/** Неистовый 1-го уровня. Прибавки ресурса от авторасчёта не зависят. */
function fury(level = 1): Character {
  return createCharacter({ className: "Неистовый", level });
}

describe("прибавки ресурса на листе", () => {
  it("прибавки показываются с триггером, количеством и частотой", () => {
    expect(resourceGainLabels(fury(1))).toEqual([
      {
        tag: "combat-start",
        label: "Начинается бой",
        amount: "= Победы",
        frequency: "схватка",
        used: false,
      },
      {
        tag: "start-of-turn",
        label: "Начало твоего хода",
        amount: "1d3",
        frequency: "ход",
        used: false,
      },
      {
        tag: "take-damage",
        label: "Получаешь урон",
        amount: "1",
        frequency: "раунд",
        used: false,
      },
      {
        tag: "winded-or-dying",
        label: "Становишься утомлённым",
        amount: "1d3",
        frequency: "схватка",
        used: false,
      },
    ]);
  });

  it("отметка «получено» живёт до конца раунда", () => {
    const marked = markTrigger(fury(1), "start-of-turn", true, "turn");
    expect(
      resourceGainLabels(marked).map((gain) => [gain.tag, gain.used]),
    ).toEqual([
      ["combat-start", false],
      ["start-of-turn", true],
      ["take-damage", false],
      ["winded-or-dying", false],
    ]);
    expect(
      resourceGainLabels(beginRound(marked)).every((gain) => !gain.used),
    ).toBe(true);
  });

  it("отметка прибавки схватки переживает новый раунд", () => {
    const marked = markTrigger(fury(1), "winded-or-dying", true, "encounter");
    expect(
      resourceGainLabels(beginRound(marked)).find(
        (gain) => gain.tag === "winded-or-dying",
      )?.used,
    ).toBe(true);
  });

  it("действие отметки берёт частоту прибавки, а не фичи", () => {
    const preview = previewGameAction(fury(1), {
      kind: "trigger",
      featureId: "winded-or-dying",
      used: true,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.label).toBe("Отмечено: Становишься утомлённым");
    expect(currentRuntime(preview.next).triggers["winded-or-dying"]).toEqual({
      encounter: 1,
      count: 1,
    });
  });

  it("эпический пул не смешивается с прибавками основного ресурса", () => {
    expect(
      resourceGainLabels(fury(10)).some((gain) => gain.tag === "epic-respite"),
    ).toBe(false);
  });
});
