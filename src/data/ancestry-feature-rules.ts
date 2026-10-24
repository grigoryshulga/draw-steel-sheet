import type { FeatureEffect } from "./feature-effects";

export interface AncestryFeatureRule {
  id: string;
  name: string;
  ancestryName: string;
  description: string;
  effects: FeatureEffect[];
}

export const ANCESTRY_FEATURE_RULES: AncestryFeatureRule[] = [
  {
    id: "ancestry.devil.beast-legs",
    name: "Звериные ноги",
    ancestryName: "Дьявол",
    description: "ваши мощные ноги делают вас заметно быстрее. Ваша скорость равна 6.",
    effects: [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }],
  },
  {
    id: "ancestry.dwarf.grounded",
    name: "Заземленность",
    ancestryName: "Дварф",
    description: "ваше тяжелое каменное тело и связь с землей затрудняют другим ваше перемещение. У вас есть +1 бонус к устойчивости.",
    effects: [{ kind: "stat", stat: "stability", value: 1 }],
  },
  {
    id: "ancestry.dwarf.spark-from-your-skin",
    name: "Искра с твоей кожи",
    ancestryName: "Дварф",
    description: "ваша каменная кожа обеспечивает вам мощной защитой. У вас есть +6 бонус к Выносливости, и этот бонус увеличивается на 6 на 4-м, 7-м и 10-м уровнях.",
    effects: [{ kind: "stat", stat: "stamina", value: 0, perEchelon: 6 }],
  },
  {
    id: "ancestry.forest-elf.swift",
    name: "Стремительный",
    ancestryName: "Лесной Эльф",
    description: "ваша скорость равна 6.",
    effects: [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }],
  },
  {
    id: "ancestry.high-elf.graceful-retreat",
    name: "Грациозное отступление",
    ancestryName: "Высший Эльф",
    description: "вы получаете бонус +1 к расстоянию, на которое можете переместиться, когда совершаете Действие отхода.",
    effects: [{ kind: "stat", stat: "disengage", value: 1 }],
  },
  {
    id: "ancestry.human.reserve-of-strength",
    name: "Запас прочности",
    ancestryName: "Человек",
    description: "ваша человеческая физиология позволяет вам сражаться, бегать и бодрствовать дольше других. Вы увеличиваете количество своих Восстановлений на 2.",
    effects: [{ kind: "stat", stat: "recoveries", value: 2 }],
  },
  {
    id: "ancestry.memanek.lightning-agility",
    name: "Молниеносная ловкость",
    ancestryName: "Меманек",
    description: "Вы можете устремлять свое тело до невероятной скорости. Ваша скорость равна 7.",
    effects: [{ kind: "stat", stat: "speed", value: 2, stackingGroup: "ancestry.base-speed" }],
  },
  {
    id: "ancestry.orc.grounded",
    name: "Заземленность",
    ancestryName: "Орк",
    description: "магия в вашей крови не позволяет вас так просто передвинуть. У вас есть +1 бонус к устойчивости.",
    effects: [{ kind: "stat", stat: "stability", value: 1 }],
  },
  {
    id: "ancestry.polder.graceful-retreat",
    name: "Грациозное отступление",
    ancestryName: "Полдер",
    description: "ваш скромный размер помогает вам избегать столкновения. Вы получаете +1 бонус к дистанции смещения когда используете Действия отхода.",
    effects: [{ kind: "stat", stat: "disengage", value: 1 }],
  },
  {
    id: "ancestry.taurus.beast-legs",
    name: "Звериные ноги",
    ancestryName: "Таурус",
    description: "ваши мощные ноги делают вас заметно быстрее. Ваша скорость равна 6.",
    effects: [{ kind: "stat", stat: "speed", value: 1, stackingGroup: "ancestry.base-speed" }],
  },
  {
    id: "ancestry.taurus.grounded",
    name: "Заземленность",
    ancestryName: "Таурус",
    description: "вы сдвинетесь тогда, когда посчитаете нужным. У вас есть +1 бонус к устойчивости.",
    effects: [{ kind: "stat", stat: "stability", value: 1 }],
  },
];

export function ancestryTraitIdsFromNames(
  ancestry: string,
  names: readonly string[],
): string[] {
  const selectedNames = new Set(names);
  const seenIds = new Set<string>();
  const ids: string[] = [];

  for (const rule of ANCESTRY_FEATURE_RULES) {
    if (rule.ancestryName !== ancestry || !selectedNames.has(rule.name) || seenIds.has(rule.id)) continue;
    seenIds.add(rule.id);
    ids.push(rule.id);
  }

  return ids;
}
