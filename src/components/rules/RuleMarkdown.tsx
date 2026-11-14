import { Icon } from "../Icons";
import { remarkDirectorView, type DirectorView } from "../../lib/remark-director-view";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { memo, Children, isValidElement, type ReactNode } from "react";
import { catalogEntryLink } from "../../lib/library-utils";
import { CATALOG_LINK_BY_HEADING, GLOSSARY_TOOLTIP_BY_ID } from "../../rules/consumer-reading";
import { headingId } from "../../lib/codex";
import {
  remarkAbilityBlocks,
  remarkAbilityCardRemainder,
  type AbilityCardRemainderOptions,
} from "../../lib/remark-ability-blocks";
import { remarkRuleFields } from "../../lib/remark-rule-fields";
import { remarkRuleLinks } from "../../lib/remark-rule-links";
import { remarkDirectorBlocks } from "../../lib/remark-director-blocks";
import { remarkDirectorAbilities } from '../../lib/remark-director-abilities';
import { directorAbilityElement } from './DirectorAbilityCard';
import { DirectorStatBlock } from './DirectorStatBlock';
import './DirectorReference.css';
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
  /** Сдвиг уровней заголовков: вложенный текст не спорит с заголовком раздела. */
  headingOffset?: number;
  /** Compact creature identity, rendered inside its printed stat block. */
  directorHeading?: ReactNode;
  directorMode?: DirectorView;
  directorHeadingActions?: ReactNode;
  /** Embedded hero abilities use the same frame and facts as entity cards. */
  sharedAbilityCards?: boolean;
  /**
   * Текст уже показан полной карточкой способности: из источника берём только
   * «допблоки» (Поддержание, Потратить, Особое, списки и прозу), а не дубль
   * карточки. `{ shownText }` дополнительно отбрасывает допблоки, дословно
   * повторяющие показанный текст. Без пропа Markdown рендерится целиком.
   */
  abilityCardRemainder?: boolean | AbilityCardRemainderOptions;
}

export const headingTag = (level: number) =>
  `h${Math.min(6, Math.max(1, level))}` as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";

/**
 * Единый низкоуровневый рендер правилского Markdown.
 *
 * Здесь заканчивается цепочка зависимостей: компонент не знает ни о RuleText,
 * ни о RuleEntityView, поэтому сущности правил не могут рекурсивно вернуться
 * в этот рендер. Якоря заголовков, ссылки, вложенные списки, таблицы и заметки
 * сохраняются как в исходнике.
 */
export const RuleMarkdown = memo(function RuleMarkdown({
  text,
  articleId,
  className = "rule-text",
  headingOffset = 0,
  directorHeading,
  directorMode,
  directorHeadingActions,
  abilityCardRemainder = false,
  sharedAbilityCards = false,
}: RuleMarkdownProps) {
  const remainder =
    typeof abilityCardRemainder === "object"
      ? abilityCardRemainder
      : undefined;
  const plugins: PluggableList = abilityCardRemainder
    ? [
        remarkGfm,
        [remarkAbilityCardRemainder, remainder],
        remarkRuleFields,
        remarkRuleLinks,
      ]
    : [remarkGfm, remarkDirectorBlocks, articleId?.startsWith('monsters.') || sharedAbilityCards ? remarkDirectorAbilities : remarkAbilityBlocks, [remarkDirectorView, { mode: directorMode }], remarkRuleFields, remarkRuleLinks];
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={plugins}
        components={{
          section: ({ node, children, ...props }) => directorAbilityElement(node, children) ?? <section {...props}>{children}</section>,
          div: ({ node, children, ...props }) => node?.properties['data-director-stats']
            ? <DirectorStatBlock heading={directorHeading} headingActions={directorHeadingActions}>{children}</DirectorStatBlock>
            : directorAbilityElement(node, children) ?? <div {...props}>{children}</div>,
          h1: ({ children }) => {
            const Heading = headingTag(2 + headingOffset);
            return <Heading id={headingId(plain(children))}>{children}</Heading>;
          },
          h2: ({ children }) => {
            const Heading = headingTag(2 + headingOffset);
            return <Heading id={headingId(plain(children))}>{children}</Heading>;
          },
          h3: ({ children }) => {
            const Heading = headingTag(3 + headingOffset);
            return <Heading id={headingId(plain(children))}>{children}</Heading>;
          },
          h4: ({ children }) => {
            const id = headingId(plain(children));
            const Heading = headingTag(3 + headingOffset);
            const entry = articleId
              ? CATALOG_LINK_BY_HEADING.get(`${articleId}:${id}`)
              : undefined;
            return (
              <>
                <Heading id={id}>{children}</Heading>
                {entry && (
                  <a
                    className="rule-catalog-link"
                    href={catalogEntryLink(entry)}
                  >
                    Карточка в каталоге · Добавить герою <Icon name="arrow-right" size={16} />
                  </a>
                )}
              </>
            );
          },
          h5: ({ children }) => {
            const Heading = headingTag(4);
            return <Heading id={headingId(plain(children))}>{children}</Heading>;
          },
          h6: ({ children }) => {
            const Heading = headingTag(4);
            return <Heading id={headingId(plain(children))}>{children}</Heading>;
          },
          /* Горизонтальные линии из источника (`---`, `***`, `___`) — типографский
             мусор: разделы уже отделены заголовками и отступами. */
          hr: () => null,
          table: ({ children }) => (
            <div className="rule-table">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children, className: linkClassName }) => {
            const glossaryPrefix = href?.startsWith("#/catalog/glossary/")
              ? "#/catalog/glossary/"
              : href?.startsWith("#/glossary/")
                ? "#/glossary/"
                : "";
            const term = glossaryPrefix
              ? GLOSSARY_TOOLTIP_BY_ID.get(decodeURIComponent(href!.slice(glossaryPrefix.length)))
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
                    {term.summary}…
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
});
