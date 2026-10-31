import { CENSOR_BASE_TEXT_ONLY } from "./censor-base";
import { CENSOR_DOMAIN_TEXT_ONLY } from "./censor-domains";
import { CENSOR_LEVEL_TEXT_ONLY } from "./censor-levels";
import { CENSOR_ORDER_TEXT_ONLY } from "./censor-orders";
import { CONDUIT_BASE_TEXT_ONLY } from "./conduit-base";
import { CONDUIT_LEVEL_TEXT_ONLY } from "./conduit-levels";
import { ELEMENTALIST_BASE_TEXT_ONLY } from "./elementalist-base";
import { ELEMENTALIST_EARLY_TEXT_ONLY } from "./elementalist-early";
import { ELEMENTALIST_ENCHANTMENT_TEXT_ONLY } from "./elementalist-enchantments";
import { ELEMENTALIST_LATE_TEXT_ONLY } from "./elementalist-late";
import { ELEMENTALIST_SANCTUARY_TEXT_ONLY } from "./elementalist-sanctuaries";
import { NULL_AUGMENTATION_TEXT_ONLY } from "./null-augmentations";
import { NULL_BASE_TEXT_ONLY } from "./null-base";
import { NULL_EARLY_TEXT_ONLY } from "./null-early";
import { NULL_LATE_TEXT_ONLY } from "./null-late";
import { NULL_MASTERY_TEXT_ONLY } from "./null-mastery";
import { NULL_TRADITION_TEXT_ONLY } from "./null-traditions";
import { SHADOW_BASE_TEXT_ONLY } from "./shadow-base";
import { SHADOW_COLLEGE_TEXT_ONLY } from "./shadow-colleges";
import { SHADOW_LEVEL_TEXT_ONLY } from "./shadow-levels";
import { TALENT_AUGMENTATION_TEXT_ONLY } from "./talent-augmentations";
import { TALENT_BASE_TEXT_ONLY } from "./talent-base";
import { TALENT_EARLY_TEXT_ONLY } from "./talent-early";
import { TALENT_LATE_TEXT_ONLY } from "./talent-late";
import { TALENT_SANCTUARY_TEXT_ONLY } from "./talent-sanctuaries";
import { TALENT_TRADITION_TEXT_ONLY } from "./talent-traditions";
import { TACTICIAN_BASE_TEXT_ONLY } from "./tactician-base";
import { TACTICIAN_DOCTRINE_TEXT_ONLY } from "./tactician-doctrines";
import { TACTICIAN_LEVEL_TEXT_ONLY } from "./tactician-levels";
import { TROUBADOUR_BASE_TEXT_ONLY } from "./troubadour-base";
import { TROUBADOUR_LEVEL_TEXT_ONLY } from "./troubadour-levels";
import { TROUBADOUR_TROUPE_TEXT_ONLY } from "./troubadour-troupes";

/**
 * Особенности, которые сознательно остаются прозой: правило читается из текста
 * книги и не автоматизируется. Ключ — `id` записи скелета, значение — причина.
 *
 * Словарь собирается из файлов классов: каждый класс держит свои прозаические
 * записи рядом со своими механиками, а тест покрытия читает один общий объект.
 */
export const TEXT_ONLY: Record<string, string> = {
  // Неистовый: заголовки таблиц выдачи. Сами выдачи — во вложенных записях
  // аспектов, у которых стоит `keyedBy: "aspect"`; дублировать их в заголовке
  // значило бы показывать листу одну и ту же особенность дважды.
  "feature.fury.level-1.1st-level-aspect-features":
    "заголовок таблицы: аспект выдаёт две особенности, они приходят вложенными записями (Комплект, Первозданная сила, Первозданная хитрость, Форма зверя, Безжалостный охотник)",
  "feature.fury.level-1.aspect-triggered-action":
    "заголовок таблицы: триггер аспекта выдаётся вложенной записью своего аспекта (Линии силы, Неземные рефлексы, Яростное изменение)",
  "feature.fury.level-1.fury-abilities":
    "контейнер: знаковая и героические способности 1-го уровня перечислены вложенными записями и справочником способностей",
  "feature.fury.level-1.heroic-abilities":
    "контейнер: набор героических способностей со свирепостью, конкретные способности — записи справочника",
  "feature.fury.level-2.2nd-level-aspect-feature":
    "заголовок таблицы: особенность 2-го уровня выдаётся вложенной записью аспекта (Непреодолимая сила, Неизбежный гнев, Зуб и коготь)",
  "feature.fury.level-2.2nd-level-aspect-ability":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  "feature.fury.level-3.3rd-level-aspect-feature":
    "заголовок таблицы: особенность 3-го уровня выдаётся вложенной записью аспекта (Недвижимый объект, Видеть сквозь их уловки, Рыцарь природы)",
  "feature.fury.level-5.5th-level-aspect-feature":
    "заголовок таблицы: особенность 5-го уровня выдаётся вложенной записью аспекта (Прыгун, Раскованный, Рожденный штормом)",
  "feature.fury.level-6.6th-level-aspect-ability":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  "feature.fury.level-8.8th-level-aspect-feature":
    "заголовок таблицы: особенность 8-го уровня выдаётся вложенной записью аспекта (Сильнейший, На шаг впереди, Зверинец)",
  "feature.fury.level-9.9th-level-aspect-ability":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  ...CENSOR_BASE_TEXT_ONLY,
  ...CENSOR_DOMAIN_TEXT_ONLY,
  ...CENSOR_LEVEL_TEXT_ONLY,
  ...CENSOR_ORDER_TEXT_ONLY,
  ...CONDUIT_BASE_TEXT_ONLY,
  ...CONDUIT_LEVEL_TEXT_ONLY,
  ...ELEMENTALIST_BASE_TEXT_ONLY,
  ...ELEMENTALIST_ENCHANTMENT_TEXT_ONLY,
  ...ELEMENTALIST_SANCTUARY_TEXT_ONLY,
  ...ELEMENTALIST_EARLY_TEXT_ONLY,
  ...ELEMENTALIST_LATE_TEXT_ONLY,
  ...NULL_BASE_TEXT_ONLY,
  ...NULL_AUGMENTATION_TEXT_ONLY,
  ...NULL_MASTERY_TEXT_ONLY,
  ...NULL_EARLY_TEXT_ONLY,
  ...NULL_TRADITION_TEXT_ONLY,
  ...NULL_LATE_TEXT_ONLY,
  ...SHADOW_BASE_TEXT_ONLY,
  ...SHADOW_COLLEGE_TEXT_ONLY,
  ...SHADOW_LEVEL_TEXT_ONLY,
  ...TALENT_BASE_TEXT_ONLY,
  ...TALENT_AUGMENTATION_TEXT_ONLY,
  ...TALENT_SANCTUARY_TEXT_ONLY,
  ...TALENT_EARLY_TEXT_ONLY,
  ...TALENT_TRADITION_TEXT_ONLY,
  ...TALENT_LATE_TEXT_ONLY,
  ...TACTICIAN_BASE_TEXT_ONLY,
  ...TACTICIAN_DOCTRINE_TEXT_ONLY,
  ...TACTICIAN_LEVEL_TEXT_ONLY,
  ...TROUBADOUR_BASE_TEXT_ONLY,
  ...TROUBADOUR_TROUPE_TEXT_ONLY,
  ...TROUBADOUR_LEVEL_TEXT_ONLY,
};

/**
 * Классы, чьи механики ещё не перенесены из книги. Ключ — имя класса,
 * значение — причина отсрочки. Неистового здесь нет: он обязан быть покрыт
 * полностью, это отдельный тест.
 *
 * Все девять классов перенесены, поэтому список пуст. Механизм оставлен:
 * следующая книга добавит классы сюда, и лист снова спрячет их до разбора.
 */
export const NOT_YET: Record<string, string> = {};
