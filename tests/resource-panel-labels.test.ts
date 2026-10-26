import { describe, expect, it } from "vitest";
import {
  heroicResourceHelp,
  resourceSpecHelp,
} from "../src/data/resource-help";
import {
  epicResourceGainLabels,
  epicResourceName,
} from "../src/lib/resources";
import { createCharacter } from "../src/lib/defaults";
import { previewGameAction } from "../src/lib/game-actions";
import { resourceGainLabels } from "../src/lib/resources";
import { beginRound, currentRuntime, markTrigger } from "../src/lib/runtime";
import type { Character } from "../src/types";

/** Неистовый нужного уровня; прибавки ресурса от авторасчёта не зависят. */
function fury(level = 1): Character {
  return createCharacter({ className: "Неистовый", level });
}

/** Неистовый нужного уровня с выбранным аспектом. */
function furyWithAspect(aspect: string, level = 1): Character {
  const hero = fury(level);
  hero.subclass = aspect;
  return hero;
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

describe("памятка к ресурсу", () => {
  it("пороги берутся из активных особенностей, а не из спецификации пула", () => {
    expect(resourceSpecHelp(furyWithAspect("Берсерк", 10))).toContain(
      "Пороги свирепости: 2, 4, 6, 8, 10, 12",
    );
  });

  it("на 1-м уровне герой видит только полученные пороги", () => {
    expect(resourceSpecHelp(furyWithAspect("Берсерк", 1))).toContain(
      "Пороги свирепости: 2, 4, 6",
    );
  });

  it("без пороговых фич строки о порогах нет", () => {
    const withoutFeatures = resourceSpecHelp(fury(1));
    expect(withoutFeatures.some((line) => line.startsWith("Пороги"))).toBe(
      false,
    );
    expect(resourceSpecHelp(createCharacter({ className: "Нуль" }))).toEqual(
      [],
    );
  });

  it("памятка не повторяет блок «Откуда капает»", () => {
    const help = heroicResourceHelp(furyWithAspect("Берсерк", 1));
    expect(help).toContain("Остаток пропадает в конце боя.");
    expect(
      help.some((line) => line.includes("В начале каждого вашего хода")),
    ).toBe(false);
    expect(help).toContain("Пороги свирепости: 2, 4, 6");
  });

  it("у класса без разобранных прибавок памятка остаётся прежней", () => {
    expect(heroicResourceHelp(createCharacter({ className: "Нуль" }))).toContain(
      "В начале каждого вашего хода: +2 дисциплины.",
    );
  });
});

describe("эпический пул", () => {
  it("открывается на 10-м уровне своим числом и прибавками", () => {
    expect(epicResourceName(fury(9))).toBeUndefined();
    expect(epicResourceGainLabels(fury(9))).toEqual([]);

    const hero = fury(10);
    expect(epicResourceName(hero)).toBe("Первозданная сила");
    expect(epicResourceGainLabels(hero)).toEqual([
      {
        tag: "epic-respite",
        label: "Завершаешь отдых",
        amount: "= Опыт",
        frequency: "отдых",
        used: false,
      },
    ]);
  });

  it("число эпического пула меняется действием журнала", () => {
    const hero = fury(10);
    const preview = previewGameAction(hero, {
      kind: "resource",
      resource: "epic",
      value: 3,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.next.epic).toBe(3);
    expect(preview.label).toBe("Первозданная сила");
  });
});
