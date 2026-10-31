import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, isValidElement, type ReactNode } from "react";
import {
  CATALOG,
  GLOSSARY,
  catalogEntryLink,
  plainSummary,
} from "../../data/library";
import { headingId } from "../../lib/codex";
import { remarkAbilityBlocks } from "../../lib/remark-ability-blocks";
import { remarkRuleFields } from "../../lib/remark-rule-fields";
import { remarkRuleLinks } from "../../lib/remark-rule-links";
import "../AbilityPresentation.css";
import "../RuleText.css";

function plain(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? plain(child.props.children)
        : String(child),
    )
    .join("");
}

export interface RuleMarkdownProps {
  text: string;
  /** Статья источника: по ней подбирается ссылка «Карточка в каталоге». */
  articleId?: string;
  className?: string;
}

/**
 * Единый низкоуровневый рендер правилского Markdown.
 *
 * Здесь заканчивается цепочка зависимостей: компонент не знает ни о RuleText,
 * ни о RuleEntityView, поэтому сущности правил не могут рекурсивно вернуться
 * в этот рендер. Якоря заголовков, ссылки, вложенные списки, таблицы и заметки
 * сохраняются как в исходнике.
 */
export function RuleMarkdown({
  text,
  articleId,
  className = "rule-text",
}: RuleMarkdownProps) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[
          remarkGfm,
          remarkAbilityBlocks,
          remarkRuleFields,
          remarkRuleLinks,
        ]}
        components={{
          h1: ({ children }) => (
            <h2 id={headingId(plain(children))}>{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 id={headingId(plain(children))}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 id={headingId(plain(children))}>{children}</h3>
          ),
          h4: ({ children }) => {
            const id = headingId(plain(children));
            const entry = articleId
              ? CATALOG.find(
                  (candidate) =>
                    candidate.articleId === articleId &&
                    candidate.heading === id,
                )
              : undefined;
            return (
              <>
                <h3 id={id}>{children}</h3>
                {entry && (
                  <a
                    className="rule-catalog-link"
                    href={catalogEntryLink(entry)}
                  >
                    Карточка в каталоге · Добавить герою →
                  </a>
                )}
              </>
            );
          },
          h5: ({ children }) => (
            <h4 id={headingId(plain(children))}>{children}</h4>
          ),
          h6: ({ children }) => (
            <h4 id={headingId(plain(children))}>{children}</h4>
          ),
          table: ({ children }) => (
            <div className="rule-table">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children, className: linkClassName }) => {
            const term = href?.startsWith("#/glossary/")
              ? GLOSSARY.find(
                  (candidate) =>
                    candidate.id === decodeURIComponent(href.slice(11)),
                )
              : undefined;
            if (term)
              return (
                <a
                  href={href}
                  className={`${linkClassName ?? ""} has-tip`}
                >
                  {children}
                  <span className="rule-tip" role="tooltip">
                    <strong>
                      {term.name}
                      {term.english && <em> · {term.english}</em>}
                    </strong>
                    {plainSummary(term.markdown)}…
                  </span>
                </a>
              );
            return (
              <a
                href={href}
                className={linkClassName}
                {...(href?.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
