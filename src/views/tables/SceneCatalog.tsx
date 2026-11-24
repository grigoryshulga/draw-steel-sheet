import { useLocale } from "../../i18n/locale";
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

const CATALOG = {
  monster: { section: "monsters", list: "Противники из справочника", add: "Добавить в сражение" },
  terrain: { section: "terrain", list: "Местность из справочника", add: "Добавить осложнение" },
  retainer: { section: "retainers", list: "Помощники из справочника", add: "Добавить спутника" },
} as const;

/** The same article/statblock renderer as the reference, with table actions. */
export function SceneCatalog({ kind, onAdd, actionHost, forecast, busy = false }: {
  kind: keyof typeof CATALOG;
  onAdd: (seed: MonsterSeed) => void | Promise<boolean>;
  actionHost?: HTMLDivElement | null;
  forecast?: (seed: Omit<MonsterSeed, "maxStamina">) => { cost: number; hardMax: number } | null;
  busy?: boolean;
}) {
  const { t: tr, locale } = useLocale();
  const catalog = CATALOG[kind];
  const listLabel = { monster: tr("Противники из справочника", "Creatures from reference"), terrain: tr("Местность из справочника", "Terrain from reference"), retainer: tr("Помощники из справочника", "Retainers from reference") }[kind];
  const addLabel = { monster: tr("Добавить в сражение", "Add to encounter"), terrain: tr("Добавить осложнение", "Add complication"), retainer: tr("Добавить спутника", "Add companion") }[kind];
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
  const entries = catalogSectionEntries(catalog.section).filter((e) => seedIds.has(e.articleId ?? e.id));
  const displayName = (seed: Omit<MonsterSeed, "maxStamina">) => locale === "en" ? entries.find(entry => (entry.articleId ?? entry.id) === seed.sourceId)?.originalName || seed.name : seed.name;
  const matchingIds = new Set(entries.filter((e) => matchesDirectorFilters(e, deferredFilters)).map((e) => e.articleId ?? e.id));
  const results = all.filter((s) => matchingIds.has(s.sourceId));
  const pages = Math.max(1, Math.ceil(results.length / 10));
  const current = Math.min(page, pages - 1);
  const shown = results.slice(current * 10, (current + 1) * 10);
  const active = shown.find((s) => s.sourceId === selected) ?? shown[0];
  const projected = active ? forecast?.(active) : null;
  const reset = () => { setPage(0); setSelected(""); setPreviewOpen(false); };
  const addEntry = async (id: string) => {
    if (loading || busy) return;
    setLoading(true); setError(""); setFailedId(""); setAdded("");
    try {
      const seed = await loadMonsterSeed(id);
      if (await onAdd(seed) !== false) setAdded(`${tr("Добавлено", "Added")}: ${displayName(seed)}`);
    }
    catch {
      const name = all.find((entry) => entry.sourceId === id)?.name ?? tr("запись", "entry");
      setError(tr(`Не удалось добавить «${name}». Проверьте соединение и повторите попытку.`, `Could not add “${name}”. Check your connection and try again.`));
      setFailedId(id);
    }
    finally { setLoading(false); }
  };
  const feedback = <Toasts toasts={added ? [{ id: 1, message: added, tone: "success" }] : []} onDismiss={() => setAdded("")} />;
  return <div className="scene-catalog" data-preview={narrow && previewOpen || undefined}>
    <div className="scene-catalog-filter-area" hidden={narrow && previewOpen}>
      <DirectorFilters compact={narrow} entries={entries} value={filters} onChange={(next) => { setFilters(next); reset(); }} />
    </div>
    {error && <div className="scene-catalog-error" role="alert"><p>{error}</p><Button size="sm" icon="refresh" disabled={loading} onClick={() => void addEntry(failedId)}>{tr("Повторить", "Retry")}</Button><Button size="sm" onClick={() => { setError(""); setFailedId(""); }}>{tr("Закрыть сообщение", "Dismiss message")}</Button></div>}
    {actionHost ? createPortal(feedback, actionHost) : feedback}
    {active ? <div className="scene-catalog-browser">
      <div className="scene-catalog-list" hidden={narrow && previewOpen}>
        <nav ref={listFade.ref} className={`scroll-fade${listFade.more ? " has-more" : ""}`} tabIndex={0} aria-label={listLabel}>
          {shown.map((s) => <div className="scene-catalog-choice" data-selected={active.sourceId === s.sourceId || undefined} key={s.sourceId}>
            <button type="button" aria-current={active.sourceId === s.sourceId ? "true" : undefined} onClick={() => { setSelected(s.sourceId); setPreviewOpen(true); }}><strong>{displayName(s)}</strong><span>{tr(`${s.level} ур.`, `Level ${s.level}`)}{kind !== "retainer" && ` · ${s.encounterValue} ${tr("БЦ", "EV")}`}{s.role ? ` · ${s.role}` : ""}</span></button>
            <Button size="sm" variant="ghost" icon="plus" iconOnly disabled={loading || busy} aria-label={`${tr("Добавить", "Add")}: ${displayName(s)}`} title={`${tr("Добавить", "Add")}: ${displayName(s)}`} onClick={() => void addEntry(s.sourceId)}>{tr("Добавить", "Add")}</Button>
          </div>)}
        </nav>
        {pages > 1 && <div className="scene-catalog-pages">
          <Button iconOnly icon="chevron-left" size="sm" disabled={!current} onClick={() => { setPage(current - 1); setSelected(""); }}>{tr("Предыдущая страница", "Previous page")}</Button><span>{current + 1} / {pages}</span><Button iconOnly icon="chevron-right" size="sm" disabled={current + 1 === pages} onClick={() => { setPage(current + 1); setSelected(""); }}>{tr("Следующая страница", "Next page")}</Button>
        </div>}
      </div>
      <div className="scene-catalog-preview" hidden={narrow && !previewOpen}>
        {narrow && <div className="scene-catalog-preview-heading"><Button icon="arrow-left" onClick={() => { setPreviewOpen(false); requestAnimationFrame(() => listFade.ref.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus()); }}>{tr("К списку", "Back to list")}</Button><h3 className="sr-only" ref={previewHeading} tabIndex={-1}>{displayName(active)}</h3></div>}

        <RuleArticleReader key={active.sourceId} articleId={active.sourceId} />
        {actionHost && createPortal(<div className="scene-catalog-add"><span className="scene-catalog-selected">{tr("Выбрано", "Selected")}: <strong>{displayName(active)}</strong></span>{projected && <span className="scene-catalog-forecast" data-over-budget={projected.cost > projected.hardMax || undefined}>{tr("После добавления", "After adding")}: {projected.cost} {tr("БЦ", "EV")}{projected.cost > projected.hardMax ? ` · ${tr("Превышение лимита", "Over limit")}: ${projected.cost - projected.hardMax} ${tr("БЦ", "EV")}` : ""}</span>}<Button icon="plus" variant="primary" disabled={loading || busy} aria-label={`${addLabel}: ${displayName(active)}`} onClick={() => void addEntry(active.sourceId)}>{loading ? tr("Добавляем…", "Adding…") : addLabel}</Button></div>, actionHost)}
      </div>
    </div> : <p className="table-empty">{tr("Ничего не найдено. Измените запрос или фильтры.", "Nothing found. Change the search or filters.")}</p>}
  </div>;
}
