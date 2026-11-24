import { articleBlocks } from "./article-blocks";
import { headingId } from "../../lib/codex";
import { useLocalizedData } from "../../i18n/use-localized-data";
import { loadEnglishArticleTitles } from "../../rules/repository";
import { Icon } from "../Icons";
import { CreatureTabs } from "./CreatureTabs";
import { codexArticleHref } from "../../rules/codex-navigation";
import type { ReactNode } from 'react';
import type { RuleArticle, RuleEntity } from "../../rules/schema";
import type { ArtAsset } from "../../lib/art";
import { ArtworkFigure } from "../Artwork";
import { RuleEntityView } from "./RuleEntity";
import { RuleMarkdown } from "./RuleMarkdown";
import "./RuleArticle.css";
import { useArticleLocale, useLocale } from "../../i18n/locale";

function RuleReferenceFallback({ reference }: { reference: string }) {
  const { t } = useLocale();
  return (
    <aside
      className="rule-reference-unresolved"
      data-entity-ref={reference}
      data-state="unresolved"
      role="note"
    >
      <span className="rule-reference-unresolved-label">
        {t("Правило не загружено", "Rule unavailable")}
      </span>
      <code>{reference}</code>
    </aside>
  );
}

/**
 * Содержимое канонической статьи: блоки Markdown и ссылки на сущности в том
 * порядке, в котором они записаны в источнике. Неразрешённая ссылка остаётся
 * видимой и не подменяется выдуманным текстом; повторный рендер детерминирован.
 */
export function RuleArticleContent({
  article,
  entities,
  art,
  onOpenEntity,
  headingOffset = 0,
  headingActions,
}: {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
  art?: ArtAsset;
  /** Клик по карточке сущности: используется страницей класса для поп-апа. */
  onOpenEntity?: (entity: RuleEntity) => void;
  /** Сдвиг заголовков статьи относительно её собственного заголовка. */
  headingOffset?: number;
  headingActions?: ReactNode;
}) {
  const { locale } = useLocale();
  const english = (useArticleLocale() ?? locale) === "en";
  const relatedTitles = useLocalizedData(english && article.related?.length ? "en" : "ru", loadEnglishArticleTitles);
  const edition = english ? article.englishEdition : undefined;
  const blocks = articleBlocks(article, entities, english);
  const leadIndex = blocks.findIndex(({ block }) => block.type === "markdown" ? Boolean(block.text.trim()) : Boolean(entities[block.ref]));
  const creatureTabs = article.director?.section === "monsters" && article.director.recordType === "statblock";
  return (
    <div className="rule-article" data-rule-article={article.id}>
      {edition && edition.kind !== "source" && <p className="muted small" role="note">{article.originalCoverage?.reason === "homebrew" ? "Campaign homebrew · English translation" : "Editorial material · English translation"}</p>}
      {english && !edition && article.originalCoverage?.status === "excerpt" && <p className="muted small" role="note">{article.originalCoverage.reason === "table-order-differs"
        ? "The English and Russian d100 tables list complications in different orders. Use the same edition when looking up a roll."
        : "English source · completeness unverified"}</p>}
      {!english && article.director && article.originalName && blocks[leadIndex]?.block.type === 'markdown' && <p className="director-original-name" lang="en">{article.originalName}</p>}
      {creatureTabs ? <CreatureTabs key={article.id} article={article} entities={entities} headingLevel={2 + headingOffset} headingActions={headingActions} /> : blocks.map(({ block, russianText }, index) => {
        const isLead = index === leadIndex;
        if (block.type === "markdown") {
          if (!block.text.trim()) return null;
          const englishIds = new Set([...block.text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => headingId(match[1])));
          const previousIds = new Set([...(russianText ?? "").matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => headingId(match[1])));
          const russianFallback = english && /[а-яё]/i.test(block.text) && !edition && !russianText;
          if (!(isLead && art) && !russianFallback && previousIds.size === 0) {
            return <RuleMarkdown key={`markdown-${index}`} text={block.text} sourceLocale={english ? "en" : "ru"} articleId={article.id} headingOffset={headingOffset} />;
          }
          return <div key={`markdown-${index}`} className={isLead && art ? "rule-article-lead" : undefined}>
            {[...previousIds].filter(id => id && !englishIds.has(id)).map(id => <span key={id} id={id} />)}
            {isLead && art && <ArtworkFigure art={art} className="codex-article-art" />}
            {russianFallback && <p className="muted small" lang="en">Russian source text</p>}
            <RuleMarkdown text={block.text} sourceLocale={english && !russianFallback ? "en" : "ru"} articleId={article.id} headingOffset={headingOffset} />
          </div>;
        }
        const entity = entities[block.ref];
        if (!entity) {
          return (
            <RuleReferenceFallback
              key={`unresolved-${index}-${block.ref}`}
              reference={block.ref}
            />
          );
        }
        return (
          <RuleEntityView
            key={`${block.ref}-${index}`}
            entity={entity}
            entities={entities}
            art={isLead ? art : undefined}
            onOpen={onOpenEntity ? () => onOpenEntity(entity) : undefined}
            headingLevel={2 + headingOffset + (article.chapter.startsWith("04.") && entity.kind === "feature" ? 1 : 0)}
            headingActions={isLead ? headingActions : undefined}
          />
        );
      })}
      {article.director?.recordType === 'monster' && <a className="catalog-source" href={`#/catalog/monsters/group:${article.director.groupSlug}`}>{english ? `All creatures in ${article.originalName || article.title}` : `Все существа группы «${article.title}»`} <Icon name="arrow-right" size={16} /></a>}
      {!!article.related?.length && <section className="director-related">
        <h3>{english ? "Related rules and creatures" : "Связанные правила и существа"} · {article.related.length}</h3>
        <ul>{article.related.map(item => <li key={item.id}><a href={codexArticleHref(item.id)}>{relatedTitles?.[item.id] || item.title}</a></li>)}</ul>
      </section>}
      {article.director && article.originalId && <a className="catalog-source"
        href={`https://github.com/SteelCompendium/data-unified/blob/${article.director.sourceRevision}/en/books/monsters/md/${article.director.sourcePath.replace(/\.json$/, '.md')}`}
        target="_blank" rel="noreferrer">{english ? "Source" : "Источник"} · Draw Steel: Monsters (EN) ↗</a>}
    </div>
  );
}
