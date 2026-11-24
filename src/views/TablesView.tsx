import { storageMessage } from "../i18n/storage-messages";
import { useLocale } from "../i18n/locale";
import { Activity, lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { TableJournal } from "./tables/TableJournal";
import { SceneEditor } from "./tables/SceneEditor";
import { SceneTracker } from "./tables/SceneTracker";
import { BoardMonsterCards } from "./tables/BoardMonsterCards";
import "./tables/Tables.css";

const tablePanels = (t: (ru: string, en: string) => string) => ({
  reference: { label: t("Справочник", "Reference"), icon: "library" },
  scenes: { label: t("Сцены", "Scenes"), icon: "sword" },
  companions: { label: t("Спутники", "Companions"), icon: "users" },
  materials: { label: t("Материалы", "Handouts"), icon: "sheet" },
  items: { label: t("Предметы", "Items"), icon: "inventory" },
  journal: { label: t("Журнал", "Journal"), icon: "book" },
  settings: { label: t("Управление", "Settings"), icon: "settings" },
} satisfies Record<string, { label: string; icon: IconName }>);
const TableBoard = lazy(() => import("./tables/TableBoard").then(module => ({ default: module.TableBoard })));
const SceneLayoutEditor = lazy(() => import("./tables/SceneLayoutEditor").then(module => ({ default: module.SceneLayoutEditor })));
const TableReference = lazy(() => import("./tables/TableReference").then(module => ({ default: module.TableReference })));
const TableCompanions = lazy(() => import("./tables/TableCompanions").then(module => ({ default: module.TableCompanions })));
type Panel = keyof ReturnType<typeof tablePanels>;
const sceneNames = (t: (ru: string, en: string) => string): Record<TableScene["kind"], string> => ({
  encounter: t("Бой", "Encounter"),
  negotiation: t("Переговоры", "Negotiation"),
  montage: t("Монтаж", "Montage"),
});

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
  const { t, locale } = useLocale();
  const errorMessage = storageMessage(state.error, locale);
  const panels = tablePanels(t);
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
          e instanceof Error ? e.message : t("Не удалось сохранить героя", "Couldn’t save the hero"),
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
    setMessage(t("Заготовка сохранена в вашей библиотеке", "Template saved to your library"));
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
        t("Эту сцену изменили на другом устройстве. Ваш черновик сохранён на экране; сохраните его в библиотеку или откройте свежую версию.", "This scene changed on another device. Your draft is still open. Save it to your library or open the latest version."),
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
      if (sceneDirty && !confirm(t("Закрыть подготовку без сохранения?", "Close scene preparation without saving?"))) return;
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
      setError(error instanceof Error ? error.message : t("Не удалось запустить сцену", "Couldn’t start the scene"));
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
      setError(error instanceof Error ? error.message : t("Не удалось открыть заготовку", "Couldn’t open the template"));
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
        <h1>{t("Мои столы", "My tables")}</h1>
        {state.selected && (
          <Button iconOnly icon="arrow-left" size="sm" variant="ghost" onClick={() => state.select(null)}>
            {t("Все столы", "All tables")}
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
              {t("Создать стол", "Create a table")}
            </Button>
            {supabaseEnabled && (
              <Button onClick={() => setLobbyAction("join")}>
                {t("Присоединиться", "Join a table")}
              </Button>
            )}
          </div>
        )}
      </header>}
      {table?.archived && <p className="table-archive-state">{t("Стол в архиве", "Table archived")}</p>}
      {state.error && (
        <div className="table-notice table-error" role="alert">
          {errorMessage}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => state.setError("")}
            icon="close"
            iconOnly
          >
            {t("Закрыть сообщение", "Dismiss message")}
          </Button>
        </div>
      )}
      {state.needsRetry && (
        <div className="table-notice">
          <p>
            {t("Подтверждение действия не получено. Повторный запрос безопасен: действие выполнится один раз.", "No confirmation received. You can retry safely. The action will only run once.")}
          </p>
          <Button disabled={busy} onClick={() => void state.retryCommand()}>
            {t("Повторить подтверждение", "Retry confirmation")}
          </Button>
        </div>
      )}
      <Toasts toasts={message ? [{ id: 1, message, tone: "success" }] : []} onDismiss={() => setMessage("")} />
      {state.stale && (
        <p className="table-notice" role="status">
          {t("Связь потеряна. Показаны последние полученные данные", "Connection lost. Showing the most recent data")}
          {state.lastRead &&
            ` ${t("на", "as of")} ${new Date(state.lastRead).toLocaleTimeString(locale)}`}
          . {t("Действия станут доступны после восстановления связи.", "Actions will be available when you reconnect.")}
        </p>
      )}
      {state.loading ? (
        <LoadingScreen label={t("Загрузка столов", "Loading tables")} />
      ) : !state.selected ? (
        <>
          {state.tables.length === 0 && (
            <div className="table-empty">
              <strong>{t("Ваш первый стол", "Your first table")}</strong>
              <p>
                {t("Создайте место для своей кампании или присоединитесь по приглашению ведущего.", "Create a table for your campaign or join with an invitation from your Director.")}
              </p>
            </div>
          )}
          {([
            { title: t("Я ведущий", "Tables I run"), tables: state.tables.filter((row) => row.ownerId === (row.actorId ?? actorId)) },
            { title: t("Я игрок", "Tables I play at"), tables: state.tables.filter((row) => row.ownerId !== (row.actorId ?? actorId)) },
          ]).filter((group) => group.tables.length > 0).map((group) => (
            <section className="table-lobby-section" key={group.title} aria-label={group.title}>
              <h2>{group.title}</h2>
              <div className="table-card-grid table-lobby-grid">
                {group.tables.map((row) => (
                  <Card key={row.id} className="table-lobby-card">
                    {row.archived && <p className="eyebrow">{t("Архив", "Archive")}</p>}
                    <h3>{row.name}</h3>
                    <p className="muted">{t("Участников:", "Members:")} {row.memberCount}</p>
                    <Button
                      size="sm"
                      onClick={() => state.select(row.id)}
                      icon="login"
                      iconOnly
                    >
                      {t("Войти в стол", "Open table")}
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
            ? t("Стол пока недоступен. Проверьте соединение.", "This table is unavailable. Check your connection.")
            : t("Загрузка стола…", "Loading table…")}
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
          <nav className="table-rail" ref={rail} aria-label={t("Разделы стола", "Table sections")}>
            {(Object.keys(panels) as Panel[]).filter(key => director || key !== "scenes").map(key => {
              const { label, icon } = panels[key];
              const active = drawerOpen && panel === key;
              const pending = key === "items" && table.offers.some(offer => offer.toUserId === table.actorId && offer.status === "pending");
              return <Button key={key} iconOnly icon={icon} variant={active ? "soft" : "ghost"}
                aria-label={pending ? `${label} · ${t("Новое предложение", "New offer")}` : label} aria-expanded={active} aria-controls={drawerId}
                data-table-panel={key} data-notification={pending || undefined}
                onClick={() => switchPanel(key)}>{label}</Button>;
            })}
            <div className="table-rail-footer">
              <SaveIndicator status={state.stale ? "error" : busy ? "saving" : "saved"} error={state.stale ? t("Нет связи", "Offline") : ""} />
              <Button icon="logout" iconOnly variant="ghost" onClick={() => setExitOpen(true)}>{t("Выйти из стола", "Leave table")}</Button>
            </div>
          </nav>
          <div id={drawerId} className="table-panel table-drawer" inert={!drawerOpen || state.stale}>
            <div className="table-drawer-resize" role="separator" aria-label={t("Ширина панели", "Panel width")} aria-orientation="vertical" tabIndex={0}
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
              <Button size="sm" iconOnly icon="chevron-right" variant="ghost" onClick={() => collapseDrawer(true)}>{t("Свернуть панель", "Collapse panel")}</Button>
            </div>
            <div ref={drawerContent} className="table-drawer-content" tabIndex={0} role="region" aria-label={panel ? panels[panel].label : t("Содержимое панели", "Panel contents")}>
            {panel === "reference" && (
              <Suspense fallback={<p role="status">{t("Загрузка справочника…", "Loading reference…")}</p>}>
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
                commandError={errorMessage}
              />
            )}
            {panel === "scenes" && (
              <section className={`table-scenes-layout${director && !scene && !selectedScene ? " has-library" : ""}`}>
                <div className="table-stack">
                {!scene && !selectedScene && (
                  <div className="table-section-heading">
                    <h2>{t("Сцены", "Scenes")}</h2>
                    {director && !table.archived && (
                      <div className="table-actions">
                        {Object.entries(sceneNames(t)).map(([kind, label]) => (
                          <Button
                            key={kind}
                            onClick={() =>
                              editScene(
                                createScene(
                                  kind as TableScene["kind"],
                                  `${t("Новая сцена", "New scene")}: ${label.toLowerCase()}`,
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
                            t("Вернуться к списку без сохранения черновика?", "Return to the list without saving this draft?"),
                          )
                        ) {
                          setScene(null);
                          setSelectedScene("");
                        }
                      }}
                    >
                      {t("Список сцен", "Scene list")}
                    </Button>
                    <SaveIndicator status={state.stale ? "error" : busy ? "saving" : "saved"} error={state.stale ? t("Нет связи", "Offline") : ""} />
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
                        {t("Подготовка сцены", "Scene preparation")}
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
                        if (!sceneDirty || confirm(t("Отменить изменения сцены?", "Discard your changes to this scene?"))) {
                          setSceneDirty(false);
                          setScene(null);
                        }
                      }}
                      onDirtyChange={setSceneDirty}
                      renderLayout={(draft, update) => layoutHost && createPortal(
                        <Suspense fallback={null}>
                          <SceneLayoutEditor table={table} layout={draft.layout} busy={busy || table.archived}
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
                          if (await command("save-scene", { scene: copy })) setMessage(t("Сцена скопирована", "Scene copied"));
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
                          if (confirm(t(`Удалить сцену «${s.name}»?`, `Delete scene “${s.name}”?`)))
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
                        error={errorMessage}
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
                    onDelete={async (template) => {
                      if (!confirm(t("Удалить заготовку из личной библиотеки?", "Delete this template from your library?"))) return;
                      try {
                        await tableRepository.deleteTemplate(template.id);
                        setTemplates((old) => old.filter((x) => x.id !== template.id));
                      } catch (e) { state.setError((e as Error).message); }
                    }}
                  />
                )}
              </section>
            )}
            {panel === "materials" && (
              <section className="table-stack table-materials">
                <div className="table-section-heading">
                  <h2>{t("Материалы", "Handouts")}</h2>
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
                      {t("Добавить материал", "Add handout")}
                    </Button>
                  )}
                </div>
                {table.materials.length === 0 && (
                  <div className="table-empty">
                    <strong>{t("Пока нет материалов", "No handouts yet")}</strong>
                    <p>
                      {director
                        ? t("Сохраните описание места, улику или заметку. Игроки увидят только раскрытые материалы.", "Save a location description, clue, or note. Players see handouts when you share them.")
                        : t("Здесь появятся материалы, которыми поделится ведущий.", "Handouts your Director shares will appear here.")}
                    </p>
                  </div>
                )}
                {director && !table.archived && (
                  <CardDetailModal
                    open={materialEditing}
                    onClose={() => setMaterialEditing(false)}
                    title={material.id ? t("Изменить материал", "Edit handout") : t("Новый материал", "New handout")}
                    className="table-dialog"
                    wide
                  >
                    {state.error && <p role="alert">{errorMessage}</p>}
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
                        {t("Название", "Title")}
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
                        <span className="field-label">{t("Текст", "Text")}</span>
                        <MarkdownEditor
                          disabled={busy || table.archived}
                          aria-label={t("Текст материала", "Handout text")}
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
                        {t("Открыть игрокам", "Share with players")}
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
                        {t("Сохранить материал", "Save handout")}
                      </Button>
                    </form>
                  </CardDetailModal>
                )}
                {table.materials.map((m) => (
                  <Card key={m.id} className="table-material-card">
                    <div className="table-section-heading"><h3>{m.title}</h3><span className="table-badge">{m.public ? t("Виден игрокам", "Visible to players") : t("Только ведущему", "Director only")}</span></div>
                    <div className="table-material-excerpt"><MarkdownPreview text={m.text} /></div>
                    <div className="table-actions"><Button icon="eye" iconOnly size="sm" variant="ghost" onClick={() => setViewingMaterial(m)}>{t("Прочитать материал", "Read handout")}</Button>
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
                          {t("Изменить", "Edit")}
                        </Button>
                        <Button
                          iconOnly
                          icon={m.public ? "eye-off" : "users"}
                          aria-pressed={m.public}
                          aria-label={`${m.public ? t("Скрыть", "Hide") : t("Раскрыть", "Reveal") } ${t("материал", "handout")}: ${m.title}`}
                          title={`${m.public ? t("Скрыть", "Hide") : t("Раскрыть", "Reveal") } ${t("материал", "handout")}: ${m.title}`}
                          disabled={busy}
                          onClick={() =>
                            void command("save-material", {
                              material: { ...m, public: !m.public },
                            })
                          }
                        >
                          {m.public ? t("Скрыть", "Hide") : t("Раскрыть", "Reveal")}
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            if (confirm(t("Удалить материал?", "Delete handout?")))
                              void command("delete-material", {
                                materialId: m.id,
                              });
                          }}
                          icon="trash"
                          iconOnly
                        >
                          {t("Удалить", "Delete")}
                        </Button>
                      </>
                    )}
                    </div>
                  </Card>
                ))}
                <CardDetailModal open={!!viewingMaterial} onClose={() => setViewingMaterial(null)} title={viewingMaterial?.title ?? t("Материал", "Handout")} className="table-dialog" wide>
                  <MarkdownPreview text={viewingMaterial?.text ?? ""} />
                </CardDetailModal>
              </section>
            )}
            <Activity mode={panel === "journal" ? "visible" : "hidden"}>
              <TableJournal key={table.id} table={table} busy={busy || state.needsRetry || state.stale}
                command={command} commandError={errorMessage} />
            </Activity>
            {panel === "companions" && <Suspense fallback={<p role="status">{t("Загрузка спутников…", "Loading companions…")}</p>}>
              <TableCompanions key={table.id} table={table} busy={busy || state.needsRetry || state.stale}
                command={command} commandError={errorMessage} />
            </Suspense>}
            {panel === "settings" && (
              <section className="table-stack table-settings">
                <h2>{t("Управление столом", "Table settings")}</h2>
                <TableMemberSettings
                  key={table.id}
                  table={table}
                  characters={characters}
                  busy={busy}
                  command={command}
                  openHero={openHero}
                  error={errorMessage}
                />
                {director ? (
                  <>
                    <Card>
                      <h3>{t("Приглашение", "Invitation")}</h3>
                      {supabaseEnabled && table.inviteCode ? (
                        <>
                          <label>
                            {t("Ссылка", "Link")}
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
                                  .then(() => setMessage(t("Ссылка скопирована", "Link copied")))
                                  .catch(() =>
                                    state.setError(t("Не удалось скопировать ссылку. Выделите и скопируйте её из поля.", "Couldn’t copy the link. Select it in the text field and copy it.")),
                                  )
                              }
                              icon="copy"
                              iconOnly
                            >
                              {t("Скопировать", "Copy")}
                            </Button>
                            <Button
                              disabled={busy || table.archived}
                              onClick={() => void command("rotate-invite")}
                              icon="refresh"
                              iconOnly
                            >
                              {t("Заменить ссылку", "Replace link")}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="muted">
                          {t("Приглашения доступны в облачном режиме.", "Invitations are available in cloud mode.")}
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
                          {t("Название стола", "Table name")}
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
                          {t("Переименовать", "Rename")}
                        </Button>
                      </form>
                    </Card>
                    <Card>
                      <h3>
                        {table.archived
                          ? t("Архив стола", "Table archive")
                          : t("Архивирование", "Archive table")}
                      </h3>
                      <p>
                        {t("Архив сохраняет стол для просмотра и приостанавливает совместные действия. Ведущий может восстановить его.", "Archived tables stay available to read. The Director can restore a table to resume play.")}
                      </p>
                      <div className="table-actions">
                        <Button
                          disabled={busy}
                          onClick={() => {
                            if (
                              table.archived ||
                              confirm(
                                t("Архивировать стол и приостановить совместные действия?", "Archive this table and pause play?"),
                              )
                            )
                              void command("archive", {
                                archived: !table.archived,
                              });
                          }}
                        >
                          {table.archived
                            ? t("Восстановить стол", "Restore table")
                            : t("Архивировать", "Archive")}
                        </Button>
                      </div>
                      <section className="table-disclosure table-delete-section">
                        <h3>{t("Удалить стол навсегда", "Delete table permanently")}</h3>
                        <p className="muted">
                          {t("Сцены, материалы и журнал будут удалены. Личные герои останутся у владельцев.", "Deleting the table removes its scenes, handouts, and journal. Players keep their heroes.")}
                        </p>
                        <Button
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                t("Удалить стол навсегда вместе со сценами и журналом? Личные герои останутся у владельцев.", "Permanently delete this table, its scenes, and its journal? Players will keep their heroes."),
                              )
                            )
                              void command("delete");
                          }}
                        >
                          {t("Удалить стол", "Delete table")}
                        </Button>
                      </section>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <h3>{t("Выйти из стола", "Leave table")}</h3>
                    <p>
                      {t("Ваши герои и полученные предметы останутся у вас. Ожидающие предложения будут отменены.", "You will keep your heroes and items. Pending offers will be canceled.")}
                    </p>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(t("Выйти из стола?", "Leave this table?"))) void command("leave");
                      }}
                    >
                      {t("Выйти", "Leave")}
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
            <Suspense fallback={<p role="status">{t("Загрузка полотна…", "Loading the board…")}</p>}>
              <TableBoard key={table.id} table={table} busy={busy || preparingDrop} needsRetry={state.needsRetry}
                openHero={openHero}
                sceneHud={activeScene && <SceneTracker key={activeScene.id} scene={activeScene}
                  director={director} live showRoster={false} error={errorMessage}
                  table={table} onCombat={(type, payload) => void command(type, payload)}
                  busy={busy || table.archived || state.needsRetry} onChange={(s) => void command("save-scene", { scene: s })} />}
                command={(type, payload) => command(type, payload, table.id)} />
            </Suspense>
            {activeScene && (
              <BoardMonsterCards key={`roster-${activeScene.id}`} scene={activeScene} combat={table.combat}
                director={director} busy={busy || table.archived || state.needsRetry} error={errorMessage}
                command={(type, payload) => command(type, payload, table.id)} />
            )}
          </div>
          {scene && <div className="table-draft-board" ref={setLayoutHost} />}
        </>
      )}
      <CardDetailModal open={!!table && exitOpen} onClose={() => setExitOpen(false)} title={t("Выйти из стола?", "Leave this table?")}
        className="table-dialog" footer={<>
          <Button onClick={() => setExitOpen(false)}>{t("Отмена", "Cancel")}</Button>
          <Button variant="primary" onClick={() => {
            setExitOpen(false);
            state.select(null);
          }}>{t("Выйти", "Leave")}</Button>
        </>}>
        <p>{sceneDirty ? t("Вы вернётесь к списку столов. Несохранённые изменения сцены будут сброшены.", "Return to the table list and discard unsaved scene changes.") : t("Вы вернётесь к списку столов.", "Return to the table list.")}</p>
      </CardDetailModal>
      <CardDetailModal
        open={!state.loading && !!lobbyAction}
        onClose={closeLobbyAction}
        title={
          lobbyAction === "create" ? t("Новый стол", "New table") : t("Присоединиться к столу", "Join a table")
        }
        className="table-dialog"
      >
        {state.error && (
          <p className="table-error" role="alert">
            {errorMessage}
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
                    memberName: memberName.trim() || t("Ведущий", "Director"),
                  },
                  null,
                );
                if (result) closeLobbyAction();
              }}
            >
              <label>
                {t("Название стола", "Table name")}
                <input
                  className="input"
                  required
                  maxLength={120}
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder={t("Хроники Железной долины", "Chronicles of the Iron Valley")}
                />
              </label>
              <label>
                {t("Ваше имя за столом", "Your name at the table")}
                <input
                  className="input"
                  maxLength={80}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder={t("Как вас знают игроки", "Name other players will see")}
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !tableName.trim()}
              >
                {t("Создать", "Create")}
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
                    memberName: memberName.trim() || t("Игрок", "Player"),
                  },
                  null,
                );
                if (result) closeLobbyAction();
              }}
            >
              <label>
                {t("Ссылка или код приглашения", "Invitation link or code")}
                <input
                  className="input"
                  required
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                />
              </label>
              <label>
                {t("Ваше имя", "Your name")}
                <input
                  className="input"
                  required
                  maxLength={80}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                />
              </label>
              <p className="muted">
                {t("Героя можно выбрать или создать после вступления.", "You can choose or create a hero after you join.")}
              </p>
              <Button type="submit" disabled={busy || !invite.trim()}>
                {t("Вступить", "Join")}
              </Button>
            </form>
          </>
        )}
      </CardDetailModal>
    </div>
  );
}
