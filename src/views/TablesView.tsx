import { useCallback, useEffect, useState } from "react";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { Button, Card, Select } from "../components/ui";
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
import type {
  DirectorTemplate,
  TableMaterial,
  TableScene,
  TableSnapshot,
} from "../lib/tables/types";
import { useStorageScope } from "../state/StorageScope";
import { useTables } from "../state/useTables";
import { TableMembers } from "./tables/TableMembers";
import { TableItems } from "./tables/TableItems";
import { SceneEditor } from "./tables/SceneEditor";
import { SceneTracker } from "./tables/SceneTracker";
import "./tables/Tables.css";

const PANELS = {
  group: "Группа",
  scenes: "Сцены",
  materials: "Материалы",
  items: "Предметы",
  journal: "Журнал",
  settings: "Управление",
};
type Panel = keyof typeof PANELS;
const SCENE_NAMES: Record<TableScene["kind"], string> = {
  encounter: "Бой",
  negotiation: "Переговоры",
  montage: "Монтаж",
};

export function TablesView({
  characters,
  beforeCommand,
  openHero,
  refreshHero,
}: {
  characters: CharacterSummary[];
  beforeCommand: () => Promise<void>;
  openHero: (id: string) => void;
  refreshHero: () => Promise<void>;
}) {
  const state = useTables();
  const actorId = useStorageScope();
  const { table, busy, command: send } = state;
  const [lobbyAction, setLobbyAction] = useState<"create" | "join" | null>(
    () => (location.hash.includes("/join/") ? "join" : null),
  );
  const [panel, setPanel] = useState<Panel>("group");
  const [tableName, setTableName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [invite, setInvite] = useState(() => {
    const match = location.hash.match(/^#\/tables\/join\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  });
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
  const director = table?.ownerId === table?.actorId;
  useEffect(() => {
    void tableRepository
      .templates()
      .then(setTemplates)
      .catch((e) => state.setError(e.message));
  }, []);
  useEffect(() => {
    setScene(null);
    setSelectedScene("");
    setMaterial({ id: "", title: "", text: "", public: false });
    setMaterialEditing(false);
    setPanel(supabaseEnabled ? "group" : "scenes");
    if (table?.id) setLobbyAction(null);
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

  return (
    <div
      className={`tables-page${panel === "scenes" && (scene || selectedScene) ? " is-scene-focused" : ""}`}
    >
      {!scene && <header className="table-page-header">
        <div>
          <h1>{table?.name ?? "Мои столы"}</h1>
          {table?.archived && (
            <p className="muted">Архив · совместные действия приостановлены</p>
          )}
        </div>
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
            { title: "Я ведущий", tables: state.tables.filter((row) => row.ownerId === actorId) },
            { title: "Я игрок", tables: state.tables.filter((row) => row.ownerId !== actorId) },
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
          <CardDetailModal
            open={!!lobbyAction}
            onClose={() => setLobbyAction(null)}
            title={
              lobbyAction === "join" ? "Присоединиться к столу" : "Новый стол"
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
                    await command(
                      "create",
                      {
                        name: tableName.trim(),
                        memberName: memberName.trim() || "Ведущий",
                      },
                      null,
                    );
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
            {lobbyAction === "join" && supabaseEnabled && (
              <>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const code = invite.trim().split("/join/").pop() ?? "";
                    await command(
                      "join",
                      {
                        inviteCode: code,
                        memberName: memberName.trim() || "Игрок",
                      },
                      null,
                    );
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
        </>
      ) : !table ? (
        <p className="muted">
          {state.stale
            ? "Стол пока недоступен. Проверьте соединение."
            : "Загрузка стола…"}
        </p>
      ) : (
        <>
          {!scene && <div className="table-navigation">
            <Select className="table-mobile-navigation" aria-label="Раздел стола" value={panel} onChange={(event) => setPanel(event.target.value as Panel)}>
              {Object.entries(PANELS).map(([key, label]) => <option key={key} value={key}>{label}{key === "items" && table.offers.some((offer) => offer.toUserId === table.actorId && offer.status === "pending") ? " · Новое" : ""}</option>)}
            </Select>
            <nav className="table-tabs section-tabs" aria-label="Разделы стола">
              {Object.entries(PANELS).map(([key, label]) => (
                <button
                  key={key}
                  className={panel === key ? "is-active" : ""}
                  aria-current={panel === key ? "page" : undefined}
                  onClick={() => setPanel(key as Panel)}
                >
                  {label}
                  {key === "items" &&
                  table.offers.some(
                    (o) =>
                      o.toUserId === table.actorId && o.status === "pending",
                  )
                    ? " •"
                    : ""}
                </button>
              ))}
            </nav>
            <SaveIndicator status={state.stale ? "error" : busy ? "saving" : "saved"} error={state.stale ? "Нет связи" : ""} />
          </div>}
          <div className="table-panel" inert={state.stale}>
            {panel === "group" && (
              <TableMembers
                table={table}
                characters={characters}
                busy={busy}
                command={command}
                openHero={openHero}
                error={state.error}
              />
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
                        director={director}
                        disabled={busy || table.archived}
                        onOpen={(s) =>
                          s.status === "prepared" && director && !table.archived
                            ? editScene(s)
                            : setSelectedScene(s.id)
                        }
                        onEdit={editScene}
                        onStart={async (s) => {
                          const result = await command("start-scene", {
                            sceneId: s.id,
                          });
                          if (result) setSelectedScene(s.id);
                        }}
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
                        busy={busy || table.archived}
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
                    disabled={table.archived || busy}
                    onAdd={(t) => editScene({ ...structuredClone(t.scene!), id: crypto.randomUUID(), status: "prepared", published: false })}
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
        </>
      )}
    </div>
  );
}
