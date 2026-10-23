import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BootError, LoadingScreen, Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { Toasts, type ToastMessage } from "./components/Toasts";
import { Button, Modal } from "./components/ui";
import { WelcomeView } from "./views/WelcomeView";
import { createAutosave } from "./lib/autosave";
import {
  createGameSession,
  type GameAction,
  type GameHistoryEntry,
} from "./lib/game-actions";
import { parseCharacterImport } from "./lib/character-import";
import { normalizeCharacter } from "./lib/defaults";
import { useHashTab } from "./lib/hooks";
import {
  deleteCharacter,
  listCharacters,
  loadCharacter,
  saveCharacter,
} from "./lib/api";
import {
  applyTheme,
  THEMES,
  readThemeChoice,
  resolveTheme,
  writeThemeChoice,
  type ThemeChoice,
} from "./lib/theme";
import { downloadJson, safeFilename } from "./lib/utils";
import { makeId } from "./data/templates";
import { NAV_ITEMS, TABS, type Tab } from "./navigation";
import { AppContext, type SaveStatus } from "./state/AppContext";
import type { Character, CharacterSummary, AppTheme } from "./types";
import { deriveStats } from "./lib/rules";
import { recalculateCharacter } from "./lib/character-calculations";
import { createRollEntry, type RollConfig, type RollEntry } from "./lib/roll";
import { RollDialog } from "./views/sheet/RollDialog";
import { AuthGate } from "./views/AuthGate";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import "./styles/workspace.css";

const SheetView = lazy(() =>
  import("./views/SheetView").then((module) => ({ default: module.SheetView })),
);
const AbilitiesView = lazy(() =>
  import("./views/AbilitiesView").then((module) => ({
    default: module.AbilitiesView,
  })),
);
const InventoryView = lazy(() =>
  import("./views/InventoryView").then((module) => ({
    default: module.InventoryView,
  })),
);
const HeroView = lazy(() =>
  import("./views/HeroView").then((module) => ({ default: module.HeroView })),
);
const NotesView = lazy(() =>
  import("./views/NotesView").then((module) => ({ default: module.NotesView })),
);
const SettingsView = lazy(() =>
  import("./views/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);
const CodexView = lazy(() =>
  import("./views/CodexView").then((module) => ({ default: module.CodexView })),
);
const NewCharacterDialog = lazy(() =>
  import("./components/NewCharacterDialog").then((module) => ({
    default: module.NewCharacterDialog,
  })),
);

function toSummary(character: Character): CharacterSummary {
  return {
    id: character.id,
    name: character.name,
    className: character.className,
    ancestry: character.ancestry,
    level: character.level,
    updatedAt: character.updatedAt,
  };
}

function sortSummaries(list: CharacterSummary[]): CharacterSummary[] {
  return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

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
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [themeChoice, setThemeChoiceState] =
    useState<ThemeChoice>(readThemeChoice);
  const [tab, setTab] = useHashTab("sheet", TABS);
  const [rollOpen, setRollOpen] = useState(false);
  const [lastRoll, setLastRoll] = useState<RollEntry | null>(null);
  const [rollLog, setRollLog] = useState<RollEntry[]>([]);
  const [changingCharacter, setChangingCharacter] = useState(false);
  const gameSession = useMemo(createGameSession, []);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);

  const characterRef = useRef<Character | null>(null);
  const nextRollId = useRef(0);
  const characterAction = useRef(false);
  const autosave = useMemo(
    () =>
      createAutosave<Character>({
        save: saveCharacter,
        onStatus: (status, error = "") => {
          setSaveStatus(status);
          setSaveError(error);
        },
        onSaved: (saved) =>
          setCharacters((previous) =>
            sortSummaries(
              previous.map((item) =>
                item.id === saved.id ? toSummary(saved) : item,
              ),
            ),
          ),
      }),
    [],
  );

  const notify = useCallback(
    (message: string, tone: "info" | "success" | "error" = "info") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4200);
    },
    [],
  );

  const performRoll = useCallback((config: RollConfig) => {
    const doc = characterRef.current;
    if (!doc) return;
    const entry = createRollEntry(doc, config, nextRollId.current++);
    setLastRoll(entry);
    setRollLog((prev) => [entry, ...prev].slice(0, 5));
  }, []);

  const resetRollSession = useCallback(() => {
    setRollOpen(false);
    setLastRoll(null);
    setRollLog([]);
  }, []);

  const update = useCallback(
    (recipe: (current: Character) => Character) => {
      const previous = characterRef.current;
      if (!previous || characterAction.current) return;
      const next = {
        ...recalculateCharacter(previous, recipe(previous)),
        updatedAt: new Date().toISOString(),
      };
      characterRef.current = next;
      autosave.edit(next);
      setCharacter(next);
    },
    [autosave],
  );

  const patch = useCallback(
    (partial: Partial<Character>) =>
      update((current) => ({ ...current, ...partial })),
    [update],
  );

  const performGameAction = useCallback(
    (action: GameAction, operationId = makeId()) => {
      const current = characterRef.current;
      if (!current || characterAction.current) return false;
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
    [gameSession, notify, update],
  );

  const undoGameAction = useCallback(() => {
    const current = characterRef.current;
    if (!current || characterAction.current) return;
    const result = gameSession.undo(current);
    if (!result.ok) {
      notify(result.reason, "error");
      return;
    }
    update(() => result.next);
    setGameHistory(gameSession.entries());
    notify(result.label);
  }, [gameSession, notify, update]);

  useEffect(() => {
    beforeSignOut.current = async () => {
      if (characterAction.current)
        throw new Error("Дождитесь завершения операции с героем");
      await autosave.flush();
    };
    return () => {
      beforeSignOut.current = async () => undefined;
    };
  }, [autosave, beforeSignOut]);

  useEffect(() => {
    const label = NAV_ITEMS.find((item) => item.id === tab)?.label ?? "Лист";
    document.title = `${character ? `${character.name} · ` : ""}${label} — Достать листы!`;
    if (tab !== "codex") window.scrollTo({ top: 0 });
  }, [tab, character?.id, character?.name]);

  /* ---------- Первичная загрузка ---------- */

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const list = await listCharacters();
        if (disposed) return;
        setCharacters(sortSummaries(list));
        if (list.length > 0) {
          const doc = normalizeCharacter(await loadCharacter(list[0].id));
          if (disposed) return;
          characterRef.current = doc;
          autosave.load(doc);
          setCharacter(doc);
        }
      } catch (error) {
        if (!disposed) {
          setBootError(
            error instanceof Error ? error.message : "Сервис недоступен",
          );
        }
      } finally {
        if (!disposed) setBooting(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [autosave]);

  /* ---------- Автосохранение ---------- */

  useEffect(() => {
    const guardUnload = (event: BeforeUnloadEvent) => {
      if (!autosave.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const flush = () => {
      void autosave.flush().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", guardUnload);
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", guardUnload);
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      autosave.dispose();
    };
  }, [autosave]);

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

  /* ---------- Действия с персонажами ---------- */

  const activateCharacter = (doc: Character | null) => {
    autosave.load(doc);
    characterRef.current = doc;
    setCharacter(doc);
    resetRollSession();
    gameSession.reset();
    setGameHistory([]);
  };

  const changeCharacter = async (action: () => Promise<void>) => {
    if (characterAction.current)
      throw new Error("Дождитесь завершения операции с героем");
    characterAction.current = true;
    setChangingCharacter(true);
    try {
      // Includes the debounce window and all edits queued during an earlier write.
      await autosave.flush();
      await action();
    } finally {
      characterAction.current = false;
      setChangingCharacter(false);
    }
  };

  const handleSelectCharacter = async (id: string) => {
    if (characterRef.current?.id === id) return;
    try {
      await changeCharacter(async () => {
        activateCharacter(normalizeCharacter(await loadCharacter(id)));
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось загрузить героя",
        "error",
      );
    }
  };

  const handleCreate = async (draft: Character) => {
    await changeCharacter(async () => {
      const doc = await saveCharacter(draft);
      setCharacters((prev) => sortSummaries([toSummary(doc), ...prev]));
      activateCharacter(doc);
      setNewOpen(false);
      setTab("sheet");
      notify(`Герой «${doc.name}» создан`, "success");
    });
  };

  const handleDuplicate = async (id: string) => {
    try {
      await changeCharacter(async () => {
        const source =
          characterRef.current?.id === id
            ? characterRef.current
            : normalizeCharacter(await loadCharacter(id));
        const now = new Date().toISOString();
        const copy: Character = {
          ...source,
          id: makeId(),
          name: `${source.name} — копия`,
          createdAt: now,
          updatedAt: now,
        };
        const saved = await saveCharacter(copy);
        setCharacters((prev) => sortSummaries([toSummary(saved), ...prev]));
        activateCharacter(saved);
        notify("Создана копия героя", "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось скопировать",
        "error",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await changeCharacter(async () => {
        const remaining = characters.filter((item) => item.id !== id);
        const deletingCurrent = characterRef.current?.id === id;
        // Load the replacement first: a failed read must leave the current hero intact.
        const replacement =
          deletingCurrent && remaining.length
            ? normalizeCharacter(await loadCharacter(remaining[0].id))
            : null;
        await deleteCharacter(id);
        setCharacters(remaining);
        if (deletingCurrent) {
          activateCharacter(replacement);
          if (!replacement) setTab("sheet");
        }
        notify("Персонаж удалён", "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось удалить",
        "error",
      );
      throw error;
    }
  };

  const handleExport = async (id: string) => {
    try {
      const doc =
        characterRef.current?.id === id
          ? characterRef.current
          : await loadCharacter(id);
      downloadJson(`${safeFilename(doc.name)}.draw-steel.json`, doc);
      notify("JSON сохранён", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось экспортировать",
        "error",
      );
    }
  };

  const handleImport = async (file: File) => {
    try {
      await changeCharacter(async () => {
        const doc = await parseCharacterImport(file);
        const saved = await saveCharacter(doc);
        setCharacters((prev) => sortSummaries([toSummary(saved), ...prev]));
        activateCharacter(saved);
        setTab("sheet");
        notify(`Импортирован герой «${saved.name}»`, "success");
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось импортировать",
        "error",
      );
    }
  };

  /* ---------- Рендер ---------- */

  if (bootError) {
    return <BootError message={bootError} />;
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
      <div className="app">
        <Sidebar
          tab={tab as Tab}
          onNavigate={(next) => setTab(next)}
          onOpenRoll={() => {
            setTab("sheet");
            setRollOpen(true);
          }}
          rollDisabled={!character}
        />
        <div className="main" aria-busy={changingCharacter}>
          {changingCharacter && (
            <div className="workspace-progress" role="status">
              Сохраняем и открываем героя…
            </div>
          )}
          <div inert={changingCharacter}>
            {character && (
              <Topbar
                character={character}
                characters={characters}
                saveStatus={saveStatus}
                saveError={saveError}
                themes={THEMES}
                themeChoice={themeChoice}
                onThemeChoice={handleThemeChoice}
                onSelectCharacter={(id) => void handleSelectCharacter(id)}
                onNewCharacter={() => setNewOpen(true)}
                onNavigate={(next) => setTab(next)}
              />
            )}

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
                ) : tab === "codex" ? (
                  <Suspense
                    fallback={<LoadingScreen label="Загрузка Кодекса" />}
                  >
                    <CodexView />
                  </Suspense>
                ) : !character || !contextValue ? (
                  <WelcomeView
                    onCreate={() => setNewOpen(true)}
                    onImport={handleImport}
                    onOpenCodex={() => setTab("codex")}
                    busy={changingCharacter}
                  />
                ) : (
                  <AppContext.Provider key={character.id} value={contextValue}>
                    <Suspense
                      fallback={<LoadingScreen label="Загрузка раздела" />}
                    >
                      {tab === "sheet" && <SheetView />}
                      {tab === "abilities" && <AbilitiesView />}
                      {tab === "inventory" && <InventoryView />}
                      {tab === "hero" && <HeroView />}
                      {tab === "notes" && <NotesView />}
                      {tab === "settings" && (
                        <SettingsView
                          characters={characters}
                          currentId={character.id}
                          themes={THEMES}
                          themeChoice={themeChoice}
                          onThemeChoice={handleThemeChoice}
                          onSelect={(id) => void handleSelectCharacter(id)}
                          onNew={() => setNewOpen(true)}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onExport={handleExport}
                          onImport={handleImport}
                        />
                      )}
                    </Suspense>
                    <RollDialog
                      open={rollOpen}
                      onClose={() => setRollOpen(false)}
                      onRoll={performRoll}
                      lastRoll={lastRoll}
                      log={rollLog}
                    />
                  </AppContext.Provider>
                )}
              </ViewErrorBoundary>
            </main>
          </div>
        </div>
      </div>

      {newOpen && (
        <ViewErrorBoundary
          onClose={() => setNewOpen(false)}
          onExport={
            character ? () => void handleExport(character.id) : undefined
          }
        >
          <Suspense
            fallback={
              <Modal
                open
                title="Создание героя"
                onClose={() => setNewOpen(false)}
              >
                <LoadingScreen label="Загрузка конструктора" />
              </Modal>
            }
          >
            <NewCharacterDialog
              open={newOpen}
              onClose={() => setNewOpen(false)}
              onCreate={handleCreate}
            />
          </Suspense>
        </ViewErrorBoundary>
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
