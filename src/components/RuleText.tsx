import Markdown from "react-markdown";
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
export function RuleText({ text }: { text: string }) {
  return (
    <div className="rule-text">
      <Markdown
        remarkPlugins={[remarkGfm, remarkAbilityBlocks]}
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
          h4: ({ children }) => (
            <h3 id={headingId(plain(children))}>{children}</h3>
          ),
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
          a: ({ href, children }) => (
            <a
              href={href}
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
