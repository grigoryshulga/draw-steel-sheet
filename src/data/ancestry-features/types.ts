import type { Ability } from "../../types";
import type { FeatureEffect } from "../class-features/types";

/**
 * Запись скелета происхождения из канонической проекции
 * `generated/consumers/features.json`: разобранный текст книги без механики.
 * Механика живёт отдельно, ключом по `id`, — как у классовых особенностей.
 */
export interface GeneratedAncestryFeature {
  id: string;
  ancestryName: string;
  /** Знаковая черта выдаётся вместе с происхождением, купленная — за очки. */
  kind: "signature" | "trait";
  name: string;
  /** Стоимость в очках происхождения; у знаковых черт её нет. */
  cost?: number;
  articleId: string;
  /** Markdown источника. */
  description: string;
}

/** Способность, которую выдаёт одна черта. */
export interface AncestryAbilityOption {
  id: string;
  label: string;
  ability: Ability;
}

/**
 * Выбор одной способности из списка. `group` — стабильный ключ сохранения
 * в `automation.ancestryFeatureSelections`; `id` варианта — значение.
 */
export interface AncestryAbilityChoice {
  group: string;
  label: string;
  options: AncestryAbilityOption[];
}

/**
 * Механика происхождения. Пока модель знает способности и выбор способности;
 * числовые эффекты остаются в старом реестре `ANCESTRY_FEATURE_RULES`, пока
 * для них не появится общий путь. Поле `effects` оставлено для этого перехода.
 */
export interface AncestryFeatureMechanics {
  abilities?: Ability[];
  choice?: AncestryAbilityChoice;
  effects?: FeatureEffect[];
  /** Контекст, который лист не считает: пассивные правила, ограничения. */
  notes?: string;
}
