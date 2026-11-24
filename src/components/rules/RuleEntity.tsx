import { EnglishAbilityRemainder } from "./EnglishAbilityRemainder";
import { printedAbilityView } from "./printedAbilityView";
import type { DirectorView } from "../../lib/remark-director-view";
import { Fragment, type ReactNode } from 'react';
import { CharacteristicGlyphText } from "../CharacteristicGlyph";
import { englishKitVariantName } from "../../rules/kit-variants";
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
import { useRuleLanguage } from "../../i18n/locale";

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
): { markdown: string; headingId: string; label?: string } {
  const lines = markdown.split("\n");
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  const match =
    index < lines.length ? MARKDOWN_HEADING.exec(lines[index].trim()) : null;
  if (!match) return { markdown, headingId: "" };

  const title = headingText(match[2]);
  const signature = /^Знаковая черта:\s*/i.test(title);
  const comparable = title.replace(/^Знаковая черта:\s*/i, "");
  if (!title || comparable.toLocaleLowerCase("ru") !== headingText(name).toLocaleLowerCase("ru")) return { markdown, headingId: "" };

  const rest = lines.slice(index + 1);
  while (rest.length > 0 && !rest[0].trim()) rest.shift();
  return { markdown: rest.join("\n"), headingId: headingId(title), ...(signature ? { label: "Знаковая черта" } : {}) };
}

function missingHeadingAnchors(previous: string, current: string, existing: (string | undefined)[]) {
  const headingIds = (text: string) => [...text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)]
    .map(match => headingId(headingText(match[1])));
  const rendered = new Set([...existing, ...headingIds(current)]);
  return [...new Set(headingIds(previous))].filter(id => id && !rendered.has(id))
    .map(id => <span key={id} id={id} />);
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
  entities,
  art,
  onOpen,
  withAnchor = true,
  headingLevel = 2,
  headingActions,
  directorMode,
}: {
  entity: RuleEntity;
  entities?: Record<string, RuleEntity>;
  art?: ArtAsset;
  /** Открыть полную карточку в поп-апе; работает только для способностей. */
  onOpen?: () => void;
  /** В поп-апе якоря не нужны: они уже есть у карточки на странице. */
  withAnchor?: boolean;
  /** Уровень заголовка имени сущности: на странице класса он ниже заголовка уровня. */
  headingLevel?: number;
  headingActions?: ReactNode;
  directorMode?: DirectorView;
}) {
  const englishText = entity.englishEdition?.text || entity.originalDescription;
  const { language, available } = useRuleLanguage(entity.id, englishText);
  const anchor = withAnchor ? ruleEntityAnchor(entity) : undefined;
  const english = language === "en" && available;
  const name = english ? entity.englishEdition?.name || entity.originalName || entity.name : entity.name;
  const content = stripRepeatedEntityHeading(english ? englishText! : entity.markdown, name);
  const baseAbility = entity.ability && referenceAbilityView(entity.ability);
  const edition = english ? entity.printedAbility : undefined;
  const ability = english && baseAbility
    ? edition && printedAbilityView(baseAbility, edition, undefined, text => <RuleMarkdown sourceLocale="en" text={text} articleId={entity.source.articleId} />)
    : baseAbility;
  const trigger = ability?.trigger;
  const printedCreature = entity.printedCreature?.[language];
  const hasMarkdown = Boolean(printedCreature || content.markdown.trim());
  const openable = Boolean(ability && onOpen);
  const Heading = headingTag(headingLevel);
  const nestedHeadingOffset = headingLevel === 2 ? 0 : headingLevel - 1;
  const creatureSheet = Boolean(entity.director && (entity.kind === "monster" || entity.kind === "retainer"));
  const directorHeading = creatureSheet && (!directorMode || directorMode === "stats") ? <div className="director-mini-title" id={withAnchor ? content.headingId || undefined : undefined}>
    <Heading className="rule-entity-name" id={anchor}>{name}</Heading>
    {!english && entity.originalName && <span className="director-mini-original" lang="en">{entity.originalName}</span>}
  </div> : undefined;
  const legacyAnchors = english && withAnchor
    ? missingHeadingAnchors(entity.markdown, content.markdown, [anchor, content.headingId])
    : [];

  function kitBody() {
    const prose = (text: string) => <KitRuleBody text={text} sourceLocale={language} articleId={entity.source.articleId} headingOffset={nestedHeadingOffset} />;
    if (!english || !entity.englishSignatures?.length || !entities) return prose(content.markdown);
    const blocks: ReactNode[] = [];
    let offset = 0;
    for (const { ref, start, end } of entity.englishSignatures) {
      const signature = entities[ref];
      if (!signature) continue;
      blocks.push(<Fragment key={ref}>
        {prose(englishText!.slice(offset, start))}
        {withAnchor && <span id={headingId(signature.originalName ?? signature.name)} />}
        <RuleEntityView entity={signature} withAnchor={withAnchor} headingLevel={Math.min(6, headingLevel + 1)} />
      </Fragment>);
      offset = end;
    }
    const rest = englishText!.slice(offset).trim();
    return <>{blocks}{rest && prose(rest)}</>;
  }

  if (ability)
    return (
      <section
        className={`rule-entity rule-entity-${entity.kind}`}
        data-rule-entity={entity.id}
        data-kind={entity.kind}
        aria-labelledby={anchor}
        lang={english ? "en" : undefined}
      >
        {legacyAnchors}
        <article
          className="sheet-ability-card is-full"
          data-action={ability.actionType}
          data-kind={ability.kind}
          data-basic={ability.basic ? "true" : undefined}
          data-openable={openable ? "true" : undefined}
          role={openable ? "button" : undefined}
          tabIndex={openable ? 0 : undefined}
          aria-label={openable ? `${english ? "Open card" : "Открыть карточку"}: ${name}` : undefined}
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
              {name}
            </Heading>
            <AbilityTags language={language} view={ability} />
            {headingActions}
          </header>

          {ability.flavor && (
            <p className="rule-ability-flavor">{ability.flavor}</p>
          )}

          {trigger && (
            <p className="rule-ability-trigger">
              <strong className="rule-ability-trigger-label">{english ? "Trigger:" : "Триггер:"}</strong>{" "}
              <CharacteristicGlyphText language={language} text={trigger} />
            </p>
          )}
          <AbilityBody language={language} view={ability} full />
        </article>

        {edition
          ? <div className="rule-entity-extras"><EnglishAbilityRemainder blocks={edition.blocks} articleId={entity.source.articleId} /></div>
          : <RuleMarkdown text={english ? content.markdown : entity.markdown} sourceLocale={english ? "en" : undefined} articleId={entity.source.articleId}
              className="rule-text rule-entity-extras" headingOffset={nestedHeadingOffset}
              abilityCardRemainder={{ shownText: entity.ability?.effect }} />}

      </section>
    );

  return (
    <section
      className={`rule-entity rule-entity-${entity.kind}`}
      data-rule-entity={entity.id}
      data-kind={entity.kind}
      aria-labelledby={anchor}
      lang={english ? "en" : undefined}
    >
      {legacyAnchors}
      {!creatureSheet && <header
        className="rule-entity-head"
        id={withAnchor ? content.headingId || undefined : undefined}
      >
        <div className="rule-entity-title">
          <Heading className="rule-entity-name" id={anchor}>
            {name}
          </Heading>
          {content.label && <span className="rule-entity-type">{content.label}</span>}
          {!english && entity.director && entity.originalName && <span className="director-original-name" lang="en">{entity.originalName}</span>}
        </div>
        {headingActions}
      </header>}

      {art && hasMarkdown && (
        <ArtworkFigure
          art={art}
          className="codex-article-art rule-entity-art"
        />
      )}

      {!!entity.kitVariants?.length && <nav className="kit-rule-variants" aria-label={english ? "Stormwight kits" : "Комплекты буревестника"}>
        {entity.kitVariants.map((variant) => <a key={variant.id} href={`#/catalog/kits/${encodeURIComponent(variant.id)}`}>{english ? englishKitVariantName(variant) : variant.name}</a>)}
      </nav>}

      {hasMarkdown && entity.kind === "kit" ? (
        kitBody()
      ) : hasMarkdown ? (
        <RuleMarkdown
          text={content.markdown}
          articleId={entity.source.articleId}
          headingOffset={nestedHeadingOffset}
          sourceLocale={english ? "en" : undefined}
          printedCreature={printedCreature}
          omitFirstHeading={Boolean(content.headingId)}
          directorMode={directorMode}
          directorHeading={directorHeading}
          directorHeadingActions={headingActions}
          sharedAbilityCards={entity.kind === "perk"}
        />
      ) : (
        <p className="rule-entity-empty">
          {english ? "This source has no rule description." : "В источнике нет описания этого правила."}
        </p>
      )}
    </section>
  );
}
