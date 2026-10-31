import type { RuleEntity, RuleEntityKind } from "../../rules/schema";
import { headingId } from "../../lib/codex";
import { Chip } from "../ui";
import {
  AbilityBody,
  AbilityTags,
  referenceAbilityView,
} from "./AbilitySheet";
import { RuleMarkdown } from "./RuleMarkdown";
import "./RuleEntity.css";

export const RULE_ENTITY_KIND_LABELS: Record<RuleEntityKind, string> = {
  ability: "Способность",
  feature: "Особенность",
  ancestry: "Происхождение",
  kit: "Комплект",
  perk: "Перк",
  item: "Предмет",
  project: "Проект",
  title: "Титул",
};

/** Стабильный якорь раздела: зависит от id, а не от перевода названия. */
export function ruleEntityAnchor(entity: Pick<RuleEntity, "id">): string {
  return `rule-entity-${entity.id.replace(/[^\p{L}\p{N}_.:-]+/gu, "-")}`;
}

const MARKDOWN_HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;

/** Сравнимая форма строки заголовка: без разметки и лишних пробелов. */
function headingText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * В исходнике у сущности первым идёт заголовок с её собственным именем.
 * Раздел уже выводит имя отдельным `<h2>`, поэтому такой заголовок — дубль.
 * Убираем его из тела, но возвращаем id: по нему оглавление статьи ведёт
 * на раздел (id заголовков в манифесте посчитаны по исходному тексту).
 */
export function stripRepeatedEntityHeading(
  markdown: string,
  name: string,
): { markdown: string; headingId: string } {
  const lines = markdown.split("\n");
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  const match =
    index < lines.length ? MARKDOWN_HEADING.exec(lines[index].trim()) : null;
  if (!match) return { markdown, headingId: "" };

  const title = headingText(match[2]);
  if (!title || title !== headingText(name)) return { markdown, headingId: "" };

  const rest = lines.slice(index + 1);
  while (rest.length > 0 && !rest[0].trim()) rest.shift();
  return { markdown: rest.join("\n"), headingId: headingId(title) };
}

/**
 * Чтение одной канонической сущности правил.
 *
 * Способность показывается ровно одной полной карточкой — той же разметкой,
 * что и на листе героя (`sheet-ability-card`), но с напечатанными в книге
 * значениями. Полный `markdown` источника больше не дублирует карточку: из
 * него берутся только «допблоки», которых в проекции нет (Поддержание,
 * Потратить, Особое, списки и проза). Остальные виды правил выводят полный
 * текст без сокращений — таблицы, ссылки, вложенные списки и заметки
 * остаются частью правила. Единственное исключение — ведущий заголовок,
 * дословно повторяющий имя сущности: имя уже стоит в шапке раздела.
 */
export function RuleEntityView({ entity }: { entity: RuleEntity }) {
  const anchor = ruleEntityAnchor(entity);
  const ability = entity.ability ? referenceAbilityView(entity.ability) : null;
  const content = stripRepeatedEntityHeading(entity.markdown, entity.name);
  const hasMarkdown = content.markdown.trim().length > 0;

  if (ability)
    return (
      <section
        className={`rule-entity rule-entity-${entity.kind}`}
        data-rule-entity={entity.id}
        data-kind={entity.kind}
        aria-labelledby={anchor}
      >
        <article
          className="sheet-ability-card is-full"
          data-action={ability.actionType}
          data-kind={ability.kind}
        >
          <header className="rule-entity-head">
            <h2 className="rule-entity-name" id={anchor}>
              {entity.name}
            </h2>
            <AbilityTags view={ability} />
          </header>

          {ability.flavor && (
            <p className="rule-ability-flavor">{ability.flavor}</p>
          )}

          <AbilityBody view={ability} full />

          {ability.trigger && (
            <p className="rule-ability-trigger">
              <strong className="rule-ability-trigger-label">Триггер:</strong>{" "}
              {ability.trigger}
            </p>
          )}
        </article>

        <RuleMarkdown
          text={entity.markdown}
          articleId={entity.source.articleId}
          className="rule-text rule-entity-extras"
          abilityCardRemainder={{ shownText: entity.ability?.effect }}
        />
      </section>
    );

  return (
    <section
      className={`rule-entity rule-entity-${entity.kind}`}
      data-rule-entity={entity.id}
      data-kind={entity.kind}
      aria-labelledby={anchor}
    >
      <header className="rule-entity-head" id={content.headingId || undefined}>
        <div className="rule-entity-title">
          <Chip className="rule-entity-kind">
            {RULE_ENTITY_KIND_LABELS[entity.kind] ?? entity.kind}
          </Chip>
          <h2 className="rule-entity-name" id={anchor}>
            {entity.name}
          </h2>
        </div>
      </header>

      {hasMarkdown ? (
        <RuleMarkdown
          text={content.markdown}
          articleId={entity.source.articleId}
        />
      ) : (
        <p className="rule-entity-empty">
          В источнике нет описания этого правила.
        </p>
      )}
    </section>
  );
}
