import type { Ability } from "../types";

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type AbilityTemplate = Omit<Ability, "id" | "preferredCharacteristic">;

/** Базовые действия и свободные удары из глав 13.09–13.11. */
export const BASIC_ABILITIES: AbilityTemplate[] = [
  {
    name: "Свободный удар ближнего боя",
    flavor: "Удар безоружной рукой, импровизированным оружием или клинком, который всегда под рукой.",
    actionType: "main",
    kind: "free-strike",
    keywords: ["Рывок", "Ближний", "Удар", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо или объект",
    rollCharacteristics: ["might", "agility"],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "2 + M или A", effect: "" },
      { damage: "5 + M или A", effect: "" },
      { damage: "7 + M или A", effect: "" },
    ],
    effect: "",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Свободный удар дальнего боя",
    flavor: "Быстрый выстрел или бросок импровизированным оружием.",
    actionType: "main",
    kind: "free-strike",
    keywords: ["Дальний", "Удар", "Оружие"],
    distance: "Дальний 5",
    target: "Одно существо или объект",
    rollCharacteristics: ["might", "agility"],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "2 + M или A", effect: "" },
      { damage: "4 + M или A", effect: "" },
      { damage: "6 + M или A", effect: "" },
    ],
    effect: "",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Рывок",
    flavor: "Вы бросаетесь вперёд и обрушиваете на врага свободный удар.",
    actionType: "main",
    kind: "other",
    keywords: ["Рывок"],
    distance: "Ваша скорость",
    target: "На себя",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Переместитесь по прямой линии вплоть до вашей скорости, затем совершите свободный удар ближнего боя. Нельзя двигаться через труднопроходимую местность.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Защита",
    flavor: "Вы сосредотачиваетесь на обороне.",
    actionType: "main",
    kind: "other",
    keywords: [],
    distance: "На себя",
    target: "На себя",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Броски способностей против вас получают двойную помеху до начала вашего следующего хода. Вы также получаете двойное преимущество в тестах для сопротивления эффектам окружающей среды.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Лечение",
    flavor: "Вы помогаете союзнику перевести дух или сбросить эффект.",
    actionType: "main",
    kind: "other",
    keywords: [],
    distance: "Ближний 1",
    target: "Одно смежное существо",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Цель может потратить Восстановление, чтобы восстановить выносливость, или совершить спасбросок против одного эффекта, который заканчивается спасброском.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Передышка",
    flavor: "Вы переводите дыхание и возвращаетесь в бой.",
    actionType: "maneuver",
    kind: "other",
    keywords: [],
    distance: "На себя",
    target: "На себя",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Потратьте Восстановление и восстановите выносливость, равную вашему значению восстановления. Нельзя использовать при смерти.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Помощь в атаке",
    flavor: "Вы отвлекаете врага, открывая союзнику удобный момент.",
    actionType: "maneuver",
    kind: "other",
    keywords: [],
    distance: "Ближний 1",
    target: "Один смежный враг",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Следующий бросок способности союзника против этой цели до начала вашего следующего хода получает преимущество.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Захват",
    flavor: "Вы хватаете врага и не даёте ему уйти.",
    actionType: "maneuver",
    kind: "other",
    keywords: ["Ближний", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: ["might"],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "Без эффекта." },
      {
        damage: "",
        effect: "Вы можете схватить цель, но она может совершить свободный удар ближнего боя по вам до этого.",
      },
      { damage: "", effect: "Цель схвачена вами." },
    ],
    effect:
      "Обычно вы можете нацеливаться на существ вашего размера или меньше. При Мощи 2+ — на любое существо размером не больше вашей Мощи.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Отталкивание",
    flavor: "Вы толкаете врага прочь.",
    actionType: "maneuver",
    kind: "other",
    keywords: ["Ближний", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: ["might"],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "Толчок 1." },
      { damage: "", effect: "Толчок 2." },
      { damage: "", effect: "Толчок 3." },
    ],
    effect:
      "Цель отталкивается по прямой от вас. Толчок не провоцирует атаку по возможности.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Ускользание",
    flavor: "Вы вырываетесь из захвата.",
    actionType: "maneuver",
    kind: "other",
    keywords: [],
    distance: "На себя",
    target: "На себя",
    rollCharacteristics: ["might", "agility"],
    rollBonus: 0,
    resourceCost: 0,
    trigger: "",
    tiers: [
      { damage: "", effect: "Без эффекта." },
      {
        damage: "",
        effect: "Вы избегаете захвата, но схвативший может совершить свободный удар ближнего боя по вам.",
      },
      { damage: "", effect: "Вы больше не схвачены." },
    ],
    effect:
      "Помеха, если ваш размер меньше размера схватившего существа, объекта или эффекта.",
    source: "Базовые способности",
    notes: "",
  },
  {
    name: "Атака по возможности",
    flavor: "Враг опрометчиво покидает вашу зону досягаемости.",
    actionType: "free-trigger",
    kind: "other",
    keywords: ["Ближний", "Удар", "Оружие"],
    distance: "Ближний 1",
    target: "Одно существо",
    rollCharacteristics: [],
    rollBonus: 0,
    resourceCost: 0,
    trigger:
      "Смежный враг добровольно перемещается в пространство, не смежное с вами, не используя смещение.",
    tiers: [
      { damage: "", effect: "" },
      { damage: "", effect: "" },
      { damage: "", effect: "" },
    ],
    effect:
      "Совершите свободный удар ближнего боя по врагу. Нельзя, если у вас есть помеха или двойная помеха на этот бросок.",
    source: "Базовые способности",
    notes: "",
  },
];

export function abilityFromTemplate(template: AbilityTemplate): Ability {
  return {
    ...template,
    id: makeId(),
    preferredCharacteristic: template.rollCharacteristics[0] ?? "",
  };
}

export const DEFAULT_ABILITIES: Ability[] = [
  abilityFromTemplate(BASIC_ABILITIES[0]),
  abilityFromTemplate(BASIC_ABILITIES[1]),
];
