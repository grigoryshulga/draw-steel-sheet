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
}: {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
  art?: ArtAsset;
}) {
  const leadIndex = article.blocks.findIndex((block) =>
    block.type === "markdown"
      ? block.text.trim().length > 0
      : Boolean(entities[block.ref]),
  );
  return (
    <div className="rule-article" data-rule-article={article.id}>
      {article.blocks.map((block, index) => {
        const isLead = index === leadIndex;
        if (block.type === "markdown") {
          if (!block.text.trim()) return null;
          if (!isLead || !art) {
            return (
              <RuleMarkdown
                key={`markdown-${index}`}
                text={block.text}
                articleId={article.id}
              />
            );
          }
          return (
            <div className="rule-article-lead" key={`markdown-${index}`}>
              <ArtworkFigure art={art} className="codex-article-art" />
              <RuleMarkdown text={block.text} articleId={article.id} />
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
          />
        );
      })}
    </div>
  );
}
