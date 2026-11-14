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

function RuleReferenceFallback({ reference }: { reference: string }) {
  return (
    <aside
      className="rule-reference-unresolved"
      data-entity-ref={reference}
      data-state="unresolved"
      role="note"
    >
      <span className="rule-reference-unresolved-label">
        Правило не загружено
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
  const leadIndex = article.blocks.findIndex((block) =>
    block.type === "markdown"
      ? block.text.trim().length > 0
      : Boolean(entities[block.ref]),
  );
  const creatureTabs = article.director?.section === "monsters" && article.director.recordType === "statblock";
  return (
    <div className="rule-article" data-rule-article={article.id}>
      {article.director && article.originalName && article.blocks[leadIndex]?.type === 'markdown' && <p className="director-original-name" lang="en">{article.originalName}</p>}
      {creatureTabs ? <CreatureTabs key={article.id} article={article} entities={entities} headingLevel={2 + headingOffset} headingActions={headingActions} /> : article.blocks.map((block, index) => {
        const isLead = index === leadIndex;
        if (block.type === "markdown") {
          if (!block.text.trim()) return null;
          if (!isLead || !art) {
            return (
              <RuleMarkdown
                key={`markdown-${index}`}
                text={block.text}
                articleId={article.id}
                headingOffset={headingOffset}
              />
            );
          }
          return (
            <div className="rule-article-lead" key={`markdown-${index}`}>
              <ArtworkFigure art={art} className="codex-article-art" />
              <RuleMarkdown
                text={block.text}
                articleId={article.id}
                headingOffset={headingOffset}
              />
            </div>
          );
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
            art={isLead ? art : undefined}
            onOpen={onOpenEntity ? () => onOpenEntity(entity) : undefined}
            headingLevel={2 + headingOffset + (article.chapter.startsWith("04.") && entity.kind === "feature" ? 1 : 0)}
            headingActions={isLead ? headingActions : undefined}
          />
        );
      })}
      {article.director?.recordType === 'monster' && <a className="catalog-source" href={`#/catalog/monsters/group:${article.director.groupSlug}`}>Все существа группы «{article.title}» <Icon name="arrow-right" size={16} /></a>}
      {!!article.related?.length && <section className="director-related">
        <h3>Связанные правила и существа · {article.related.length}</h3>
        <ul>{article.related.map(item => <li key={item.id}><a href={codexArticleHref(item.id)}>{item.title}</a></li>)}</ul>
      </section>}
      {article.director && article.originalId && <a className="catalog-source"
        href={`https://github.com/SteelCompendium/data-unified/blob/${article.director.sourceRevision}/en/books/monsters/md/${article.director.sourcePath.replace(/\.json$/, '.md')}`}
        target="_blank" rel="noreferrer">Источник · Draw Steel: Monsters (EN) ↗</a>}
    </div>
  );
}
