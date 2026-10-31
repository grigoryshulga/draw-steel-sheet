import {
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
import { Button } from "./components/ui";
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
import { HERO_TABS, TABS, TAB_LABELS, type HeroTab, type Tab } from "./navigation";
import { makeId } from "./data/templates";
import { AppContext } from "./state/AppContext";
import type { AppTheme } from "./types";
import { deriveStats } from "./lib/rules";
import { createRollEntry, type RollConfig, type RollEntry } from "./lib/roll";
import { RollDialog } from "./views/sheet/RollDialog";
import { HistoryDialog } from "./views/sheet/HistoryDialog";
import "./views/sheet/SheetFabs.css";
import "./components/BuilderPage.css";
import { AuthGate } from "./views/AuthGate";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import { useHeroLifecycle } from "./state/useHeroLifecycle";
import "./styles/workspace.css";

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
const CatalogView = lazy(() =>
  import("./views/CatalogView").then((module) => ({
    default: module.CatalogView,
  })),
);
const GlossaryView = lazy(() =>
  import("./views/GlossaryView").then((module) => ({
    default: module.GlossaryView,
  })),
);
const NewCharacterDialog = lazy(() =>
  import("./components/NewCharacterDialog").then((module) => ({
    default: module.NewCharacterDialog,
  })),
);

export default function App() {
  const beforeSignOut = useRef<() => Promise<void>>(async () => undefined);
  return (
    <AuthGate beforeSignOut={() => beforeSignOut.current()}>
      <WorkspaceApp beforeSignOut={beforeSignOut} />
    </AuthGate>
  );
}

function WorkspaceApp({
  beforeSignOut,
}: {
  beforeSignOut: { current: () => Promise<void> };
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [themeChoice, setThemeChoiceState] =
    useState<ThemeChoice>(readThemeChoice);
  const [tab, setTab] = useHashTab("sheet", TABS);
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

  const performRoll = useCallback((config: RollConfig) => {
    const doc = characterRef.current;
    if (!doc) return;
    const entry = createRollEntry(doc, config, nextRollId.current++);
    setLastRoll(entry);
    setRollLog((prev) => [entry, ...prev].slice(0, 5));
  }, [characterRef]);

  const performGameAction = useCallback(
    (action: GameAction, operationId = makeId()) => {
      const current = characterRef.current;
      if (!current || isTransitioning()) return false;
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
    if (tab !== "codex") window.scrollTo({ top: 0 });
  }, [tab, character?.id, character?.name]);

  useEffect(() => {
    if (tab !== "create") lastNonCreateTab.current = tab as Tab;
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

  /* ---------- Рендер ---------- */

  if (bootError) {
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

  const contextValue = character
    ? {
        character,
        derived: deriveStats(character),
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
          {changingCharacter && (
            <div className="workspace-progress" role="status">
              Сохраняем и открываем героя…
            </div>
          )}
          <div inert={changingCharacter}>
            {character && saveStatus === "error" && (
              <section className="save-error-banner" role="alert">
                <div>
                  <strong>Изменения не сохранены</strong>
                  <p>
                    Они остаются в открытом листе. Повторите сохранение или
                    скачайте копию перед закрытием страницы.
                  </p>
                  {saveError && <p className="small muted">{saveError}</p>}
                </div>
                <div className="hstack wrap">
                  <Button
                    onClick={() => void autosave.flush().catch(() => undefined)}
                  >
                    Повторить сохранение
                  </Button>
                  <Button
                    icon="download"
                    onClick={() => void handleExport(character.id)}
                  >
                    Скачать копию
                  </Button>
                </div>
              </section>
            )}
            <main className="content" id="main-content" tabIndex={-1}>
              <ViewErrorBoundary
                key={`${character?.id ?? "empty"}:${tab}`}
                onExport={
                  character ? () => void handleExport(character.id) : undefined
                }
              >
                {booting ? (
                  <LoadingScreen label="Загрузка листа" />
                ) : ["codex", "catalog", "glossary"].includes(tab) ? (
                  <Suspense
                    fallback={<LoadingScreen label="Загрузка библиотеки" />}
                  >
                    <AppContext.Provider value={contextValue}>
                      {tab === "codex" ? (
                        <CodexView />
                      ) : tab === "catalog" ? (
                        <CatalogView />
                      ) : (
                        <GlossaryView />
                      )}
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
                        <SheetView tab={tab as HeroTab} />
                      )}
                      {tab === "settings" && (
                        <SettingsView
                          characters={characters}
                          currentId={character.id}
                          themes={THEMES}
                          themeChoice={themeChoice}
                          onThemeChoice={handleThemeChoice}
                          onSelect={(id) => void handleSelectCharacter(id)}
                          onNew={() => setTab("create")}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onExport={handleExport}
                          onImport={handleImport}
                        />
                      )}
                    </Suspense>
                    <div className="sheet-fab-stack">
                      <HistoryDialog />
                      <RollDialog
                        open={rollOpen}
                        onToggle={() => setRollOpen((open) => !open)}
                        onClose={() => setRollOpen(false)}
                        onRoll={performRoll}
                        lastRoll={lastRoll}
                        log={rollLog}
                      />
                    </div>
                  </AppContext.Provider>
                )}
              </ViewErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      <Toasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((toast) => toast.id !== id))
        }
      />
    </>
  );
}
