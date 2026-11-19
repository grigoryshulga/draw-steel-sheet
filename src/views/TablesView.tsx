import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Button, Card } from "../components/ui";
import type { IconName } from "../components/Icons";
import { CardDetailModal } from "../components/CardDetailModal";
import { Toasts } from "../components/Toasts";
import { SaveIndicator } from "../components/SaveIndicator";
import { TableLibrary } from "./tables/TableLibrary";
import { SceneList } from "./tables/SceneList";
import { LoadingScreen } from "../components/Topbar";
import type { CharacterSummary } from "../types";
import { supabaseEnabled } from "../lib/supabase";
import { tableRepository } from "../lib/tables/repository";
import { createScene, duplicateScene } from "../lib/tables/scenes";
import { hasSceneDrag, readSceneDrop, type SceneDrop } from "../lib/tables/board";
import { copySceneLayout } from "../lib/tables/scene-layout";
import type {
  DirectorTemplate,
  TableMaterial,
  TableScene,
  TableSnapshot,
} from "../lib/tables/types";
import { useStorageScope } from "../state/StorageScope";
import type { useTables } from "../state/useTables";
import { TableMemberSettings } from "./tables/TableMembers";
import { TableItems } from "./tables/TableItems";
import { SceneEditor } from "./tables/SceneEditor";
import { SceneTracker } from "./tables/SceneTracker";
import { BoardMonsterCards } from "./tables/BoardMonsterCards";
import "./tables/Tables.css";

const PANELS = {
  reference: { label: "Справочник", icon: "library" },
  scenes: { label: "Сцены", icon: "sword" },
  materials: { label: "Материалы", icon: "sheet" },
  items: { label: "Предметы", icon: "inventory" },
  journal: { label: "Журнал", icon: "book" },
  settings: { label: "Управление", icon: "settings" },
} satisfies Record<string, { label: string; icon: IconName }>;
const TableBoard = lazy(() => import("./tables/TableBoard").then(module => ({ default: module.TableBoard })));
const SceneLayoutEditor = lazy(() => import("./tables/SceneLayoutEditor").then(module => ({ default: module.SceneLayoutEditor })));
const TableReference = lazy(() => import("./tables/TableReference").then(module => ({ default: module.TableReference })));
type Panel = keyof typeof PANELS;
const SCENE_NAMES: Record<TableScene["kind"], string> = {
  encounter: "Бой",
  negotiation: "Переговоры",
  montage: "Монтаж",
};

function invitationFromHash(hash: string) {
  const code = /^#\/tables\/join\/([^/]+)$/.exec(hash)?.[1];
  if (!code) return "";
  try {
    return decodeURIComponent(code).trim();
  } catch {
    return "";
  }
}

export function TablesView({
  state,
  characters,
  beforeCommand,
  openHero,
  refreshHero,
}: {
  state: ReturnType<typeof useTables>;
  characters: CharacterSummary[];
  beforeCommand: () => Promise<void>;
  openHero: (id: string) => void;
  refreshHero: () => Promise<void>;
}) {
  const actorId = useStorageScope();
  const { table, busy, command: send, setError } = state;
  const previousTableId = useRef(table?.id);
  const tableScrollY = useRef(0);
  useLayoutEffect(() => {
    window.scrollTo({ top: tableScrollY.current, behavior: "instant" });
    return () => {
      tableScrollY.current = window.scrollY;
    };
  }, []);
  const director = table?.ownerId === table?.actorId;
  const [lobbyAction, setLobbyAction] = useState<"create" | "join" | "invite" | null>(null);
  const [drawer, setDrawer] = useState<{ panel: Panel; open: boolean } | null>(null);
  const drawerId = useId();
  const rail = useRef<HTMLElement>(null);
  const drawerContent = useRef<HTMLDivElement>(null);
  const panel = drawer?.panel === "scenes" && !director ? undefined : drawer?.panel;
  const drawerOpen = !!panel && drawer?.open === true;
  const [exitOpen, setExitOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(560);
  const [layoutHost, setLayoutHost] = useState<HTMLDivElement | null>(null);
  const [draftGridHost, setDraftGridHost] = useState<HTMLDivElement | null>(null);
  const [preparingDrop, setPreparingDrop] = useState(false);
  const [sceneDropTarget, setSceneDropTarget] = useState(false);
  const [tableName, setTableName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [invite, setInvite] = useState("");
  const [templates, setTemplates] = useState<DirectorTemplate[]>([]);
  const [scene, setScene] = useState<TableScene | null>(null);
  const [sceneBase, setSceneBase] = useState("");
  const [sceneDirty, setSceneDirty] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<TableMaterial | null>(null);
  const [materialEditing, setMaterialEditing] = useState(false);
  const [selectedScene, setSelectedScene] = useState("");
  const [material, setMaterial] = useState<TableMaterial>({
    id: "",
    title: "",
    text: "",
    public: false,
  });
  const [journalText, setJournalText] = useState("");
  const [journalPublic, setJournalPublic] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const activeScene = table?.scenes.find(s => s.id === table.board?.sceneId && s.status === "active");
  const canReplaceScene = !!table && director && !table.archived && !busy && !preparingDrop && !scene && !state.stale && !state.needsRetry;
  useEffect(() => {
    if (!supabaseEnabled) return;
    const syncInvitation = () => {
      const code = invitationFromHash(window.location.hash);
      if (!code) {
        setLobbyAction((action) => action === "invite" ? null : action);
        return;
      }
      setInvite(code);
      setError("");
      setLobbyAction("invite");
    };
    syncInvitation();
    window.addEventListener("hashchange", syncInvitation);
    return () => window.removeEventListener("hashchange", syncInvitation);
  }, [setError]);

  const closeLobbyAction = () => {
    if (lobbyAction === "invite") {
      if (invitationFromHash(window.location.hash)) {
        window.history.replaceState(window.history.state, "", "#/tables");
      }
      setInvite("");
    }
    setLobbyAction(null);
  };

  useEffect(() => {
    void tableRepository
      .templates()
      .then(setTemplates)
      .catch((e) => state.setError(e.message));
  }, []);
  useEffect(() => {
    if (previousTableId.current === table?.id) return;
    previousTableId.current = table?.id;
    setScene(null);
    setSceneDirty(false);
    setSelectedScene("");
    setMaterial({ id: "", title: "", text: "", public: false });
    setMaterialEditing(false);
    setDrawer(null);
    setExitOpen(false);
    setSceneDropTarget(false);
  }, [table?.id]);

  const command = useCallback(
    async (
      type: string,
      payload: Record<string, unknown> = {},
      id?: string | null,
    ): Promise<TableSnapshot | null> => {
      try {
        await beforeCommand();
        return await send(type, payload, id);
      } catch (e) {
        state.setError(
          e instanceof Error ? e.message : "Не удалось сохранить героя",
        );
        return null;
      }
    },
    [beforeCommand, send, state.setError],
  );
  useEffect(() => {
    if (
      table &&
      selectedScene &&
      !table.scenes.some((s) => s.id === selectedScene)
    )
      setSelectedScene("");
  }, [table, selectedScene]);
  const saveTemplate = async (template: DirectorTemplate) => {
    const saved = await tableRepository.saveTemplate(template);
    setTemplates((old) => [...old.filter((t) => t.id !== saved.id), saved]);
    setMessage("Заготовка сохранена в вашей библиотеке");
  };
  const editScene = (next: TableScene) => {
    setScene(structuredClone(next));
    setSceneDirty(false);
    setSceneBase(
      JSON.stringify(table?.scenes.find((s) => s.id === next.id) ?? null),
    );
  };
  const saveScene = async (next: TableScene) => {
    if (
      JSON.stringify(table?.scenes.find((s) => s.id === next.id) ?? null) !==
      sceneBase
    ) {
      state.setError(
        "Эту сцену изменили на другом устройстве. Ваш черновик сохранён на экране; сохраните его в библиотеку или откройте свежую версию.",
      );
      return;
    }
    if (await command("save-scene", { scene: next })) {
      setSceneDirty(false);
      setScene(null);
      setSelectedScene(next.status === "prepared" ? "" : next.id);
    }
  };

  const collapseDrawer = (restoreFocus = false) => {
    setDrawer(current => current && { ...current, open: false });
    if (restoreFocus && panel) rail.current?.querySelector<HTMLButtonElement>(`[data-table-panel="${panel}"]`)?.focus();
  };
  const switchPanel = (next: Panel) => {
    if (drawerOpen && panel === next) {
      collapseDrawer();
      return;
    }
    if (next !== "scenes" && scene) {
      if (sceneDirty && !confirm("Закрыть подготовку без сохранения?")) return;
      setScene(null);
      setSceneDirty(false);
    }
    setDrawer({ panel: next, open: true });
  };
  const launchScene = async (target: SceneDrop, fromDrop = false) => {
    if (!table || !canReplaceScene) return;
    const current = table.board?.sceneId ?? null;
    if (target.kind === "main" && current === null) {
      if (!fromDrop) collapseDrawer();
      return;
    }
    if (fromDrop && target.kind === "scene" && target.id === current) return;
    setPreparingDrop(true);
    try {
      let payload: { sceneId: string | null } | { scene: TableScene };
      if (target.kind === "template") {
        const source = templates.find(item => item.id === target.id)?.scene;
        if (!source) return;
        payload = { scene: { ...duplicateScene(source), name: source.name, layout: await copySceneLayout(source.layout, table.id) } };
      } else {
        payload = { sceneId: target.kind === "main" ? null : target.id };
      }
      if (await command("board-start-scene", payload, table.id)) {
        setSelectedScene("");
        if (!fromDrop) collapseDrawer();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось запустить сцену");
    } finally {
      setPreparingDrop(false);
    }
  };
  const openTemplate = async (template: DirectorTemplate) => {
    if (!table || !template.scene) return;
    setPreparingDrop(true);
    try {
      editScene({
        ...duplicateScene(template.scene), name: template.scene.name,
        layout: await copySceneLayout(template.scene.layout, table.id),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось открыть заготовку");
    } finally {
      setPreparingDrop(false);
    }
  };
  const resizeDrawer = (width: number) => {
    const max = rail.current?.getBoundingClientRect().left ?? window.innerWidth;
    setDrawerWidth(Math.min(max, Math.max(280, width)));
  };

  return (
    <div
      className={`tables-page${table ? " is-board-focused" : ""}`}
    >
      {!table && <header className="table-page-header">
        <h1>Мои столы</h1>
        {state.selected && (
          <Button iconOnly icon="arrow-left" size="sm" variant="ghost" onClick={() => state.select(null)}>
            Все столы
          </Button>
        )}
        {!state.selected && (
          <div className="table-actions">
            <Button
              icon="plus"
              variant="primary"
              onClick={() => {
                setTableName("");
                state.setError("");
                setLobbyAction("create");
              }}
            >
              Создать стол
            </Button>
            {supabaseEnabled && (
              <Button onClick={() => setLobbyAction("join")}>
                Присоединиться
              </Button>
            )}
          </div>
        )}
      </header>}
      {table?.archived && <p className="table-archive-state">Стол в архиве</p>}
      {state.error && (
        <div className="table-notice table-error" role="alert">
          {state.error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => state.setError("")}
            icon="close"
            iconOnly
          >
            Закрыть сообщение
          </Button>
        </div>
      )}
      {state.needsRetry && (
        <div className="table-notice">
          <p>
            Подтверждение действия не получено. Повторный запрос безопасен:
            действие выполнится один раз.
          </p>
          <Button disabled={busy} onClick={() => void state.retryCommand()}>
            Повторить подтверждение
          </Button>
        </div>
      )}
      <Toasts toasts={message ? [{ id: 1, message, tone: "success" }] : []} onDismiss={() => setMessage("")} />
      {state.stale && (
        <p className="table-notice" role="status">
          Связь потеряна. Показаны последние полученные данные
          {state.lastRead &&
            ` на ${new Date(state.lastRead).toLocaleTimeString("ru")}`}
          . Действия станут доступны после восстановления связи.
        </p>
      )}
      {state.loading ? (
        <LoadingScreen label="Загрузка столов" />
      ) : !state.selected ? (
        <>
          {state.tables.length === 0 && (
            <div className="table-empty">
              <strong>Ваш первый стол</strong>
              <p>
                Создайте место для своей кампании или присоединитесь по
                приглашению ведущего.
              </p>
            </div>
          )}
          {([
            { title: "Я ведущий", tables: state.tables.filter((row) => row.ownerId === (row.actorId ?? actorId)) },
            { title: "Я игрок", tables: state.tables.filter((row) => row.ownerId !== (row.actorId ?? actorId)) },
          ]).filter((group) => group.tables.length > 0).map((group) => (
            <section className="table-lobby-section" key={group.title} aria-label={group.title}>
              <h2>{group.title}</h2>
              <div className="table-card-grid table-lobby-grid">
                {group.tables.map((row) => (
                  <Card key={row.id} className="table-lobby-card">
                    {row.archived && <p className="eyebrow">Архив</p>}
                    <h3>{row.name}</h3>
                    <p className="muted">Участников: {row.memberCount}</p>
                    <Button
                      size="sm"
                      onClick={() => state.select(row.id)}
                      icon="login"
                      iconOnly
                    >
                      Войти в стол
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : !table ? (
        <p className="muted">
          {state.stale
            ? "Стол пока недоступен. Проверьте соединение."
            : "Загрузка стола…"}
        </p>
      ) : (
        <>
          <div className={`table-sidebar${drawerOpen ? " is-open" : ""}`} style={{ width: `calc(${drawerWidth}px + var(--table-rail-width))` }}
            onKeyDown={(event) => {
              if (drawerOpen && event.key === "Escape" && !event.defaultPrevented && event.currentTarget.contains(event.target as Node)) {
                event.preventDefault();
                collapseDrawer(true);
              }
            }}>
          <nav className="table-rail" ref={rail} aria-label="Разделы стола">
            {(Object.keys(PANELS) as Panel[]).filter(key => director || key !== "scenes").map(key => {
              const { label, icon } = PANELS[key];
              const active = drawerOpen && panel === key;
              const pending = key === "items" && table.offers.some(offer => offer.toUserId === table.actorId && offer.status === "pending");
              return <Button key={key} iconOnly icon={icon} variant={active ? "soft" : "ghost"}
                aria-label={pending ? `${label} · Новое предложение` : label} aria-expanded={active} aria-controls={drawerId}
                data-table-panel={key} data-notification={pending || undefined}
                onClick={() => switchPanel(key)}>{label}</Button>;
            })}
            <div className="table-rail-footer">
              <SaveIndicator status={state.stale ? "error" : busy ? "saving" : "saved"} error={state.stale ? "Нет связи" : ""} />
              <Button icon="logout" iconOnly variant="ghost" onClick={() => setExitOpen(true)}>Выйти из стола</Button>
            </div>
          </nav>
          <div id={drawerId} className="table-panel table-drawer" inert={!drawerOpen || state.stale}>
            <div className="table-drawer-resize" role="separator" aria-label="Ширина панели" aria-orientation="vertical" tabIndex={0}
              onPointerDown={(event) => {
                if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  const edge = rail.current?.getBoundingClientRect().left ?? window.innerWidth;
                  resizeDrawer(edge - event.clientX);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const width = event.currentTarget.parentElement?.getBoundingClientRect().width ?? drawerWidth;
                resizeDrawer(width + (event.key === "ArrowLeft" ? 32 : -32));
              }} />
            <div className="table-drawer-actions">
              {scene && <div className="table-drawer-grid-host" ref={setDraftGridHost} />}
              <Button size="sm" iconOnly icon="chevron-right" variant="ghost" onClick={() => collapseDrawer(true)}>Свернуть панель</Button>
            </div>
            <div ref={drawerContent} className="table-drawer-content" tabIndex={0} role="region" aria-label={panel ? PANELS[panel].label : "Содержимое панели"}>
            {panel === "reference" && (
              <Suspense fallback={<p role="status">Загрузка справочника…</p>}>
                <TableReference scrollRoot={drawerContent} />
              </Suspense>
            )}
            {panel === "items" && (
              <TableItems
                table={table}
                templates={templates}
                busy={busy}
                command={command}
                saveTemplate={saveTemplate}
                refreshHero={refreshHero}
                commandError={state.error}
              />
            )}
            {panel === "scenes" && (
              <section className={`table-scenes-layout${director && !scene && !selectedScene ? " has-library" : ""}`}>
                <div className="table-stack">
                {!scene && !selectedScene && (
                  <div className="table-section-heading">
                    <h2>Сцены</h2>
                    {director && !table.archived && (
                      <div className="table-actions">
                        {Object.entries(SCENE_NAMES).map(([kind, label]) => (
                          <Button
                            key={kind}
                            onClick={() =>
                              editScene(
                                createScene(
                                  kind as TableScene["kind"],
                                  `Новая сцена: ${label.toLowerCase()}`,
                                  table.members.filter(m => m.role === "player" && m.hero).length || 5,
                                ),
                              )
                            }
                          >
                            + {label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!scene && selectedScene && (
                  <div className="table-section-heading scene-tracker-navigation">
                    <Button iconOnly icon="arrow-left"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          !sceneDirty ||
                          confirm(
                            "Вернуться к списку без сохранения черновика?",
                          )
                        ) {
                          setScene(null);
                          setSelectedScene("");
                        }
                      }}
                    >
                      Список сцен
                    </Button>
                    <SaveIndicator status={state.stale ? "error" : busy ? "saving" : "saved"} error={state.stale ? "Нет связи" : ""} />
                    {!scene && director && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="edit"
                        disabled={busy || table.archived}
                        onClick={() => {
                          const current = table.scenes.find(
                            (s) => s.id === selectedScene,
                          );
                          if (current) editScene(current);
                        }}
                        iconOnly
                      >
                        Подготовка сцены
                      </Button>
                    )}
                  </div>
                )}
                {scene ? (
                  <>
                    <SceneEditor
                      key={scene.id}
                      scene={scene}
                      onSave={(s) => void saveScene(s)}
                      onCancel={() => {
                        if (!sceneDirty || confirm("Отменить изменения сцены?")) {
                          setSceneDirty(false);
                          setScene(null);
                        }
                      }}
                      onDirtyChange={setSceneDirty}
                      renderLayout={(draft, update) => layoutHost && createPortal(
                        <Suspense fallback={null}>
                          <SceneLayoutEditor table={table} layout={draft.layout} busy={busy || table.archived} gridHost={draftGridHost}
                            onChange={(layout) => update({ layout })} />
                        </Suspense>, layoutHost)}
                      busy={busy || table.archived}
                      partyLevels={table.members.flatMap((m) =>
                        m.hero ? [m.hero.level] : [],
                      )}
                      onSaveTemplate={(draft) =>
                        void saveTemplate({
                          id: crypto.randomUUID(),
                          name: draft.name,
                          kind: "scene",
                          scene: draft,
                          version: 0,
                        }).catch((e) => state.setError(e.message))
                      }
                    />
                  </>
                ) : (
                  <>
                    {!selectedScene && (
                      <SceneList
                        scenes={table.scenes}
                        currentSceneId={table.board?.sceneId ?? null}
                        director={director}
                        disabled={busy || preparingDrop || table.archived || state.needsRetry}
                        onOpen={(s) =>
                          s.status === "prepared" && director && !table.archived
                            ? editScene(s)
                            : setSelectedScene(s.id)
                        }
                        onEdit={editScene}
                        onStart={(s) => void launchScene({ kind: "scene", id: s.id })}
                        onStartMain={() => void launchScene({ kind: "main" })}
                        onDropScene={(target) => void launchScene(target, true)}
                        onCopy={async (s) => {
                          const copy = duplicateScene(s);
                          if (await command("save-scene", { scene: copy })) setMessage("Сцена скопирована");
                        }}
                        onKeep={(s) =>
                          void saveTemplate({
                            id: crypto.randomUUID(),
                            name: s.name,
                            kind: "scene",
                            scene: s,
                            version: 0,
                          }).catch((e) => state.setError(e.message))
                        }
                        onDelete={(s) => {
                          if (confirm(`Удалить сцену «${s.name}»?`))
                            void command("delete-scene", { sceneId: s.id });
                        }}
                      />
                    )}
                    {table.scenes.find((s) => s.id === selectedScene) && (
                      <SceneTracker
                        scene={table.scenes.find(
                          (s) => s.id === selectedScene,
                        )!}
                        director={director}
                        showRoster={activeScene?.id !== selectedScene || activeScene.kind !== "encounter"}
                        busy={busy || table.archived || state.needsRetry}
                        combat={table.combat?.sceneId === selectedScene ? table.combat : undefined}
                        table={activeScene?.id === selectedScene ? table : undefined}
                        onCombat={activeScene?.id === selectedScene ? (type, payload) => void command(type, payload) : undefined}
                        error={state.error}
                        onChange={(s) =>
                          void command("save-scene", { scene: s })
                        }
                      />
                    )}
                  </>
                )}
                </div>
                {director && !scene && !selectedScene && (
                  <TableLibrary
                    templates={templates}
                    disabled={table.archived || busy || preparingDrop}
                    onAdd={(t) => void openTemplate(t)}
                    onStart={(t) => void launchScene({ kind: "template", id: t.id })}
                    onDelete={async (t) => {
                      if (!confirm("Удалить заготовку из личной библиотеки?")) return;
                      try {
                        await tableRepository.deleteTemplate(t.id);
                        setTemplates((old) => old.filter((x) => x.id !== t.id));
                      } catch (e) { state.setError((e as Error).message); }
                    }}
                  />
                )}
              </section>
            )}
            {panel === "materials" && (
              <section className="table-stack table-materials">
                <div className="table-section-heading">
                  <h2>Материалы</h2>
                  {director && !table.archived && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setMaterial({
                          id: "",
                          title: "",
                          text: "",
                          public: false,
                        });
                        setMaterialEditing(true);
                      }}
                      icon="plus"
                      iconOnly
                    >
                      Добавить материал
                    </Button>
                  )}
                </div>
                {table.materials.length === 0 && (
                  <div className="table-empty">
                    <strong>Пока нет материалов</strong>
                    <p>
                      {director
                        ? "Сохраните описание места, улику или заметку. Игроки увидят только раскрытые материалы."
                        : "Здесь появятся материалы, которыми поделится ведущий."}
                    </p>
                  </div>
                )}
                {director && !table.archived && (
                  <CardDetailModal
                    open={materialEditing}
                    onClose={() => setMaterialEditing(false)}
                    title={material.id ? "Изменить материал" : "Новый материал"}
                    className="table-dialog"
                    wide
                  >
                    {state.error && <p role="alert">{state.error}</p>}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await command("save-material", {
                            material: {
                              ...material,
                              id: material.id || crypto.randomUUID(),
                            },
                          })
                        ) {
                          setMaterialEditing(false);
                          setMaterial({
                            id: "",
                            title: "",
                            text: "",
                            public: false,
                          });
                        }
                      }}
                    >
                      <label>
                        Название
                        <input
                          className="input"
                          required
                          maxLength={200}
                          value={material.title}
                          onChange={(e) =>
                            setMaterial({ ...material, title: e.target.value })
                          }
                        />
                      </label>
                      <div className="field">
                        <span className="field-label">Текст</span>
                        <MarkdownEditor
                          disabled={busy || table.archived}
                          aria-label="Текст материала"
                          required
                          value={material.text}
                          onChange={(text) =>
                            setMaterial({ ...material, text })
                          }
                        />
                      </div>
                      <label className="table-check">
                        <input
                          type="checkbox"
                          checked={material.public}
                          onChange={(e) =>
                            setMaterial({
                              ...material,
                              public: e.target.checked,
                            })
                          }
                        />
                        Открыть игрокам
                      </label>
                      <Button iconOnly icon="save"
                        type="submit"
                        variant="primary"
                        disabled={
                          busy ||
                          !material.title.trim() ||
                          !material.text.trim()
                        }
                      >
                        Сохранить материал
                      </Button>
                    </form>
                  </CardDetailModal>
                )}
                {table.materials.map((m) => (
                  <Card key={m.id} className="table-material-card">
                    <div className="table-section-heading"><h3>{m.title}</h3><span className="table-badge">{m.public ? "Виден игрокам" : "Только ведущему"}</span></div>
                    <div className="table-material-excerpt"><MarkdownPreview text={m.text} /></div>
                    <div className="table-actions"><Button icon="eye" iconOnly size="sm" variant="ghost" onClick={() => setViewingMaterial(m)}>Прочитать материал</Button>
                    {director && !table.archived && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="edit"
                          onClick={() => {
                            setMaterial(m);
                            setMaterialEditing(true);
                          }}
                          iconOnly
                        >
                          Изменить
                        </Button>
                        <Button
                          iconOnly
                          icon={m.public ? "eye-off" : "users"}
                          aria-pressed={m.public}
                          aria-label={`${m.public ? "Скрыть" : "Раскрыть"} материал: ${m.title}`}
                          title={`${m.public ? "Скрыть" : "Раскрыть"} материал: ${m.title}`}
                          disabled={busy}
                          onClick={() =>
                            void command("save-material", {
                              material: { ...m, public: !m.public },
                            })
                          }
                        >
                          {m.public ? "Скрыть" : "Раскрыть"}
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            if (confirm("Удалить материал?"))
                              void command("delete-material", {
                                materialId: m.id,
                              });
                          }}
                          icon="trash"
                          iconOnly
                        >
                          Удалить
                        </Button>
                      </>
                    )}
                    </div>
                  </Card>
                ))}
                <CardDetailModal open={!!viewingMaterial} onClose={() => setViewingMaterial(null)} title={viewingMaterial?.title ?? "Материал"} className="table-dialog" wide>
                  <MarkdownPreview text={viewingMaterial?.text ?? ""} />
                </CardDetailModal>
              </section>
            )}
            {panel === "journal" && (
              <section className="table-stack table-journal-panel">
                <h2>Журнал стола</h2>
                {!table.archived && (
                  <form
                    className="table-journal-composer"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await command("event", {
                          text: journalText.trim(),
                          public: director ? journalPublic : true,
                          kind: "message",
                        })
                      )
                        setJournalText("");
                    }}
                  >
                    <label>
                      Запись
                      <textarea
                        className="textarea"
                        required
                        maxLength={4000}
                        rows={2}
                        placeholder="Итог сцены, находка или важное решение…"
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                      />
                    </label>
                    <div className="table-actions table-form-footer">
                      {director && (
                        <label className="table-check">
                          <input
                            type="checkbox"
                            checked={journalPublic}
                            onChange={(e) => setJournalPublic(e.target.checked)}
                          />
                          Видна игрокам
                        </label>
                      )}
                      <Button iconOnly icon="plus"
                        type="submit"
                        size="sm"
                        variant="primary"
                        disabled={busy || !journalText.trim()}
                      >
                        Добавить запись
                      </Button>
                    </div>
                  </form>
                )}
                {table.events.length === 0 && (
                  <p className="table-empty">
                    Здесь сохраняется история игры и записи участников.
                  </p>
                )}
                <ol className="table-journal">
                  {[...table.events].reverse().map((event) => (
                    <li key={event.id}>
                      <div className="muted">
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString("ru")}
                        </time>{" "}
                        ·{" "}
                        {table.members.find((m) => m.userId === event.actor)
                          ?.name ?? "Участник"}
                        {!event.public && " · Только ведущему"}
                      </div>
                      <p className="table-prose">{event.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {panel === "settings" && (
              <section className="table-stack table-settings">
                <h2>Управление столом</h2>
                <TableMemberSettings
                  key={table.id}
                  table={table}
                  characters={characters}
                  busy={busy}
                  command={command}
                  openHero={openHero}
                  error={state.error}
                />
                {director ? (
                  <>
                    <Card>
                      <h3>Приглашение</h3>
                      {supabaseEnabled && table.inviteCode ? (
                        <>
                          <label>
                            Ссылка
                            <input
                              className="input"
                              readOnly
                              value={`${location.origin}${location.pathname}#/tables/join/${encodeURIComponent(table.inviteCode)}`}
                              onFocus={(e) => e.target.select()}
                            />
                          </label>
                          <div className="table-actions">
                            <Button
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(
                                    `${location.origin}${location.pathname}#/tables/join/${encodeURIComponent(table.inviteCode!)}`,
                                  )
                                  .then(() => setMessage("Ссылка скопирована"))
                                  .catch(() =>
                                    state.setError("Не удалось скопировать ссылку. Выделите и скопируйте её из поля."),
                                  )
                              }
                              icon="copy"
                              iconOnly
                            >
                              Скопировать
                            </Button>
                            <Button
                              disabled={busy || table.archived}
                              onClick={() => void command("rotate-invite")}
                              icon="refresh"
                              iconOnly
                            >
                              Заменить ссылку
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="muted">
                          Приглашения доступны в облачном режиме.
                        </p>
                      )}
                    </Card>
                    <Card>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (tableName.trim())
                            void command("rename", { name: tableName.trim() });
                        }}
                      >
                        <label>
                          Название стола
                          <input
                            className="input"
                            value={tableName}
                            placeholder={table.name}
                            onChange={(e) => setTableName(e.target.value)}
                            maxLength={120}
                          />
                        </label>
                        <Button iconOnly icon="save"
                          type="submit"
                          disabled={busy || table.archived || !tableName.trim()}
                        >
                          Переименовать
                        </Button>
                      </form>
                    </Card>
                    <Card>
                      <h3>
                        {table.archived
                          ? "Архив стола"
                          : "Архивирование"}
                      </h3>
                      <p>
                        Архив сохраняет стол для просмотра и приостанавливает
                        совместные действия. Ведущий может восстановить его.
                      </p>
                      <div className="table-actions">
                        <Button
                          disabled={busy}
                          onClick={() => {
                            if (
                              table.archived ||
                              confirm(
                                "Архивировать стол и приостановить совместные действия?",
                              )
                            )
                              void command("archive", {
                                archived: !table.archived,
                              });
                          }}
                        >
                          {table.archived
                            ? "Восстановить стол"
                            : "Архивировать"}
                        </Button>
                      </div>
                      <section className="table-disclosure table-delete-section">
                        <h3>Удалить стол навсегда</h3>
                        <p className="muted">
                          Сцены, материалы и журнал будут удалены. Личные герои
                          останутся у владельцев.
                        </p>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Удалить стол навсегда вместе со сценами и журналом? Личные герои останутся у владельцев.",
                              )
                            )
                              void command("delete");
                          }}
                        >
                          Удалить стол
                        </Button>
                      </section>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <h3>Выйти из стола</h3>
                    <p>
                      Ваши герои и полученные предметы останутся у вас.
                      Ожидающие предложения будут отменены.
                    </p>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Выйти из стола?")) void command("leave");
                      }}
                    >
                      Выйти
                    </Button>
                  </Card>
                )}
              </section>
            )}
            </div>
          </div>
          </div>
          <div className={`table-live-board${canReplaceScene && sceneDropTarget ? " is-scene-drop-target" : ""}`}
            hidden={!!scene} inert={state.stale}
            onDragOver={(event) => {
              if (!canReplaceScene || !hasSceneDrag(event.dataTransfer)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setSceneDropTarget(true);
            }}
            onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setSceneDropTarget(false);
            }}
            onDrop={(event) => {
              setSceneDropTarget(false);
              if (!canReplaceScene || !hasSceneDrag(event.dataTransfer)) return;
              event.preventDefault();
              const target = readSceneDrop(event.dataTransfer);
              if (target) void launchScene(target, true);
            }}>
            <Suspense fallback={<p role="status">Загрузка полотна…</p>}>
              <TableBoard key={table.id} table={table} busy={busy || preparingDrop} needsRetry={state.needsRetry}
                gridObscured={drawerOpen} openHero={openHero}
                sceneHud={activeScene && <SceneTracker key={activeScene.id} scene={activeScene}
                  director={director} live showRoster={false} error={state.error}
                  table={table} onCombat={(type, payload) => void command(type, payload)}
                  busy={busy || table.archived || state.needsRetry} onChange={(s) => void command("save-scene", { scene: s })} />}
                command={(type, payload) => command(type, payload, table.id)} />
            </Suspense>
            {activeScene && (
              <BoardMonsterCards key={`roster-${activeScene.id}`} scene={activeScene} combat={table.combat}
                director={director} busy={busy || table.archived || state.needsRetry} error={state.error}
                command={(type, payload) => command(type, payload, table.id)} />
            )}
          </div>
          {scene && <div className="table-draft-board" ref={setLayoutHost} />}
        </>
      )}
      <CardDetailModal open={!!table && exitOpen} onClose={() => setExitOpen(false)} title="Выйти из стола?"
        className="table-dialog" footer={<>
          <Button onClick={() => setExitOpen(false)}>Отмена</Button>
          <Button variant="primary" onClick={() => {
            setExitOpen(false);
            state.select(null);
          }}>Выйти</Button>
        </>}>
        <p>{sceneDirty ? "Вы вернётесь к списку столов. Несохранённые изменения сцены будут сброшены." : "Вы вернётесь к списку столов."}</p>
      </CardDetailModal>
      <CardDetailModal
        open={!state.loading && !!lobbyAction}
        onClose={closeLobbyAction}
        title={
          lobbyAction === "create" ? "Новый стол" : "Присоединиться к столу"
        }
        className="table-dialog"
      >
        {state.error && (
          <p className="table-error" role="alert">
            {state.error}
          </p>
        )}
        {lobbyAction === "create" && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await command(
                  "create",
                  {
                    name: tableName.trim(),
                    memberName: memberName.trim() || "Ведущий",
                  },
                  null,
                );
                if (result) closeLobbyAction();
              }}
            >
              <label>
                Название стола
                <input
                  className="input"
                  required
                  maxLength={120}
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Хроники Железной долины"
                />
              </label>
              <label>
                Ваше имя за столом
                <input
                  className="input"
                  maxLength={80}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Как вас знают игроки"
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !tableName.trim()}
              >
                Создать
              </Button>
            </form>
          </>
        )}
        {(lobbyAction === "join" || lobbyAction === "invite") && supabaseEnabled && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const code = invite.trim().split("/join/").pop() ?? "";
                const result = await command(
                  "join",
                  {
                    inviteCode: code,
                    memberName: memberName.trim() || "Игрок",
                  },
                  null,
                );
                if (result) closeLobbyAction();
              }}
            >
              <label>
                Ссылка или код приглашения
                <input
                  className="input"
                  required
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                />
              </label>
              <label>
                Ваше имя
                <input
                  className="input"
                  required
                  maxLength={80}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                />
              </label>
              <p className="muted">
                Героя можно выбрать или создать после вступления.
              </p>
              <Button type="submit" disabled={busy || !invite.trim()}>
                Вступить
              </Button>
            </form>
          </>
        )}
      </CardDetailModal>
    </div>
  );
}
