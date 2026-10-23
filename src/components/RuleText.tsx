import Markdown from "react-markdown";
import { CATALOG, catalogEntryLink } from "../data/library";
import { remarkRuleFields } from "../lib/remark-rule-fields";
import { remarkRuleLinks } from "../lib/remark-rule-links";
import { remarkAbilityBlocks } from "../lib/remark-ability-blocks";
import "./AbilityPresentation.css";
import "./RuleText.css";
import remarkGfm from "remark-gfm";
import { Children, isValidElement, type ReactNode } from "react";
import { headingId } from "../lib/codex";

function plain(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? plain(child.props.children)
        : String(child),
    )
    .join("");
}
/** Markdown stays text/React nodes: source HTML is never injected into the page. */
export function RuleText({
  text,
  articleId,
}: {
  text: string;
  articleId?: string;
}) {
  return (
    <div className="rule-text">
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
                  (e) => e.articleId === articleId && e.heading === id,
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
          a: ({ href, children, className }) => (
            <a
              href={href}
              className={className}
              {...(href?.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
