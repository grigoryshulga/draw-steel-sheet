import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../../lib/hooks";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui";
import { RuleArticleReader } from "../../components/rules/RuleArticleReader";
import { loadMonsterSeed, searchMonsterSeeds, type MonsterSeed } from "../../lib/tables/monster-catalog";

import { useScrollFade } from "../../components/useScrollFade";
import { Toasts } from "../../components/Toasts";
import { DirectorFilters } from "../../components/rules/DirectorFilters";
import { catalogSectionEntries } from "../../data/reference-catalog";
import { emptyDirectorFilters, matchesDirectorFilters } from "../../lib/director-catalog";

/** The same article/statblock renderer as the reference, with encounter actions. */
export function SceneCatalog({ kind, onAdd, actionHost, forecast }: { kind: "monster" | "terrain"; onAdd: (seed: MonsterSeed) => void; actionHost?: HTMLDivElement | null; forecast?: (seed: Omit<MonsterSeed, "maxStamina">) => { cost: number; hardMax: number } | null }) {
  const listFade = useScrollFade();
  const narrow = useMediaQuery("(max-width: 800px)");
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (narrow && previewOpen) previewHeading.current?.focus(); }, [narrow, previewOpen]);
  const [filters, setFilters] = useState(emptyDirectorFilters);
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState("");
  const [error, setError] = useState("");
  const [failedId, setFailedId] = useState("");
  useEffect(() => { if (!added) return; const timer = window.setTimeout(() => setAdded(""), 3000); return () => window.clearTimeout(timer); }, [added]);
  const deferredFilters = useDeferredValue(filters);
  const all = searchMonsterSeeds("", { kind });
  const seedIds = new Set(all.map((s) => s.sourceId));
  const entries = catalogSectionEntries(kind === "monster" ? "monsters" : "terrain").filter((e) => seedIds.has(e.articleId ?? e.id));
  const matchingIds = new Set(entries.filter((e) => matchesDirectorFilters(e, deferredFilters)).map((e) => e.articleId ?? e.id));
  const results = all.filter((s) => matchingIds.has(s.sourceId));
  const pages = Math.max(1, Math.ceil(results.length / 10));
  const current = Math.min(page, pages - 1);
  const shown = results.slice(current * 10, (current + 1) * 10);
  const active = shown.find((s) => s.sourceId === selected) ?? shown[0];
  const projected = active ? forecast?.(active) : null;
  const reset = () => { setPage(0); setSelected(""); setPreviewOpen(false); };
  const addEntry = async (id: string) => {
    setLoading(true); setError(""); setFailedId(""); setAdded("");
    try { const seed = await loadMonsterSeed(id); if (!seed) throw new Error(); onAdd(seed); setAdded(`Добавлено: ${seed.name}`); }
    catch {
      const name = all.find((entry) => entry.sourceId === id)?.name ?? "запись";
      setError(`Не удалось добавить «${name}». Проверьте соединение и повторите попытку.`);
      setFailedId(id);
    }
    finally { setLoading(false); }
  };
  const feedback = <Toasts toasts={added ? [{ id: 1, message: added, tone: "success" }] : []} onDismiss={() => setAdded("")} />;
  return <div className="scene-catalog" data-preview={narrow && previewOpen || undefined}>
    <div className="scene-catalog-filter-area" hidden={narrow && previewOpen}>
      <DirectorFilters compact={narrow} entries={entries} value={filters} onChange={(next) => { setFilters(next); reset(); }} />
    </div>
    {error && <div className="scene-catalog-error" role="alert"><p>{error}</p><Button size="sm" icon="refresh" disabled={loading} onClick={() => void addEntry(failedId)}>Повторить</Button><Button size="sm" onClick={() => { setError(""); setFailedId(""); }}>Закрыть сообщение</Button></div>}
    {actionHost ? createPortal(feedback, actionHost) : feedback}
    {active ? <div className="scene-catalog-browser">
      <div className="scene-catalog-list" hidden={narrow && previewOpen}>
        <nav ref={listFade.ref} className={`scroll-fade${listFade.more ? " has-more" : ""}`} tabIndex={0} aria-label={kind === "monster" ? "Противники из справочника" : "Местность из справочника"}>
          {shown.map((s) => <div className="scene-catalog-choice" data-selected={active.sourceId === s.sourceId || undefined} key={s.sourceId}>
            <button type="button" aria-current={active.sourceId === s.sourceId ? "true" : undefined} onClick={() => { setSelected(s.sourceId); setPreviewOpen(true); }}><strong>{s.name}</strong><span>{s.level} ур. · {s.encounterValue} БЦ{s.role ? ` · ${s.role}` : ""}</span></button>
            <Button size="sm" variant="ghost" icon="plus" iconOnly disabled={loading} aria-label={`Добавить: ${s.name}`} title={`Добавить: ${s.name}`} onClick={() => void addEntry(s.sourceId)}>Добавить</Button>
          </div>)}
        </nav>
        {pages > 1 && <div className="scene-catalog-pages">
          <Button iconOnly icon="chevron-left" size="sm" disabled={!current} onClick={() => { setPage(current - 1); setSelected(""); }}>Предыдущая страница</Button><span>{current + 1} / {pages}</span><Button iconOnly icon="chevron-right" size="sm" disabled={current + 1 === pages} onClick={() => { setPage(current + 1); setSelected(""); }}>Следующая страница</Button>
        </div>}
      </div>
      <div className="scene-catalog-preview" hidden={narrow && !previewOpen}>
        {narrow && <div className="scene-catalog-preview-heading"><Button icon="arrow-left" onClick={() => { setPreviewOpen(false); requestAnimationFrame(() => listFade.ref.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus()); }}>К списку</Button><h3 className="sr-only" ref={previewHeading} tabIndex={-1}>{active.name}</h3></div>}

        <RuleArticleReader key={active.sourceId} articleId={active.sourceId} />
        {actionHost && createPortal(<div className="scene-catalog-add"><span className="scene-catalog-selected">Выбрано: <strong>{active.name}</strong></span>{projected && <span className="scene-catalog-forecast" data-over-budget={projected.cost > projected.hardMax || undefined}>После добавления: {projected.cost} БЦ{projected.cost > projected.hardMax ? ` · Превышение лимита: ${projected.cost - projected.hardMax} БЦ` : ""}</span>}<Button icon="plus" variant="primary" disabled={loading} aria-label={`${kind === "monster" ? "Добавить в сражение" : "Добавить осложнение"}: ${active.name}`} onClick={() => void addEntry(active.sourceId)}>{loading ? "Добавляем…" : kind === "monster" ? "Добавить в сражение" : "Добавить осложнение"}</Button></div>, actionHost)}
      </div>
    </div> : <p className="table-empty">Ничего не найдено. Измените запрос или фильтры.</p>}
  </div>;
}
