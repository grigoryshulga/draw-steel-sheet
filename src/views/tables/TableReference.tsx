import { useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { Button } from "../../components/ui";
import { RuleArticleReader } from "../../components/rules/RuleArticleReader";
import { readCodexLocation } from "../../lib/codex";
import { LibraryLocationContext } from "../../lib/library-location";
import { CatalogView } from "../CatalogView";

export function TableReference({ scrollRoot }: { scrollRoot: RefObject<HTMLElement | null> }) {
  const [catalogHash, setCatalogHash] = useState("#/reference/");
  const [articleId, setArticleId] = useState("");
  const previousScroll = useRef(0);
  const articleSource = useRef<HTMLAnchorElement | null>(null);
  const reading = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (articleId) {
      scrollRoot.current?.scrollTo({ top: 0 });
      reading.current?.focus({ preventScroll: true });
    }
  }, [articleId, scrollRoot]);

  const navigateCatalog = (href: string) => {
    setArticleId("");
    setCatalogHash(href.replace(/^#\/reference\/class\//, "#/catalog/classes/"));
    scrollRoot.current?.scrollTo({ top: 0 });
  };

  const followLink = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href^='#']");
    if (!anchor) return;
    const hash = anchor.hash;
    event.preventDefault();
    if (!hash.startsWith("#/")) {
      try {
        event.currentTarget.querySelector(`#${CSS.escape(decodeURIComponent(hash.slice(1)))}`)
          ?.scrollIntoView({ block: "start" });
      } catch {
        // A malformed fragment has no local destination.
      }
      return;
    }
    if (/^#\/(reference|catalog|glossary)(\/|$)/.test(hash)) {
      navigateCatalog(hash);
      return;
    }
    const nextArticle = hash.startsWith("#/codex/") ? readCodexLocation(hash).articleId : "";
    if (nextArticle) {
      if (!articleId) {
        previousScroll.current = scrollRoot.current?.scrollTop ?? 0;
        articleSource.current = anchor;
      }
      setArticleId(nextArticle);
    } else {
      window.open(anchor.href, "_blank", "noopener");
    }
  };

  return <section className="table-reference" onClick={followLink}>
    <div hidden={!!articleId}>
      <h2>Справочник</h2>
      <LibraryLocationContext.Provider value={catalogHash}>
        <CatalogView embedded={{ navigate: navigateCatalog, scrollRoot }} />
      </LibraryLocationContext.Provider>
    </div>
    {articleId && <section className="table-reference-article" ref={reading} tabIndex={-1}>
      <Button size="sm" icon="arrow-left" variant="ghost" onClick={() => {
        setArticleId("");
        requestAnimationFrame(() => {
          scrollRoot.current?.scrollTo({ top: previousScroll.current });
          articleSource.current?.focus({ preventScroll: true });
        });
      }}>К справочнику</Button>
      <RuleArticleReader articleId={articleId} />
    </section>}
  </section>;
}
