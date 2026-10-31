import type { CompendiumAbility } from "../types";
import { CANONICAL_ABILITY_COMPENDIUM } from "../rules/consumer-abilities";

/**
 * Публичный интерфейс каталога способностей для листа и строителя.
 *
 * Данные приходят из канонических сущностей правил через
 * `src/rules/consumer-abilities.ts`; старый датасет способностей
 * больше не читается во время работы или обычной сборки.
 */
export const ABILITY_COMPENDIUM: CompendiumAbility[] =
  CANONICAL_ABILITY_COMPENDIUM;
