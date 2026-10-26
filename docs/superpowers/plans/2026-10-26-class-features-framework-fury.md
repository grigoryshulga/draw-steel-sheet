# Модель классовых особенностей: каркас + Неистовый — план реализации

> **Для агентов:** ОБЯЗАТЕЛЬНЫЙ СУБ-СКИЛЛ: используйте superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans, чтобы выполнять план задача за задачей. Шаги отмечены чекбоксами (`- [ ]`).

**Цель:** заменить «прозаические» классовые особенности типизированной моделью, которая участвует в расчётах листа, и напоминает о триггерах; первым классом полностью покрыть Неистового.

**Архитектура:** скелет фич генерируется из текста книги (`class-features.generated.json`), механика пишется руками в `src/data/class-features/mechanics/<class>.ts` и связывается по `id`. Движок `feature-modifiers` расширяется до полей, фильтров и условий; триггеры и прибавки ресурса получают состояние в `character.runtime`. Тест покрытия требует, чтобы каждая фича скелета была либо смоделирована, либо явно помечена прозой.

**Стек:** TypeScript 7, React 19, Vite, Vitest 5, JSON-данные из `scripts/build-*.mjs`.

**Спека:** `docs/superpowers/specs/2026-10-26-class-features-design.md` (читать вместе с планом). Инвентаризация: `docs/superpowers/specs/class-inventory/group{1,2,3}.json`.

## Глобальные ограничения

- `tsc` идёт со `strict`, `noUnusedLocals`, `noUnusedParameters`. Сборка: `npm run build`, тесты: `npm test` (`vitest run`), одиночный файл: `npx vitest run tests/<file>.test.ts`.
- Комментарии в коде и весь UI-текст — по-русски. Сообщения коммитов — по-английски.
- Идентификаторы фич — внешний контракт сохранённых листов (`automation.classFeatureSelections`, Supabase). `schemaVersion` остаётся `1`; старые id не ломаются.
- Числа бонусов берутся только из книги/инвентаризации. Ничего не выдумывать: спорное — комментарий в данных или `TEXT_ONLY` с причиной.
- Новые поля персонажа — опциональные: старый лист без них обязан работать.
- Эффекты тиров способностей (`push 2`, `prone`) в структуру не разбираются.
- Всё новое в UI видно всегда; в расчёт числа идут только при `automation.enabled`.

## Фокус ревью

Пять мест, где спека молчит, а человек упрётся первым:

1. **Бонус, зависящий от характеристики** («скорость + Ловкость», «устойчивость = Мощь») — лист должен показать конкретное число, а не строку «Ловкость».
2. **Бонус, зависящий от уровня** («эффективный размер + уровень») — при изменении уровня число меняется без повторного выбора.
3. **Растущая свирепость: порог ресурса** («толчок +Мощь, если свирепость ≥ 2») — бонус включается и выключается от текущего значения ресурса, а не от уровня.
4. **Одноимённые фичи на разных уровнях** — бонусы не должны складываться дважды и не должны пропадать.
5. **Выключенный авторасчёт** — лист показывает фичи и напоминания, но не меняет сохранённые числа.

Тесты на каждый пункт добавлены в задачи 1, 2, 5, 8 и 12.

---

### Задача 1: Типизированные эффекты и движок полей

**Файлы:**
- Создать: `src/data/class-features/types.ts`
- Изменить: `src/data/feature-effects.ts` (оставить ре-экспортом нового типа), `src/data/ancestry-feature-rules.ts` (15 записей), `src/data/class-feature-rules.ts` (30 вариантов), `src/lib/feature-modifiers.ts`
- Тест: `tests/feature-effects-model.test.ts`

**Интерфейсы:**
- Потребляет: `Character`, `Ability`, `echelon()` из `src/lib/progression`.
- Производит (всё в `src/data/class-features/types.ts` и `src/lib/feature-modifiers.ts`): `FeatureField`, `FeatureAmount`, `FeatureFilter`, `FeatureCondition`, `FeatureEffect`, `FeatureKind`, `TriggerEvent`, `TriggerFrequency`, `FeatureTrigger`, `FeatureChoice`, `HeroicResourceSpec`, `ResourceGain`, `FeatureMechanics`; функции `resolveFeatureAmount()`, `fieldEffectContributions(effects, character, field, ability?)`, `featureFieldContributions()`, `featureFieldBonus()`. Старые `featureStatBonus`/`featureAbilityDamageBonus`/`featureAbilityDistanceBonus` остаются рабочими обёртками.

- [ ] **Шаг 1: Написать падающий тест**

```ts
// tests/feature-effects-model.test.ts
import { describe, expect, it } from "vitest";
import { createCharacter } from "../src/lib/defaults";
import { fieldEffectContributions, resolveFeatureAmount } from "../src/lib/feature-modifiers";
import type { FeatureEffect } from "../src/data/class-features/types";
import type { Ability } from "../src/types";

const ability = (keywords: string[]): Ability => ({
  id: "a", name: "a", flavor: "", actionType: "main", kind: "heroic",
  keywords, distance: "Ближний 1", target: "", rollCharacteristics: ["might"],
  preferredCharacteristic: "might", rollBonus: 0, resourceCost: 1, trigger: "",
  tiers: [{ damage: "3", effect: "" }, { damage: "5", effect: "" }, { damage: "7", effect: "" }],
  effect: "", source: "", notes: "",
});

it("бонус к толчку применяется только к способностям с нужным ключевым словом", () => {
  const hero = createCharacter({ className: "Неистовый" });
  const effects: FeatureEffect[] = [{ kind: "field", field: "push", value: 1, filter: { keywords: ["Оружие"] } }];
  expect(fieldEffectContributions(effects, hero, "push", ability(["Оружие"]))).toHaveLength(1);
  expect(fieldEffectContributions(effects, hero, "push", ability(["Магия"]))).toHaveLength(0);
});

it("значение-характеристика и значение-уровень считаются в числа и следят за уровнем", () => {
  const hero = { ...createCharacter({ className: "Неистовый" }), level: 3 };
  hero.characteristics.might = 2;
  expect(resolveFeatureAmount(hero, { characteristic: "might" })).toBe(2);
  expect(resolveFeatureAmount(hero, { level: true })).toBe(3);
  expect(resolveFeatureAmount({ ...hero, level: 4 }, { level: true })).toBe(4);
  expect(resolveFeatureAmount(hero, 4)).toBe(4);
});

it("эффекты в одной группе не складываются: побеждает максимальный", () => {
  const hero = createCharacter({ className: "Неистовый" });
  const effects: FeatureEffect[] = [
    { kind: "field", field: "speed", value: 1, stackingGroup: "base-speed" },
    { kind: "field", field: "speed", value: 2, stackingGroup: "base-speed" },
  ];
  expect(fieldEffectContributions(effects, hero, "speed")).toHaveLength(1);
  expect(fieldEffectContributions(effects, hero, "speed")[0].value).toBe(2);
});

it("условие по ресурсу и по снаряжению решает, действует ли эффект", () => {
  const hero = createCharacter({ className: "Неистовый" });
  hero.heroicResource.current = 1;
  const effects: FeatureEffect[] = [{ kind: "field", field: "push", value: 2, when: { resourceAtLeast: { name: "Свирепость", value: 2 } } }];
  expect(fieldEffectContributions(effects, hero, "push")).toHaveLength(0);
  hero.heroicResource.current = 2;
  expect(fieldEffectContributions(effects, hero, "push")).toHaveLength(1);
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `npx vitest run tests/feature-effects-model.test.ts`
Ожидается: FAIL — нет `featureFieldBonus`, `resolveFeatureAmount`, `src/data/class-features/types.ts`.

- [ ] **Шаг 3: Описать типы в `src/data/class-features/types.ts`**

```ts
export type FeatureField = "stamina" | "recoveries" | "recoveryValue" | "speed"
  | "stability" | "save" | "disengage" | "rolledDamage" | "freeStrikeDamage"
  | "distance" | "push" | "pull" | "slide" | "potency";

export type FeatureAmount = number
  | { characteristic: CharacteristicKey }
  | { level: true };

export interface FeatureFilter {
  keywords?: string[];
  characteristic?: CharacteristicKey;
  mode?: "melee" | "ranged";
  actionType?: ActionType[];
}

export interface FeatureCondition {
  equipment?: { lightArmor?: boolean; lightWeapon?: boolean };
  noKit?: boolean;
  minLevel?: number;
  keyValue?: string[];
  resourceAtLeast?: { name: string; value: number };
  formActive?: string;
}

export type FeatureEffect =
  | { kind: "field"; field: FeatureField; value: FeatureAmount; perEchelon?: number;
      cap?: number; filter?: FeatureFilter; when?: FeatureCondition; stackingGroup?: string }
  | { kind: "characteristic"; key: CharacteristicKey; value: number }
  | { kind: "damageImmunity"; types: string[]; value: FeatureAmount; when?: FeatureCondition }
  | { kind: "conditionImmunity"; conditions: string[] }
  | { kind: "proficiency"; armor?: string[]; weapons?: string[]; treasures?: boolean };

export type TriggerEvent = "start-of-turn" | "end-of-turn" | "take-damage" | "deal-damage"
  | "hit" | "crit" | "miss" | "ally-damaged" | "adjacent-enemy-damages-you"
  | "first-per-round" | "winded" | "dying" | "spend-recovery" | "enemy-enters"
  | "save-failed" | "save-succeeded" | "respite" | "victory" | "use-ability"
  | "form-changed" | "passive";

export type TriggerFrequency = "turn" | "round" | "encounter" | "respite" | "always";

export interface FeatureTrigger {
  event: TriggerEvent;
  frequency: TriggerFrequency;
  label: string;
  detail: string;
  effect?: FeatureEffect[];
}

export interface FeatureChoice {
  group: string;
  options: { id: string; label: string }[];
}

export interface ResourceGain {
  tag: string;
  event: TriggerEvent;
  amount: string;
  frequency: TriggerFrequency;
  replaces?: string[];
}

export interface HeroicResourceSpec {
  name: string;
  canBeNegative?: boolean;
  gains: ResourceGain[];
  thresholds?: { level: number; note: string }[];
  epic?: { name: string; gains: ResourceGain[] };
}

export type FeatureKind = "bonus" | "characteristic" | "proficiency" | "immunity"
  | "resource" | "resourceGain" | "trigger" | "choice" | "grant" | "situational" | "text";

export interface FeatureMechanics {
  kinds: FeatureKind[];
  effects?: FeatureEffect[];
  trigger?: FeatureTrigger;
  choice?: FeatureChoice;
  resource?: HeroicResourceSpec;
  notes?: string;
}
```

- [ ] **Шаг 4: Перенести движок и данные**

`feature-modifiers.ts`: `activeFeatureSources` возвращает эффекты нового типа; добавить чистые `resolveFeatureAmount(character, amount)` (характеристика → её значение, `{level:true}` → `character.level`) и `fieldEffectContributions(effects, character, field, ability?)` (фильтры, условия, `perEchelon`, `stackingGroup`), а поверх них — `featureFieldContributions`/`featureFieldBonus`, которые собирают эффекты из источников. `featureStatBonus(character, stat)` — обёртка над `featureFieldBonus` для `stamina|recoveries|speed|stability|disengage|save`. `featureAbilityDamageContributions` — обёртка над `featureFieldBonus(..., "rolledDamage", ability)`. Ни `perEchelon` на значениях-характеристиках, ни `stackingGroup` не теряются.

Данные: в `ancestry-feature-rules.ts` и `class-feature-rules.ts` переписать эффекты `{kind:"stat", stat, value, perEchelon, when:{equipment:"lightArmor", noKit:true}}` в `{kind:"field", field, value, perEchelon, when:{equipment:{lightArmor:true}, noKit:true}}`; `{kind:"damage", value, keywords}` → `{kind:"field", field:"rolledDamage", value, filter:{keywords}}`; `{kind:"distance", value, keywords}` → `{kind:"field", field:"distance", value, filter:{keywords}}`.

- [ ] **Шаг 5: Прогнать тесты**

Запустить: `npx vitest run` — новые тесты зелёные, старые (`class-feature-*`, `ancestry-*`, `equipment-feature-calculations`, `feature-modifiers`) не сломаны.

- [ ] **Шаг 6: Коммит**

```bash
git add src/data/class-features/types.ts src/data/feature-effects.ts src/data/ancestry-feature-rules.ts src/data/class-feature-rules.ts src/lib/feature-modifiers.ts tests/feature-effects-model.test.ts
git commit -m "Add typed class feature effects and field-based modifier engine"
```

---

### Задача 2: Эффективные характеристики

**Файлы:**
- Изменить: `src/lib/feature-modifiers.ts`, `src/lib/rules.ts` (`deriveStats`, `characteristicValue`), `src/lib/character-calculations.ts` (реэкспорт)
- Тест: `tests/effective-characteristics.test.ts`

**Интерфейсы:**
- Потребляет: `FeatureEffect`, `resolveFeatureAmount` и `fieldEffectContributions` из задачи 1.
- Производит: `featureCharacteristicBonus(character, key): number`, `applyCharacteristicEffects(base, effects): Record<CharacteristicKey, number>`, `effectiveCharacteristics(character): Record<CharacteristicKey, number>`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("бонус характеристики считается поверх сохранённого значения и поднимает пороги", () => {
  const base = { might: 3, agility: 1, reason: 0, intuition: 0, presence: -1 };
  const effects: FeatureEffect[] = [{ kind: "characteristic", key: "might", value: 1 }];
  expect(applyCharacteristicEffects(base, effects).might).toBe(4);
  expect(applyCharacteristicEffects(base, effects).agility).toBe(1);
  expect(applyCharacteristicEffects(base, [])).toEqual(base);
});

it("пороги тиров и потенциал считаются от эффективных характеристик, сохранённые не меняются", () => {
  const hero = createCharacter({ className: "Неистовый" });
  hero.characteristics.might = 3;
  hero.automation!.characteristicEffectsForTest = [{ kind: "characteristic", key: "might", value: 1 }];
  expect(hero.characteristics.might).toBe(3);
  expect(effectiveCharacteristics(hero).might).toBe(4);
  expect(deriveStats(hero).tierThresholds.might.t3).toBe(13); // 17 − 4
  expect(deriveStats(hero).potency.strong).toBe(4);
});
```

Тест второго блока опирается на временный ключ `characteristicEffectsForTest` в `automation` — он заводится только для проверки связки `deriveStats` → `effectiveCharacteristics` до появления реестра механик (задача 5). Задача 5 удаляет этот ключ и переводит тест на реальные данные реестра.

- [ ] **Шаг 2: Убедиться, что падает** — `npx vitest run tests/effective-characteristics.test.ts`, FAIL: нет `effectiveCharacteristics`.

- [ ] **Шаг 3: Реализовать**

`feature-modifiers.ts`: `applyCharacteristicEffects` складывает `{kind:"characteristic"}` с базой; `effectiveCharacteristics(character)` берёт сохранённые характеристики, добавляет эффекты источников (при `automation.enabled`) и эффекты `automation.characteristicEffectsForTest`, если ключ есть. `rules.ts`: `characteristicValue()` и `deriveStats()` читают `effectiveCharacteristics(character)`. `character-calculations.ts` реэкспортирует `effectiveCharacteristics`, чтобы UI не тянул движок напрямую.

- [ ] **Шаг 4: Тесты** — `npx vitest run`. Ожидается PASS, включая `rules.test.ts` и `class-feature-calculations.test.ts`.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/feature-modifiers.ts src/lib/rules.ts src/lib/character-calculations.ts tests/effective-characteristics.test.ts
git commit -m "Derive effective characteristics from class feature bonuses"
```

---

### Задача 3: Генератор скелета фич

**Файлы:**
- Создать: `scripts/build-class-features.mjs`, `src/data/class-features.generated.json` (результат)
- Изменить: `package.json` (`data` получает `node scripts/build-class-features.mjs`)
- Тест: `tests/class-features-skeleton.test.ts`

**Интерфейсы:**
- Потребляет: `src/data/builder.generated.json` (`classes[].features`, markdown), `src/data/level-up.generated.json` (`className`, `level`, `features[].{id,name,description}`).
- Производит: `GeneratedClassFeature { id, className, level, name, parentId?, keyedBy?, keyValue?, articleId, featureId?, description }`.

Правила разбора (зафиксировать в шапке скрипта комментарием):
- Класс уровня 1 берётся из `builder.classes[]`; фича = заголовок `#### `. Внутри её текста `##### ` и `#### ` создают вложенные фичи (`parentId`).
- Уровни 2–10 — по записям `level-up.features[]`: сама запись — родитель, заголовки `##### ` внутри `description` — вложенные фичи.
- Строка markdown-таблицы `| Берсерк | Непреодолимая сила |` даёт вложенной фиче `keyValue: "Берсерк"` и `keyedBy: "aspect"`; ключевое слово `keyedBy` определяется по заголовку таблицы (аспект/орден/домен/традиция/доктрина/коллегия/амплуа), иначе `undefined`.
- `id` — слаг: `fury.aspect.2.inevitable-wrath`, из `<class-slug>.<keyedBy ?? "feature">.<level>.<name-slug>`; транслитерация кириллицы — таблицей в скрипте.

- [ ] **Шаг 1: Падающий тест**

```ts
it("скелет покрывает 10 классов и все уровни 1–10", () => {
  const byClass = new Map<string, Set<number>>();
  for (const f of GENERATED_CLASS_FEATURES) {
    if (!byClass.has(f.className)) byClass.set(f.className, new Set());
    byClass.get(f.className)!.add(f.level);
  }
  expect([...byClass.keys()].sort()).toEqual(["Неистовый","Нуль","Проводник","Тактик","Талант","Тень","Трубадур","Цензор","Элементалист"].sort());
  for (const [name, levels] of byClass) {
    expect([...levels].sort((a,b)=>a-b), name).toEqual([1,2,3,4,5,6,7,8,9,10]);
  }
});

it("id уникальны, вложенные фичи ссылаются на существующего родителя", () => {
  const ids = new Set(GENERATED_CLASS_FEATURES.map(f => f.id));
  expect(ids.size).toBe(GENERATED_CLASS_FEATURES.length);
  for (const f of GENERATED_CLASS_FEATURES) {
    if (f.parentId) expect(ids.has(f.parentId), f.id).toBe(true);
  }
});

it("вложенные фичи из таблиц Неистового разобраны по аспектам", () => {
  const nested = GENERATED_CLASS_FEATURES.filter(f => f.className === "Неистовый" && f.level === 2 && f.keyValue);
  expect(nested.map(f => f.name).sort()).toEqual(["Зуб и коготь","Неизбежный гнев","Непреодолимая сила"].sort());
});
```

- [ ] **Шаг 2: Падает** — `npx vitest run tests/class-features-skeleton.test.ts`, FAIL: нет `src/data/class-features.generated.json`.

- [ ] **Шаг 3: Написать скрипт и сгенерировать**

`node scripts/build-class-features.mjs` печатает по классам количество фич и вложенных. Ожидаемый порядок величин: Неистовый 77, Цензор 93, Проводник 102, Тактик 75, Тень 71, Трубадур 75, Нуль 88, Талант 82, Элементалист 89 (см. инвентаризацию; расхождение ±5 допустимо и должно быть объяснено в отчёте задачи).

- [ ] **Шаг 4: Тесты** — PASS. Затем `npm run build` (strict-проверка JSON-типа).

- [ ] **Шаг 5: Коммит**

```bash
git add scripts/build-class-features.mjs src/data/class-features.generated.json package.json tests/class-features-skeleton.test.ts
git commit -m "Generate class feature skeleton from book text"
```

---

### Задача 4: Реестр механик и тест покрытия

**Файлы:**
- Создать: `src/data/class-features/mechanics/index.ts`, `src/data/class-features/mechanics/exceptions.ts` (`TEXT_ONLY`, `NOT_YET`)
- Тест: `tests/class-feature-coverage.test.ts`

**Интерфейсы:**
- Потребляет: `GeneratedClassFeature` из задачи 3, `FeatureEffect`/`FeatureCondition` из задачи 1.
- Производит: `FeatureMechanics { kinds: FeatureKind[]; effects?: FeatureEffect[]; trigger?: FeatureTrigger; choice?: FeatureChoice; resource?: HeroicResourceSpec; notes?: string }`, `FEATURE_MECHANICS: Record<string, FeatureMechanics>`, `TEXT_ONLY: Record<string, string>`, `NOT_YET: Record<string, string>`, `mechanicsFor(id): FeatureMechanics | undefined`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("каждая фича скелета смоделирована, помечена прозой или отложена с причиной", () => {
  const unexplained = GENERATED_CLASS_FEATURES.filter(f =>
    !mechanicsFor(f.id) && !TEXT_ONLY[f.id] && !NOT_YET[f.className]);
  expect(unexplained.map(f => `${f.className}: ${f.name}`)).toEqual([]);
});

it("Неистовый покрыт полностью: ни одной отложенной фичи", () => {
  expect(NOT_YET["Неистовый"]).toBeUndefined();
  const missing = GENERATED_CLASS_FEATURES
    .filter(f => f.className === "Неистовый")
    .filter(f => !mechanicsFor(f.id) && !TEXT_ONLY[f.id]);
  expect(missing.map(f => f.name)).toEqual([]);
});
```

Второй тест стартует красным — это цель задач 8. `NOT_YET` в этой задаче заполняется для восьми классов с причиной «следующий заход: механики по инвентаризации».

- [ ] **Шаг 2: Падает** — `npx vitest run tests/class-feature-coverage.test.ts`.

- [ ] **Шаг 3: Создать реестр**

`mechanics/index.ts` собирает `FEATURE_MECHANICS` из файлов классов (`import { FURY_MECHANICS } from "./fury"`), пока список пуст. `exceptions.ts` — два словаря с комментариями по-русски.

- [ ] **Шаг 4: Тест 1 зелёный, тест 2 красный** — зафиксировать это в отчёте, не «чинить» тест 2 до задачи 8.

- [ ] **Шаг 5: Коммит**

```bash
git add src/data/class-features/mechanics tests/class-feature-coverage.test.ts
git commit -m "Add class feature mechanics registry and coverage gate"
```

---

### Задача 5: Активные фичи и триггеры

**Файлы:**
- Создать: `src/lib/class-features.ts`
- Изменить: `src/lib/feature-modifiers.ts` (`activeFeatureSources` подмешивает классовые фичи)
- Тест: `tests/class-features-active.test.ts`

**Интерфейсы:**
- Потребляет: `GENERATED_CLASS_FEATURES`, `mechanicsFor`, `automation.classFeatureSelections`.
- Производит: `ActiveClassFeature { id, name, level, className, keyValue?, description, mechanics }`, `activeClassFeatures(character): ActiveClassFeature[]`, `classFeatureTriggers(character): ActiveTrigger[]` где `ActiveTrigger { featureId, name, level, event, frequency, label, detail }`, `featureConditionMet(character, condition)` (перенести/использовать из движка).

- [ ] **Шаг 1: Падающий тест**

```ts
it("фича аспекта видна только выбранному аспекту", () => {
  const berserker = furyWithAspect("Берсерк");
  expect(activeClassFeatures(berserker).map(f => f.name)).toContain("Непреодолимая сила");
  expect(activeClassFeatures(berserker).map(f => f.name)).not.toContain("Зуб и коготь");
});

it("фича уровня выше героя не активна", () => {
  const hero = { ...furyWithAspect("Берсерк"), level: 1 };
  expect(activeClassFeatures(hero).some(f => f.level === 2)).toBe(false);
});

it("одноимённая фича на двух уровнях учитывается один раз", () => {
  const hero = furyWithAspect("Берсерк");
  const ids = activeClassFeatures(hero).map(f => f.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it("бонус характеристики из реестра меняет эффективные характеристики и снимается без авторасчёта", () => {
  const id = "fury.feature.1.test-characteristic";
  GENERATED_CLASS_FEATURES.push({ id, className: "Неистовый", level: 1, name: "Тест",
    articleId: "test", description: "" });
  FEATURE_MECHANICS[id] = { kinds: ["characteristic"],
    effects: [{ kind: "characteristic", key: "presence", value: 2 }] };
  try {
    const hero = createCharacter({ className: "Неистовый" });
    hero.characteristics.presence = 1;
    expect(effectiveCharacteristics(hero).presence).toBe(3);
    hero.automation = { ...hero.automation!, enabled: false };
    expect(effectiveCharacteristics(hero).presence).toBe(1);
  } finally {
    GENERATED_CLASS_FEATURES.pop();
    delete FEATURE_MECHANICS[id];
  }
});
```

Этот блок заменяет временный ключ `automation.characteristicEffectsForTest` из задачи 2: ключ удаляется из `types.ts` и из `effectiveCharacteristics`, тест задачи 2 на `applyCharacteristicEffects` остаётся.

- [ ] **Шаг 2: Падает** — нет `src/lib/class-features.ts`.

- [ ] **Шаг 3: Реализовать**

`activeClassFeatures`: фичи класса героя с `level <= character.level`, у которых выполнено условие вложенности — `keyValue` совпадает с выбранным значением соответствующей группы из `automation.classFeatureSelections` (для Неистового группа аспекта — `fury.aspect`), плюс `when`-условия. `feature-modifiers.activeFeatureSources` добавляет `mechanics.effects` этих фич к предкам; порядок источников детерминирован (по `id`), дедупликация по `id`.

- [ ] **Шаг 4: Тесты** — `npx vitest run`, PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/class-features.ts src/lib/feature-modifiers.ts tests/class-features-active.test.ts
git commit -m "Resolve active class features from level and selections"
```

---

### Задача 6: Героический ресурс и замены по тегу

**Файлы:**
- Создать: `src/lib/resources.ts`
- Тест: `tests/heroic-resources.test.ts`

**Интерфейсы:**
- Потребляет: `activeClassFeatures` из задачи 5, `resolveFeatureAmount` из задачи 1, типы `HeroicResourceSpec` и `ResourceGain` из задачи 1 (новые типы в этой задаче не вводятся).
- Производит: `ResourceGain { tag, event, amount, frequency, replaces? }`, `HeroicResourceSpec { name, canBeNegative?, gains, thresholds?, epic? }`, `resolvedResourceGains(character): ResolvedResourceGain[]` где `ResolvedResourceGain { tag, event, amount, frequency, label, sourceId, sourceName, used? }`, `resourceSpecFor(className): HeroicResourceSpec | undefined`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("прибавка 4-го уровня заменяет прибавку за урон, но не начало хода", () => {
  const hero = furyWithLevel(4);
  const tags = resolvedResourceGains(hero).map(g => g.tag);
  expect(tags).toContain("start");
  expect(tags).toContain("take-damage");
  expect(resolvedResourceGains(hero).find(g => g.tag === "take-damage")!.amount).toBe("2");
  expect(tags).not.toContain("take-damage 1");
});

it("на 7-м уровне начало хода даёт 1d3 + 1, на 10-м урон — 3", () => {
  expect(resolvedResourceGains(furyWithLevel(7)).find(g => g.event === "start-of-turn")!.amount).toBe("1d3 + 1");
  expect(resolvedResourceGains(furyWithLevel(10)).find(g => g.event === "take-damage")!.amount).toBe("3");
});

it("без авторасчёта прибавки всё равно видны", () => {
  const hero = furyWithLevel(4);
  hero.automation = { ...hero.automation!, enabled: false };
  expect(resolvedResourceGains(hero).length).toBeGreaterThan(0);
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Реализовать**

Порядок применения: прибавки базового ресурса → по возрастанию уровня источника; прибавка с `replaces` удаляет перечисленные теги (а не «первую попавшуюся») и добавляет свой. `amount` остаётся строкой (`"1d3"`, `"1d3 + 1"`, `"= Мощь"`) — лист показывает её как есть.

- [ ] **Шаг 4: Тесты** — PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/resources.ts tests/heroic-resources.test.ts
git commit -m "Add heroic resource gains with tag replacement"
```

---

### Задача 7: Состояние схватки: раунд, отметки триггеров, отмена

**Файлы:**
- Изменить: `src/types.ts` (`Character.runtime`), `src/lib/defaults.ts`, `src/lib/game-actions.ts`, `src/App.tsx` (диспетчер действий)
- Тест: `tests/runtime-state.test.ts`

**Интерфейсы:**
- Производит: `CharacterRuntime { round, encounter, triggers: Record<string, { round?: number; encounter?: number; count?: number }>, forms: string[], resources: Record<string, number> }`, новые `GameAction`-виды `{ kind: "round" }`, `{ kind: "encounter" }`, `{ kind: "trigger"; featureId: string; used: boolean }`, `beginRound(character)`, `beginEncounter(character)`, `markTrigger(character, featureId, used)`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("новый раунд снимает отметки раунда и сохраняет отметки схватки", () => {
  let hero = markTrigger(createCharacter({ className: "Неистовый" }), "f1", true);
  hero.runtime!.triggers["f2"] = { encounter: 1, count: 1 };
  hero = beginRound(hero);
  expect(hero.runtime!.triggers["f1"]).toBeUndefined();
  expect(hero.runtime!.triggers["f2"]).toEqual({ encounter: 1, count: 1 });
  expect(hero.runtime!.round).toBe(2);
});

it("отметка триггера проходит через журнал действий и отменяется", () => {
  const hero = createCharacter({ className: "Неистовый" });
  const preview = previewGameAction(hero, { kind: "trigger", featureId: "f1", used: true });
  expect(preview.ok).toBe(true);
  expect(undoReason(preview.ok ? preview.next : hero, historyEntryOf(preview))).toBeUndefined();
});

it("старый лист без runtime работает", () => {
  const hero = createCharacter({ className: "Неистовый" });
  delete (hero as { runtime?: unknown }).runtime;
  expect(() => beginRound(hero)).not.toThrow();
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Реализовать**

`runtime` инициализируется лениво (`round: 1, encounter: 1, triggers: {}, forms: [], resources: {}`), в `createCharacter` не пишется — старые листы остаются как есть. Действия идут через `previewGameAction`, поэтому попадают в журнал и отменяются. Отмена действия урона не удаляет отметки (отметка триггера — отдельное действие), но `beginRound` сбрасывает только `triggers[..].round` и `count` с `round`.

- [ ] **Шаг 4: Тесты** — PASS, `tests/game-actions.test.ts` и `tests/autosave.test.ts` зелёные.

- [ ] **Шаг 5: Коммит**

```bash
git add src/types.ts src/lib/defaults.ts src/lib/game-actions.ts src/App.tsx tests/runtime-state.test.ts
git commit -m "Track round, encounter and trigger marks as undoable game actions"
```

---

### Задача 8: Неистовый — полное покрытие

**Файлы:**
- Создать: `src/data/class-features/mechanics/fury.ts`, `src/data/class-features/resources.ts`
- Изменить: `src/data/class-features/mechanics/index.ts`
- Тест: `tests/class-fury.test.ts`

**Интерфейсы:**
- Потребляет: `FeatureMechanics`, `HeroicResourceSpec` (задачи 4 и 6), инвентаризацию `docs/superpowers/specs/class-inventory/group1.json` (объект `classes[]` с `class === "Неистовый"`, 77 записей).
- Производит: `FURY_MECHANICS: Record<string, FeatureMechanics>`, `FURY_RESOURCE: HeroicResourceSpec`.

- [ ] **Шаг 1: Падающий тест** (значения — из книги, не подбирать)

```ts
it("Свирепость: базовые прибавки, замены на 4/7/10", () => {
  const gains = resolvedResourceGains(fury(1)).map(g => `${g.event}:${g.amount}:${g.frequency}`);
  expect(gains).toEqual(["start-of-turn:1d3:round", "take-damage:1:round", "winded:1d3:encounter"]);
  expect(resolvedResourceGains(fury(4)).find(g => g.event === "take-damage")!.amount).toBe("2");
  expect(resolvedResourceGains(fury(7)).find(g => g.event === "start-of-turn")!.amount).toBe("1d3 + 1");
  expect(resolvedResourceGains(fury(10)).find(g => g.event === "take-damage")!.amount).toBe("3");
});

it("Неизбежный гнев даёт скорость, равную Ловкости", () => {
  const hero = fury(2, "Разоритель");
  hero.characteristics.agility = 3;
  expect(calculatedValues(hero).speed).toBe(8); // 5 + 3
});

it("Недвижимый объект добавляет устойчивость, равную Мощи", () => {
  const hero = fury(3, "Берсерк");
  hero.characteristics.might = 2;
  expect(characterStatBreakdown(hero, "stability").featureTotal).toBe(2);
});

it("Растущая свирепость включает бонус толчка только с порога ресурса", () => {
  const hero = fury(1, "Берсерк");
  hero.heroicResource.current = 1;
  expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(0);
  hero.heroicResource.current = 2;
  expect(featureFieldBonus(hero, "push", weaponAbility())).toBe(2); // Мощь = 2
});

it("пассивные и триггерные фичи Неистового видны в триггерах", () => {
  const triggers = classFeatureTriggers(fury(4, "Буревестник")).map(t => t.event);
  expect(triggers).toContain("end-of-turn"); // Зуб и коготь
  expect(triggers).toContain("take-damage"); // Неземные рефлексы
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Перенести 77 записей**

Правило переноса: каждая запись инвентаризации → ключ `id` из скелета с `effects`/`trigger`/`choice` по её `kinds` и `fields`; `conditions` из поля `condition` записи; триггеры — `event` + `frequency` + `label` + `detail`. Проза без механики — `TEXT_ONLY` с причиной. Всё, что в инвентаризации стоит в `ambiguous`, получает комментарий в данных с принятым решением.

- [ ] **Шаг 4: Зелёные оба теста покрытия (задача 4) и новые числа** — `npx vitest run`.

- [ ] **Шаг 5: Коммит**

```bash
git add src/data/class-features/mechanics/fury.ts src/data/class-features/mechanics/index.ts src/data/class-features/resources.ts tests/class-fury.test.ts
git commit -m "Model every Fury class feature, resource gain and trigger"
```

---

### Задача 9: Панель особенностей на листе

**Файлы:**
- Создать: `src/lib/class-feature-view.ts`, `src/views/sheet/ClassFeaturesPanel.tsx`, `src/views/sheet/ClassFeaturesPanel.css`
- Изменить: `src/views/SheetView.tsx` (встроить панель), `src/views/sheet/SheetQuickActions.tsx` (кнопки «раунд», «схватка»)
- Тест: `tests/class-feature-view.test.ts`

**Интерфейсы:**
- Потребляет: `activeClassFeatures`, `classFeatureTriggers`, `resolvedResourceGains`, `markTrigger`, `beginRound`, `beginEncounter`.
- Производит: `classFeatureGroupsForSheet(character): FeatureSheetGroup[]` где `FeatureSheetGroup { level, title, features: FeatureSheetItem[] }`, `FeatureSheetItem { id, name, level, summary, triggerBadge?: { label, count, used } }`; `triggerBadgeCounts(character): number`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("панель группирует фичи по уровню и не показывает будущие", () => {
  const groups = classFeatureGroupsForSheet(fury(3));
  expect(groups.map(g => g.level)).toEqual([1, 2, 3]);
});

it("бейдж показывает неотмеченные триггеры раунда", () => {
  const hero = fury(4, "Буревестник");
  expect(triggerBadgeCounts(hero)).toBeGreaterThan(0);
  const marked = markTrigger(hero, classFeatureTriggers(hero)[0].featureId, true);
  expect(triggerBadgeCounts(marked)).toBe(triggerBadgeCounts(hero) - 1);
});

it("при выключенном авторасчёте панель всё равно показывает фичи", () => {
  const hero = fury(4, "Берсерк");
  hero.automation = { ...hero.automation!, enabled: false };
  expect(classFeatureGroupsForSheet(hero).length).toBeGreaterThan(0);
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Реализовать**

`class-feature-view.ts` — чистая логика (группы, подписи, счётчики бейджей, «доступно сейчас» по `runtime`). `ClassFeaturesPanel` рендерит группы по уровням (свёрнутые, кроме текущего уровня), бейдж `сработает: получил урон · 2`, кнопку отметки, и селект варианта для групп выбора (пишет в `automation.classFeatureSelections` через обычное обновление персонажа). Кнопки «Новый раунд» / «Новая схватка» в `SheetQuickActions` шлют действия из задачи 7.

- [ ] **Шаг 4: Тесты** — PASS; `npm run build` без ошибок strict.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/class-feature-view.ts src/views/sheet/ClassFeaturesPanel.tsx src/views/sheet/ClassFeaturesPanel.css src/views/SheetView.tsx src/views/sheet/SheetQuickActions.tsx tests/class-feature-view.test.ts
git commit -m "Show active class features and trigger badges on the sheet"
```

---

### Задача 10: Прибавки ресурса в панели ресурсов

**Файлы:**
- Изменить: `src/views/sheet/ResourcesPanel.tsx`, `src/views/sheet/ResourcesPanel.css`, `src/data/resource-help.ts`
- Тест: `tests/resource-panel-labels.test.ts`

**Интерфейсы:**
- Потребляет: `resolvedResourceGains`, `runtime`, `previewGameAction`.
- Производит: `resourceGainLabels(character): { tag, label, amount, frequency, used }[]` в `src/lib/resources.ts`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("прибавки показываются с триггером, количеством и частотой", () => {
  expect(resourceGainLabels(fury(1))).toEqual([
    { tag: "start", label: "Начало твоего хода", amount: "1d3", frequency: "раунд", used: false },
    { tag: "take-damage", label: "Получаешь урон", amount: "1", frequency: "раунд", used: false },
    { tag: "winded", label: "Становишься при смерти", amount: "1d3", frequency: "схватка", used: false },
  ]);
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Реализовать** — блок «Откуда капает» под числом ресурса: триггер, количество, частота, кнопка «получено» (действие задачи 7), подсказка с порогами трат по уровню и эпическим ресурсом.

- [ ] **Шаг 4: Тесты** — PASS, затем `npm test` целиком.

- [ ] **Шаг 5: Коммит**

```bash
git add src/views/sheet/ResourcesPanel.tsx src/views/sheet/ResourcesPanel.css src/data/resource-help.ts src/lib/resources.ts tests/resource-panel-labels.test.ts
git commit -m "List heroic resource gains with triggers and frequency"
```

---

### Задача 11: Левел-ап показывает полученные особенности

**Файлы:**
- Изменить: `src/lib/level-up.ts` (`LevelUpPlan`), `src/views/sheet/LevelUpDialog.tsx`
- Тест: `tests/level-up-features.test.ts`

**Интерфейсы:**
- Потребляет: `activeClassFeatures` из задачи 5.
- Производит: `LevelUpPlan.classFeatures: { id: string; name: string; level: number; summary: string }[]`.

- [ ] **Шаг 1: Падающий тест**

```ts
export function getLevelUpPlan(character: Character): LevelUpPlan;

it("план повышения перечисляет особенности нового уровня, а не спрашивает их", () => {
  const hero = { ...createCharacter({ className: "Неистовый" }), level: 1 };
  const plan = getLevelUpPlan(hero);
  expect(plan.classFeatures.map(f => f.level)).toEqual([2]);
  expect(plan.classFeatures.map(f => f.name)).toContain("Неизбежный гнев"); // выбран Разоритель
  // никакого нового выбора особенностей на 2-м уровне не появляется
  expect(plan.choices.some(c => c.kind === "classFeature")).toBe(false);
});
```

- [ ] **Шаг 2: Падает** — `npx vitest run tests/level-up-features.test.ts`.

- [ ] **Шаг 3: Реализовать** — `getLevelUpPlan` добавляет `classFeatures` (активные фичи ровно нового уровня) и `LevelUpDialog` рисует их над списком выборов способностей, без чекбоксов.

- [ ] **Шаг 4: Тесты** — `npx vitest run`, включая `level-up.test.ts`, `level-up-rules.test.ts`, `level-up-persistence.test.ts`.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/level-up.ts src/views/sheet/LevelUpDialog.tsx tests/level-up-features.test.ts
git commit -m "Show granted class features in the level-up plan"
```

---

### Задача 12: Принудительное перемещение под карточкой способности

**Файлы:**
- Изменить: `src/lib/character-calculations.ts` (экспорт `abilityForcedMovement`), `src/components/AbilityCard.tsx`
- Тест: `tests/ability-forced-movement.test.ts`

**Интерфейсы:**
- Потребляет: `featureFieldBonus` из задачи 1.
- Производит: `abilityForcedMovement(ability, character): { push: number; pull: number; slide: number }`.

- [ ] **Шаг 1: Падающий тест**

```ts
it("лист показывает добавку к толчку отдельной строкой и не правит текст тира", () => {
  const hero = furyWithAspect("Берсерк");
  hero.heroicResource.current = 2;
  const ability = weaponAbility(); // «3 + М урона; толчок 1»
  expect(abilityForcedMovement(ability, hero)).toEqual({ push: 2, pull: 0, slide: 0 }); // Мощь = 2
  expect(ability.tiers[0].effect ?? "").toBe(""); // сам текст не переписан
});

it("без бонусов строка пустая", () => {
  expect(abilityForcedMovement(weaponAbility(), createCharacter({ className: "Неистовый" })))
    .toEqual({ push: 0, pull: 0, slide: 0 });
});
```

- [ ] **Шаг 2: Падает.**

- [ ] **Шаг 3: Реализовать** — `AbilityCard` рисует под тирами строку «Толчок +2 · Швыряние +1», только для ненулевых значений.

- [ ] **Шаг 4: Тесты** — `npm test` целиком (это последняя задача захода).

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/character-calculations.ts src/components/AbilityCard.tsx tests/ability-forced-movement.test.ts
git commit -m "Show forced movement bonuses under ability cards"
```

---

## Что осознанно вне этого плана
- Механики остальных 8 классов — следующий заход по той же схеме (скелет, `mechanics/<class>.ts`, покрытие). Тест покрытия уже держит для них `NOT_YET`.
- Миграция старых id выборов (`null.augmentation` и др.) и удаление `class-feature-rules.ts`/`manualReason` — вместе с тем заходом: у Неистового старых id не было.
- Структурирование эффектов тиров способностей, подсчёт иммунитетов в `applyDamage`.
