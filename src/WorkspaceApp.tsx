import {
  Activity,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BootError, LoadingScreen } from "./components/Topbar";
import { FloatingHeader } from "./components/FloatingHeader";
import { Toasts, type ToastMessage } from "./components/Toasts";
import { Button, Modal } from "./components/ui";
import { WelcomeView } from "./views/WelcomeView";
import {
  createGameSession,
  type GameAction,
  type GameHistoryEntry,
} from "./lib/game-actions";
import { useHashTab } from "./lib/hooks";
import {
  applyTheme,
  THEMES,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ThemeChoice,
} from "./lib/theme";
import {
  HERO_TABS,
  TABS,
  TAB_LABELS,
  isHeroTab,
  type HeroTab,
  type Tab,
} from "./navigation";
import { makeId } from "./data/templates";
import { AppContext } from "./state/AppContext";
import type { AppTheme } from "./types";
import { deriveStats } from "./lib/rules";
import { createRollEntry, type RollConfig, type RollEntry } from "./lib/roll";
import { RollDialog } from "./views/sheet/RollDialog";
import "./components/BuilderPage.css";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import { useHeroLifecycle } from "./state/useHeroLifecycle";
import "./styles/workspace.css";
import { PersistenceStatus } from "./components/PersistenceStatus";
import { supabaseEnabled } from "./lib/supabase";
import { belongsToTableCombat } from "./lib/tables/combat";
import { useTables } from "./state/useTables";
import { useTableCombatSync } from "./state/useTableCombatSync";

const TablesView = lazy(() =>
  import("./views/TablesView").then((module) => ({
    default: module.TablesView,
  })),
);
const TableOfferInbox = lazy(() =>
  import("./views/tables/TableOfferInbox").then((module) => ({
    default: module.TableOfferInbox,
  })),
);

const HistoryDialog = lazy(() =>
  import("./views/sheet/HistoryDialog").then((module) => ({
    default: module.HistoryDialog,
  })),
);
const SheetView = lazy(() =>
  import("./views/SheetView").then((module) => ({ default: module.SheetView })),
);
const SettingsView = lazy(() =>
  import("./views/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);
const CodexView = lazy(() =>
  import("./views/CodexView").then((module) => ({ default: module.CodexView })),
);
const ReferenceView = lazy(() =>
  import("./views/ReferenceView").then((module) => ({
    default: module.ReferenceView,
  })),
);
const NewCharacterDialog = lazy(() =>
  import("./components/NewCharacterDialog").then((module) => ({
    default: module.NewCharacterDialog,
  })),
);

export default function WorkspaceApp({
  beforeSignOut,
}: {
  beforeSignOut: { current: () => Promise<void> };
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [themeChoice, setThemeChoiceState] =
    useState<ThemeChoice>(readThemeChoice);
  const [tab, setTab] = useHashTab("sheet", TABS);
  const [hasOpenedTables, setHasOpenedTables] = useState(tab === "tables");
  useEffect(() => {
    if (tab === "tables") setHasOpenedTables(true);
  }, [tab]);
  const tables = useTables(tab === "tables");
  const [tableSheet, setTableSheet] = useState<{ tableId: string; heroId: string; tab: HeroTab } | null>(null);
  const tableSheetFocus = useRef<HTMLElement | null>(null);
  const tableSheetDirty = useRef(false);
  const trackTableSheetDraft = useCallback((dirty: boolean) => { tableSheetDirty.current = dirty; }, []);
  const openTableSheet = tab === "tables" && tableSheet?.tableId === tables.selected ? tableSheet : null;
  const lastNonCreateTab = useRef<Tab>("sheet");
  const [rollOpen, setRollOpen] = useState(false);
  const [lastRoll, setLastRoll] = useState<RollEntry | null>(null);
  const [rollLog, setRollLog] = useState<RollEntry[]>([]);
  const gameSession = useMemo(createGameSession, []);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const nextRollId = useRef(0);

  const notify = useCallback(
    (message: string, tone: "info" | "success" | "error" = "info") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, tone }].slice(-2));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4200);
    },
    [],
  );

  const resetRollSession = useCallback(() => {
    setRollOpen(false);
    setLastRoll(null);
    setRollLog([]);
  }, []);

  const {
    characters,
    character,
    characterRef,
    booting,
    bootError,
    saveStatus,
    saveError,
    changingCharacter,
    autosave,
    update,
    patch,
    isTransitioning,
    handleSelectCharacter,
    handleCreate,
    handleDuplicate,
    handleDelete,
    handleExport,
    handleImport,
    refreshCharacter,
    persistence,
    retryPersistence,
    resolveConflict,
    downloadRecovery,
    allowSignOutWithPending,
  } = useHeroLifecycle({
    notify,
    navigate: setTab,
    onActivate: () => {
      resetRollSession();
      gameSession.reset();
      setGameHistory([]);
    },
    beforeSignOut,
  });
  useTableCombatSync(character, update, tables, changingCharacter);

  useEffect(() => {
    if (tableSheet && !openTableSheet) {
      setTableSheet(null);
      setRollOpen(false);
    }
  }, [tableSheet, openTableSheet]);

  const openTableHero = (heroId: string) => {
    if (!tables.selected) return;
    const focused = document.activeElement;
    tableSheetFocus.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
    tableSheetDirty.current = false;
    const sheet = { tableId: tables.selected, heroId, tab: "sheet" as const };
    setTableSheet(sheet);
    void handleSelectCharacter(heroId).then(() => {
      if (characterRef.current?.id !== heroId) setTableSheet(current => current === sheet ? null : current);
    });
  };

  const closeTableHero = () => {
    if (tableSheetDirty.current &&
        !window.confirm("В «Развитии» есть несохранённые выборы. Закрыть лист без их сохранения?")) return;
    const previous = tableSheetFocus.current;
    setTableSheet(null);
    setRollOpen(false);
    requestAnimationFrame(() => {
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>(".table-live-board:not([hidden]) .board-stage");
      target?.focus({ preventScroll: true });
    });
  };

  const performRoll = useCallback(
    (config: RollConfig) => {
      const doc = characterRef.current;
      if (!doc) return;
      const entry = createRollEntry(doc, config, nextRollId.current++);
      setLastRoll(entry);
      setRollLog((prev) => [entry, ...prev].slice(0, 5));
    },
    [characterRef],
  );

  const performGameAction = useCallback(
    (action: GameAction, operationId = makeId()) => {
      const current = characterRef.current;
      if (!current || isTransitioning()) return false;
      if (current.runtime?.tableCombat && belongsToTableCombat(action)) return false;
      const result = gameSession.perform(current, action, operationId);
      if (!result.ok) {
        notify(result.reason, "error");
        return false;
      }
      update(() => result.next);
      setGameHistory(gameSession.entries());
      notify(result.label, "success");
      return true;
    },
    [characterRef, gameSession, isTransitioning, notify, update],
  );

  const undoGameAction = useCallback(() => {
    const current = characterRef.current;
    if (!current || isTransitioning()) return;
    const result = gameSession.undo(current);
    if (!result.ok) {
      notify(result.reason, "error");
      return;
    }
    update(() => result.next);
    setGameHistory(gameSession.entries());
    notify(result.label);
  }, [characterRef, gameSession, isTransitioning, notify, update]);

  useEffect(() => {
    const label = TAB_LABELS[tab as Tab];
    document.title =
      tab === "create"
        ? "Создание героя — Достать листы!"
        : `${character ? `${character.name} · ` : ""}${label} — Достать листы!`;
    if (tab !== "codex" && tab !== "tables") window.scrollTo({ top: 0 });
  }, [tab, character?.id, character?.name]);

  useEffect(() => {
    if (tab !== "create") lastNonCreateTab.current = tab as Tab;
    if (tab === "tables") setHasOpenedTables(true);
  }, [tab]);

  /* ---------- Тема оформления ---------- */

  const activeTheme = useMemo<AppTheme>(
    () => resolveTheme(THEMES, themeChoice),
    [themeChoice],
  );

  useEffect(() => {
    if (activeTheme) applyTheme(activeTheme);
  }, [activeTheme]);

  const handleThemeChoice = (choice: ThemeChoice) => {
    setThemeChoiceState(choice);
    writeThemeChoice(choice);
    applyTheme(resolveTheme(THEMES, choice));
  };

  const derived = useMemo(
    () => (character ? deriveStats(character) : null),
    [character],
  );
  const isLibrary = ["codex", "reference", "catalog", "glossary"].includes(tab);
  const exportActiveHero = character
    ? () => void handleExport(character.id)
    : undefined;

  /* ---------- Рендер ---------- */

  if (bootError && !isLibrary && tab !== "tables") {
    return <BootError message={bootError} />;
  }

  const closeBuilder = () => setTab(lastNonCreateTab.current);

  if (tab === "create") {
    if (booting) {
      return (
        <main className="builder-page builder-page-loading" id="main-content">
          <LoadingScreen label="Загрузка конструктора" />
        </main>
      );
    }
    return (
      <>
        <main className="builder-page" id="main-content" tabIndex={-1}>
          <ViewErrorBoundary onClose={closeBuilder}>
            <Suspense
              fallback={
                <div className="builder-page-loading">
                  <LoadingScreen label="Загрузка конструктора" />
                </div>
              }
            >
              <NewCharacterDialog
                onClose={closeBuilder}
                onCreate={handleCreate}
              />
            </Suspense>
          </ViewErrorBoundary>
        </main>
        <Toasts
          toasts={toasts}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter((toast) => toast.id !== id))
          }
        />
      </>
    );
  }

  const contextValue =
    character && derived
      ? {
          character,
          derived,
          update,
          patch,
          performGameAction,
          undoGameAction,
          gameHistory,
          saveStatus,
          saveError,
          notify,
          goTo: (next: string) => setTab(next),
        }
      : null;

  const sheetTools = (
    <Suspense fallback={null}>
      <HistoryDialog />
      <RollDialog open={rollOpen}
        onToggle={() => setRollOpen(open => !open)}
        onClose={() => setRollOpen(false)}
        onRoll={performRoll} lastRoll={lastRoll} log={rollLog} />
    </Suspense>
  );
  const persistenceControls = <>
    <PersistenceStatus state={persistence} retry={retryPersistence}
      resolve={resolveConflict} download={downloadRecovery} allowSignOut={allowSignOutWithPending} />
    {character && saveStatus === "error" && !persistence.pendingCount && !persistence.localError && (
      <section className="save-error-banner" role="alert">
        <div>
          <strong>Изменения не сохранены</strong>
          <p>Они остаются в открытом листе. Повторите сохранение или скачайте копию перед закрытием страницы.</p>
          {saveError && <p className="small muted">{saveError}</p>}
        </div>
        <div className="hstack wrap">
          <Button icon="refresh" iconOnly onClick={() => void autosave.flush().catch(() => undefined)}>
            Повторить сохранение
          </Button>
          <Button icon="download" iconOnly onClick={() => void handleExport(character.id)}>
            Скачать копию
          </Button>
        </div>
      </section>
    )}
  </>;

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <FloatingHeader
        tab={tab as Tab}
        character={character}
        characters={characters}
        saveStatus={saveStatus}
        saveError={saveError}
        onSelectCharacter={(id) => void handleSelectCharacter(id)}
        onNewCharacter={() => setTab("create")}
        onNavigate={(next) => setTab(next)}
      />
      <div className="app">
        <div className="main workspace-main" aria-busy={changingCharacter}>
          {changingCharacter && !openTableSheet && (
            <div className="workspace-progress" role="status">
              Сохраняем и открываем героя…
            </div>
          )}
          <div inert={changingCharacter || !!openTableSheet}>
            {supabaseEnabled && (
              <Suspense fallback={null}>
                <TableOfferInbox
                  beforeAnswer={() => autosave.flush()}
                  afterAnswer={refreshCharacter}
                />
              </Suspense>
            )}
            {!openTableSheet && persistenceControls}
            <main className="content" id="main-content" tabIndex={-1}>
              {(tab === "tables" || hasOpenedTables) && (
                <Activity mode={tab === "tables" ? "visible" : "hidden"}>
                  <ViewErrorBoundary onExport={exportActiveHero}>
                    <Suspense
                      fallback={<LoadingScreen label="Загрузка столов" />}
                    >
                      <TablesView
                        state={tables}
                        characters={characters}
                        beforeCommand={() => autosave.flush()}
                        openHero={openTableHero}
                        refreshHero={refreshCharacter}
                      />
                    </Suspense>
                  </ViewErrorBoundary>
                </Activity>
              )}
              <ViewErrorBoundary
                key={`${character?.id ?? "empty"}:${tab}`}
                onExport={exportActiveHero}
              >
                {tab === "tables" ? null : booting && !isLibrary ? (
                  <LoadingScreen label="Загрузка листа" />
                ) : isLibrary ? (
                  <Suspense
                    fallback={<LoadingScreen label="Загрузка библиотеки" />}
                  >
                    <AppContext.Provider value={contextValue}>
                      {tab === "codex" ? <CodexView /> : <ReferenceView />}
                    </AppContext.Provider>
                  </Suspense>
                ) : !character || !contextValue ? (
                  <WelcomeView
                    onCreate={() => setTab("create")}
                    onImport={handleImport}
                    onOpenCodex={() => setTab("codex")}
                    busy={changingCharacter}
                  />
                ) : (
                  <AppContext.Provider key={character.id} value={contextValue}>
                    <Suspense
                      fallback={<LoadingScreen label="Загрузка раздела" />}
                    >
                      {HERO_TABS.includes(tab as HeroTab) && (
                        <SheetView
                          tab={tab as HeroTab}
                          tools={tab === "sheet" ? sheetTools : null}
                        />
                      )}
                      {tab === "settings" && (
                        <SettingsView
                          characters={characters}
                          currentId={character.id}
                          themes={THEMES}
                          themeChoice={themeChoice}
                          onThemeChoice={handleThemeChoice}
                          onSelect={(id) => void handleSelectCharacter(id, { openSheet: true })}
                          onNew={() => setTab("create")}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onExport={handleExport}
                          onImport={handleImport}
                        />
                      )}
                    </Suspense>
                  </AppContext.Provider>
                )}
              </ViewErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      {openTableSheet && (
        <Modal open title="Лист героя" className="table-hero-sheet-modal" onClose={closeTableHero}>
          {persistenceControls}
          {contextValue?.character.id === openTableSheet.heroId && !changingCharacter ? (
            <ViewErrorBoundary onExport={() => void handleExport(openTableSheet.heroId)}>
              <AppContext.Provider value={{ ...contextValue, goTo: next => {
                if (!isHeroTab(next)) return;
                setTableSheet(current => current && { ...current, tab: next });
                document.querySelector(".table-hero-sheet-modal > .modal-body")?.scrollTo({ top: 0 });
              } }}>
                <Suspense fallback={<LoadingScreen label="Загрузка листа" />}>
                  <SheetView tab={openTableSheet.tab} tools={openTableSheet.tab === "sheet" ? sheetTools : null}
                    onDevelopmentDirtyChange={trackTableSheetDraft} />
                </Suspense>
              </AppContext.Provider>
            </ViewErrorBoundary>
          ) : <LoadingScreen label="Загрузка листа" />}
        </Modal>
      )}

      <Toasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((toast) => toast.id !== id))
        }
      />
    </>
  );
}
