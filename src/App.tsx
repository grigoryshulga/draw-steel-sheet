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
import { Button, EmptyState } from "./components/ui";
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
import { TABS, type Tab } from "./navigation";
import { AppContext, type SaveStatus } from "./state/AppContext";
import type { Character, CharacterSummary, AppTheme } from "./types";
import { deriveStats } from "./lib/rules";
import { recalculateCharacter } from "./lib/character-calculations";
import { createRollEntry, type RollConfig, type RollEntry } from "./lib/roll";
import { SheetView } from "./views/SheetView";
import { RollDialog } from "./views/sheet/RollDialog";
import { AuthGate } from "./views/AuthGate";

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
  return (
    <AuthGate>
      <WorkspaceApp />
    </AuthGate>
  );
}

function WorkspaceApp() {
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

  const characterRef = useRef<Character | null>(null);
  const nextRollId = useRef(0);
  const lastLoadedRef = useRef<Character | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const saveGeneration = useRef(0);

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

  const queueSave = useCallback((doc: Character) => {
    const generation = ++saveGeneration.current;
    setSaveStatus("saving");
    saveChain.current = saveChain.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const saved = await saveCharacter(doc);
          if (generation === saveGeneration.current) {
            setSaveStatus("saved");
            setSaveError("");
          }
          setCharacters((prev) =>
            sortSummaries(
              prev.map((item) =>
                item.id === saved.id ? toSummary(saved) : item,
              ),
            ),
          );
        } catch (error) {
          if (generation === saveGeneration.current) {
            setSaveStatus("error");
            setSaveError(
              error instanceof Error ? error.message : "Ошибка сохранения",
            );
          }
        }
      });
    return saveChain.current;
  }, []);

  const update = useCallback((recipe: (current: Character) => Character) => {
    setCharacter((prev) => {
      if (!prev) return prev;
      const next = {
        ...recalculateCharacter(prev, recipe(prev)),
        updatedAt: new Date().toISOString(),
      };
      characterRef.current = next;
      return next;
    });
  }, []);

  const patch = useCallback(
    (partial: Partial<Character>) =>
      update((current) => ({ ...current, ...partial })),
    [update],
  );

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
          lastLoadedRef.current = doc;
          setCharacter(doc);
          setSaveStatus("saved");
        } else if (
          !/^#\/(codex|catalog|glossary)(?:\/|$)/.test(window.location.hash)
        ) {
          setNewOpen(true);
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
  }, []);

  /* ---------- Автосохранение ---------- */

  useEffect(() => {
    if (!character || character === lastLoadedRef.current) return;
    const timer = window.setTimeout(() => {
      void queueSave(character);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [character, queueSave]);

  useEffect(() => {
    const flushOnUnload = () => {
      const doc = characterRef.current;
      if (!doc || doc === lastLoadedRef.current) return;
      void saveCharacter(doc).catch(() => undefined);
    };
    window.addEventListener("beforeunload", flushOnUnload);
    return () => window.removeEventListener("beforeunload", flushOnUnload);
  }, []);

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

  const handleSelectCharacter = async (id: string) => {
    if (characterRef.current?.id === id) return;
    const previous = characterRef.current;
    if (previous && previous !== lastLoadedRef.current) {
      await queueSave(previous);
    }
    try {
      const doc = normalizeCharacter(await loadCharacter(id));
      characterRef.current = doc;
      lastLoadedRef.current = doc;
      setCharacter(doc);
      setSaveStatus("saved");
      setSaveError("");
      resetRollSession();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось загрузить героя",
        "error",
      );
    }
  };

  const handleCreate = async (draft: Character) => {
    const previous = characterRef.current;
    if (previous && previous !== lastLoadedRef.current)
      await queueSave(previous);
    const doc = await saveCharacter(draft);
    setCharacters((prev) => sortSummaries([toSummary(doc), ...prev]));
    characterRef.current = doc;
    lastLoadedRef.current = doc;
    setCharacter(doc);
    setNewOpen(false);
    setTab("sheet");
    resetRollSession();
    notify(`Герой «${doc.name}» создан`, "success");
    setSaveStatus("saved");
    setSaveError("");
  };

  const handleDuplicate = async (id: string) => {
    try {
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
      characterRef.current = saved;
      lastLoadedRef.current = saved;
      setCharacter(saved);
      setSaveStatus("saved");
      resetRollSession();
      notify("Создана копия героя", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось скопировать",
        "error",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await saveChain.current.catch(() => undefined);
      await deleteCharacter(id);
      const remaining = characters.filter((item) => item.id !== id);
      setCharacters(remaining);
      notify("Персонаж удалён", "success");
      if (characterRef.current?.id === id) {
        characterRef.current = null;
        lastLoadedRef.current = null;
        setCharacter(null);
        if (remaining.length > 0) {
          const doc = normalizeCharacter(await loadCharacter(remaining[0].id));
          characterRef.current = doc;
          lastLoadedRef.current = doc;
          setCharacter(doc);
          setSaveStatus("saved");
        } else {
          resetRollSession();
          setNewOpen(true);
          setSaveStatus("idle");
        }
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось удалить",
        "error",
      );
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
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<Character>;
      if (!parsed || typeof parsed !== "object" || !parsed.name) {
        throw new Error("В файле нет данных героя");
      }
      const doc = normalizeCharacter({ ...parsed, id: makeId() });
      const saved = await saveCharacter(doc);
      setCharacters((prev) => sortSummaries([toSummary(saved), ...prev]));
      characterRef.current = saved;
      lastLoadedRef.current = saved;
      setCharacter(saved);
      setSaveStatus("saved");
      resetRollSession();
      notify(`Импортирован герой «${saved.name}»`, "success");
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
        saveStatus,
        saveError,
        notify,
        goTo: (next: string) => setTab(next),
      }
    : null;

  return (
    <>
      <div className="app">
        <Sidebar
          tab={tab as Tab}
          onNavigate={(next) => setTab(next)}
          onOpenRoll={() => setRollOpen(true)}
          rollDisabled={!character}
        />
        <div className="main">
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

          <main className="content">
            {booting ? (
              <LoadingScreen label="Загрузка листа" />
            ) : ["codex", "catalog", "glossary"].includes(tab) ? (
              <Suspense fallback={<LoadingScreen label="Загрузка библиотеки" />}>
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
              <EmptyState
                icon="sword"
                title="Стальной лист ждёт героя"
                action={
                  <Button
                    variant="primary"
                    icon="plus"
                    onClick={() => setNewOpen(true)}
                  >
                    Создать героя
                  </Button>
                }
              />
            ) : (
              <AppContext.Provider value={contextValue}>
                <Suspense fallback={<LoadingScreen label="Загрузка раздела" />}>
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
          </main>
        </div>
      </div>

      {newOpen && (
        <Suspense fallback={<LoadingScreen label="Загрузка конструктора" />}>
          <NewCharacterDialog
            open={newOpen}
            onClose={() => setNewOpen(false)}
            onCreate={handleCreate}
          />
        </Suspense>
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
