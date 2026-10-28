import { CENSOR_BASE_TEXT_ONLY } from "./censor-base";
import { CENSOR_DOMAIN_TEXT_ONLY } from "./censor-domains";
import { CENSOR_LEVEL_TEXT_ONLY } from "./censor-levels";
import { CENSOR_ORDER_TEXT_ONLY } from "./censor-orders";
import { CONDUIT_BASE_TEXT_ONLY } from "./conduit-base";
import { CONDUIT_LEVEL_TEXT_ONLY } from "./conduit-levels";
import { NULL_AUGMENTATION_TEXT_ONLY } from "./null-augmentations";
import { NULL_BASE_TEXT_ONLY } from "./null-base";
import { NULL_EARLY_TEXT_ONLY } from "./null-early";
import { NULL_LATE_TEXT_ONLY } from "./null-late";
import { NULL_MASTERY_TEXT_ONLY } from "./null-mastery";
import { NULL_TRADITION_TEXT_ONLY } from "./null-traditions";
import { TALENT_AUGMENTATION_TEXT_ONLY } from "./talent-augmentations";
import { TALENT_BASE_TEXT_ONLY } from "./talent-base";
import { TALENT_EARLY_TEXT_ONLY } from "./talent-early";
import { TALENT_LATE_TEXT_ONLY } from "./talent-late";
import { TALENT_SANCTUARY_TEXT_ONLY } from "./talent-sanctuaries";
import { TALENT_TRADITION_TEXT_ONLY } from "./talent-traditions";
import { TACTICIAN_BASE_TEXT_ONLY } from "./tactician-base";
import { TACTICIAN_DOCTRINE_TEXT_ONLY } from "./tactician-doctrines";
import { TACTICIAN_LEVEL_TEXT_ONLY } from "./tactician-levels";

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
  "fury.feature.1.osobennosti-aspekta-1-go-urovnya":
    "заголовок таблицы: аспект выдаёт две особенности, они приходят вложенными записями (Комплект, Первозданная сила, Первозданная хитрость, Форма зверя, Безжалостный охотник)",
  "fury.feature.1.trigger-aspekta":
    "заголовок таблицы: триггер аспекта выдаётся вложенной записью своего аспекта (Линии силы, Неземные рефлексы, Яростное изменение)",
  "fury.feature.1.sposobnosti-neistovogo":
    "контейнер: знаковая и героические способности 1-го уровня перечислены вложенными записями и справочником способностей",
  "fury.feature.1.geroicheskie-sposobnosti":
    "контейнер: набор героических способностей со свирепостью, конкретные способности — записи справочника",
  "fury.feature.2.osobennost-aspekta-2-go-urovnya":
    "заголовок таблицы: особенность 2-го уровня выдаётся вложенной записью аспекта (Непреодолимая сила, Неизбежный гнев, Зуб и коготь)",
  "fury.feature.2.sposobnost-aspekta-2-go-urovnya":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  "fury.feature.3.osobennost-aspekta-3-go-urovnya":
    "заголовок таблицы: особенность 3-го уровня выдаётся вложенной записью аспекта (Недвижимый объект, Видеть сквозь их уловки, Рыцарь природы)",
  "fury.feature.5.osobennost-aspekta-5-go-urovnya":
    "заголовок таблицы: особенность 5-го уровня выдаётся вложенной записью аспекта (Прыгун, Раскованный, Рожденный штормом)",
  "fury.feature.6.sposobnost-aspekta-6-go-urovnya":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  "fury.feature.8.osobennost-aspekta-8-go-urovnya":
    "заголовок таблицы: особенность 8-го уровня выдаётся вложенной записью аспекта (Сильнейший, На шаг впереди, Зверинец)",
  "fury.feature.9.sposobnost-aspekta-9-go-urovnya":
    "заголовок: выбор одной из двух способностей делается в записи своего аспекта",
  ...CENSOR_BASE_TEXT_ONLY,
  ...CENSOR_DOMAIN_TEXT_ONLY,
  ...CENSOR_LEVEL_TEXT_ONLY,
  ...CENSOR_ORDER_TEXT_ONLY,
  ...CONDUIT_BASE_TEXT_ONLY,
  ...CONDUIT_LEVEL_TEXT_ONLY,
  ...NULL_BASE_TEXT_ONLY,
  ...NULL_AUGMENTATION_TEXT_ONLY,
  ...NULL_MASTERY_TEXT_ONLY,
  ...NULL_EARLY_TEXT_ONLY,
  ...NULL_TRADITION_TEXT_ONLY,
  ...NULL_LATE_TEXT_ONLY,
  ...TALENT_BASE_TEXT_ONLY,
  ...TALENT_AUGMENTATION_TEXT_ONLY,
  ...TALENT_SANCTUARY_TEXT_ONLY,
  ...TALENT_EARLY_TEXT_ONLY,
  ...TALENT_TRADITION_TEXT_ONLY,
  ...TALENT_LATE_TEXT_ONLY,
  ...TACTICIAN_BASE_TEXT_ONLY,
  ...TACTICIAN_DOCTRINE_TEXT_ONLY,
  ...TACTICIAN_LEVEL_TEXT_ONLY,
};

/**
 * Классы, чьи механики ещё не перенесены из книги. Ключ — имя класса,
 * значение — причина отсрочки. Неистового здесь нет: он обязан быть покрыт
 * полностью, это отдельный тест.
 */
export const NOT_YET: Record<string, string> = {
  "Тень": "следующий заход: механики по инвентаризации",
  "Трубадур": "следующий заход: механики по инвентаризации",
  "Элементалист": "следующий заход: механики по инвентаризации",
};
