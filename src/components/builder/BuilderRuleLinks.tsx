import { useState, type MouseEvent, type ReactNode } from "react";
import {
  catalogSectionEntries,
  resolveCatalogRoute,
} from "../../data/reference-catalog";
import { classLandingBySlug, codexIndex } from "../../rules/codex-navigation";
import { GLOSSARY } from "../../data/library";
import { CardDetailModal } from "../CardDetailModal";
import { RuleArticleReader } from "../rules/RuleArticleReader";
import { RuleMarkdown } from "../rules/RuleMarkdown";

type ReferenceTarget = {
  title: string;
  articleId?: string;
  text?: string;
  entityName?: string;
};

/** Ссылки внутри правил читаются поверх мастера, сохраняя текущий шаг. */
export function BuilderRuleLinks({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReferenceTarget | null>(null);
  const open = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    const href = link?.getAttribute("href");
    if (!link || !href?.startsWith("#/")) return;
    let parts: string[];
    try {
      parts = href.split("/").map(decodeURIComponent);
    } catch {
      return;
    }
    let next: ReferenceTarget | undefined;
    if (parts[1] === "codex") {
      const article = codexIndex.find((a) => a.id === parts[2]);
      if (article) next = { title: article.title, articleId: article.id };
    } else if (parts[1] === "reference" && parts[2] === "class") {
      const [slug, anchor] = (parts[3] ?? "").split("#");
      const landing = classLandingBySlug(slug);
      const level = Number(anchor?.replace("level-", "")) || 1;
      if (landing)
        next = {
          title: landing.name,
          articleId:
            landing.levelArticleIds[level - 1] ?? landing.levelArticleIds[0],
        };
    } else if (parts[1] === "catalog" || parts[1] === "glossary") {
      const { section, id } = resolveCatalogRoute(parts);
      const entry = catalogSectionEntries(section).find(
        (item) => item.id === id,
      );
      const term = GLOSSARY.find(
        (term) => term.id === (parts[1] === "glossary" ? parts[2] : id),
      );
      if (term) next = { title: term.name, text: term.markdown };
      else if (entry?.articleId)
        next = {
          title: entry.name,
          articleId: entry.articleId,
          entityName: entry.name,
        };
    }
    if (next) {
      event.preventDefault();
      event.stopPropagation();
      setTarget(next);
    } else {
      // Общие указатели на каталог не заменяют маршрут мастера.
      link.target = "_blank";
      link.rel = "noreferrer";
    }
  };
  return (
    <div onClickCapture={open}>
      {children}
      <CardDetailModal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.title ?? "Правила"}
        source="Справочник"
        wide
      >
        {target?.articleId ? (
          <RuleArticleReader
            key={target.articleId}
            articleId={target.articleId}
            entityName={target.entityName}
          />
        ) : target?.text ? (
          <RuleMarkdown text={target.text} />
        ) : null}
      </CardDetailModal>
    </div>
  );
}
