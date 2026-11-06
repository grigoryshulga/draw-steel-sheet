import { CharacteristicGlyphText } from "../CharacteristicGlyph";
import type { RuleEntity } from "../../rules/schema";
import { headingId } from "../../lib/codex";
import type { ArtAsset } from "../../lib/art";
import { ArtworkFigure } from "../Artwork";
import {
  AbilityBody,
  AbilityTags,
  referenceAbilityView,
} from "./AbilitySheet";
import { RuleMarkdown, headingTag } from "./RuleMarkdown";
import "./RuleEntity.css";
import { KitRuleBody } from "./KitRuleBody";

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
export function RuleEntityView({
  entity,
  art,
  onOpen,
  withAnchor = true,
  headingLevel = 2,
}: {
  entity: RuleEntity;
  art?: ArtAsset;
  /** Открыть полную карточку в поп-апе; работает только для способностей. */
  onOpen?: () => void;
  /** В поп-апе якоря не нужны: они уже есть у карточки на странице. */
  withAnchor?: boolean;
  /** Уровень заголовка имени сущности: на странице класса он ниже заголовка уровня. */
  headingLevel?: number;
}) {
  const anchor = withAnchor ? ruleEntityAnchor(entity) : undefined;
  const ability = entity.ability ? referenceAbilityView(entity.ability) : null;
  const content = stripRepeatedEntityHeading(entity.markdown, entity.name);
  const hasMarkdown = content.markdown.trim().length > 0;
  const openable = Boolean(ability && onOpen);
  const Heading = headingTag(headingLevel);
  const nestedHeadingOffset = headingLevel === 2 ? 0 : headingLevel - 1;

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
          data-basic={ability.basic ? "true" : undefined}
          data-openable={openable ? "true" : undefined}
          role={openable ? "button" : undefined}
          tabIndex={openable ? 0 : undefined}
          aria-label={openable ? `Открыть карточку: ${entity.name}` : undefined}
          onClick={openable ? onOpen : undefined}
          onKeyDown={
            openable
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen?.();
                  }
                }
              : undefined
          }
        >
          <header className="rule-entity-head card-band">
            <Heading className="rule-entity-name" id={anchor}>
              {entity.name}
            </Heading>
            <AbilityTags view={ability} />
          </header>

          {ability.flavor && (
            <p className="rule-ability-flavor">{ability.flavor}</p>
          )}

          <AbilityBody view={ability} full />

          {ability.trigger && (
            <p className="rule-ability-trigger">
              <strong className="rule-ability-trigger-label">Триггер:</strong>{" "}
              <CharacteristicGlyphText text={ability.trigger} />
            </p>
          )}
        </article>

        <RuleMarkdown
          text={entity.markdown}
          articleId={entity.source.articleId}
          className="rule-text rule-entity-extras"
          headingOffset={nestedHeadingOffset}
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
      <header
        className="rule-entity-head"
        id={withAnchor ? content.headingId || undefined : undefined}
      >
        <div className="rule-entity-title">
          <Heading className="rule-entity-name" id={anchor}>
            {entity.name}
          </Heading>
        </div>
      </header>

      {art && hasMarkdown && (
        <ArtworkFigure
          art={art}
          className="codex-article-art rule-entity-art"
        />
      )}

      {hasMarkdown && entity.kind === "kit" ? (
        <KitRuleBody text={content.markdown} articleId={entity.source.articleId} headingOffset={nestedHeadingOffset} />
      ) : hasMarkdown ? (
        <RuleMarkdown
          text={content.markdown}
          articleId={entity.source.articleId}
          headingOffset={nestedHeadingOffset}
        />
      ) : (
        <p className="rule-entity-empty">
          В источнике нет описания этого правила.
        </p>
      )}
    </section>
  );
}
