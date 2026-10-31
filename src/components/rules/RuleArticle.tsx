import type { RuleArticle, RuleEntity } from "../../rules/schema";
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
}: {
  article: RuleArticle;
  entities: Record<string, RuleEntity>;
}) {
  return (
    <div className="rule-article" data-rule-article={article.id}>
      {article.blocks.map((block, index) => {
        if (block.type === "markdown") {
          if (!block.text.trim()) return null;
          return (
            <RuleMarkdown
              key={`markdown-${index}`}
              text={block.text}
              articleId={article.id}
            />
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
        return <RuleEntityView key={`${block.ref}-${index}`} entity={entity} />;
      })}
    </div>
  );
}
