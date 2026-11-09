import { lazy, Suspense, useState } from "react";
import { useMediaQuery } from "../../lib/hooks";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button, Card } from "../../components/ui";
import { healthLabel, normalizeScene, sceneId } from "../../lib/tables/scenes";
import type { SceneCombatant, TableScene } from "../../lib/tables/types";
import "./Scenes.css";

const RuleArticleReader = lazy(() =>
  import("../../components/rules/RuleArticleReader").then((m) => ({
    default: m.RuleArticleReader,
  })),
);
const turnNames = { ready: "Готов", active: "Ходит", done: "Ход завершён" };
const nextTurn = { ready: "active", active: "done", done: "ready" } as const;

export function SceneTracker({
  scene,
  director,
  onChange,
  busy = false,
  error = "",
}: {
  scene: TableScene;
  director: boolean;
  onChange: (scene: TableScene) => void;
  busy?: boolean;
  error?: string;
}) {
  const [editingCombatant, setEditingCombatant] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const narrow = useMediaQuery("(max-width: 700px)");
  const [source, setSource] = useState<{
    id: string;
    name: string;
    minion?: boolean;
  } | null>(null);
  const change = (patch: Partial<TableScene>) => {
    const next = normalizeScene({ ...scene, ...patch });
    if (director && !busy && JSON.stringify(next) !== JSON.stringify(scene))
      onChange(next);
  };
  const combatant = (id: string, patch: Partial<SceneCombatant>) =>
    change({
      combatants: scene.combatants.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
  const visible = scene.combatants.filter((c) => director || c.revealed);
  const counters = scene.counters.filter((c) => director || c.public);
  const resetTurns = () =>
    scene.combatants.map((c) => ({
      ...c,
      turn: "ready" as const,
      reactionUsed: false,
    }));
  const managementControls = (
            <div className="scene-actions">
              {scene.status === "active" && (
                <Button iconOnly={!narrow} icon="pause"
                  size="sm"
                  disabled={busy}
                  onClick={() => change({ status: "prepared" })}
                >
                  Приостановить
                </Button>
              )}
              <Button
                size="sm"
                icon="refresh"
                iconOnly={!narrow}
                disabled={busy}
                onClick={() => change({ combatants: resetTurns() })}
              >
                Сбросить ходы и реакции
              </Button>
              {scene.status !== "finished" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Завершить сцену? Её можно будет продолжить позднее.",
                      )
                    )
                      change({ status: "finished" });
                  }}
                >
                  Завершить сцену
                </Button>
              )}
              {scene.kind === "encounter" && (
                <Button iconOnly={!narrow}
                  size="sm"
                  variant="ghost"
                  icon="book"
                  onClick={() =>
                    setSource({
                      id: "monsters.rule.monster.malice",
                      name: "Раздор",
                    })
                  }
                >
                  Правила Раздора
                </Button>
              )}
            </div>
  );
  return (
    <section
      className={`scene-ui scene-tracker scene-kind-${scene.kind}`}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          event.target.type !== "checkbox"
        ) {
          event.preventDefault();
          event.target.blur();
        }
      }}
    >
      <header className="table-section-heading">
        <div className="scene-tracker-title">
          <span className="table-badge">
            {
              {
                encounter: "Бой",
                negotiation: "Переговоры",
                montage: "Монтаж",
              }[scene.kind]
            }{" "}
            ·{" "}
            {
              { prepared: "На паузе", active: "Идёт", finished: "Завершена" }[
                scene.status
              ]
            }
          </span>
          <h2>{scene.name}</h2>
        </div>
        {director && (
          <div className="scene-actions">
            <Button icon="sheet" iconOnly size="sm" variant="ghost" onClick={() => setEditingNotes(true)}>Заметки ведущего</Button>
            {narrow && <Button icon="more" iconOnly size="sm" variant="ghost" onClick={() => setManagementOpen(true)}>Управление сценой</Button>}
            <span className="scene-visibility-status">
              {scene.published ? "Видна игрокам" : "Скрыта от игроков"}
            </span>
            <Button
              iconOnly
              icon={scene.published ? "eye-off" : "eye"}
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-pressed={scene.published}
              aria-label={
                scene.published
                  ? "Скрыть сцену от игроков"
                  : "Опубликовать сцену"
              }
              title={
                scene.published
                  ? "Скрыть сцену от игроков"
                  : "Показать сцену игрокам"
              }
              onClick={() => change({ published: !scene.published })}
            >
              {scene.published ? "Скрыть от игроков" : "Показать игрокам"}
            </Button>
          </div>
        )}
      </header>
      {director && !scene.published && (
        <p className="muted small">
          Сцена скрыта от игроков. Раскрытые участники появятся после
          публикации.
        </p>
      )}
      {scene.objective && (
        <p className="scene-objective">
          <strong>Цель:</strong> {scene.objective}
        </p>
      )}
      {scene.description && (
        <p className="table-prose muted">{scene.description}</p>
      )}
      <div className="scene-toolbar">
        <strong className="scene-round">Раунд {scene.round}</strong>
        {director ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                change({
                  initiative:
                    scene.initiative === "heroes" ? "enemies" : "heroes",
                })
              }
              title="Сменить сторону"
            >
              {scene.initiative === "heroes" ? "Ход героев" : "Ход противников"}
            </Button>
            {scene.status === "active" ? (
              <Button iconOnly icon="chevron-right"
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() =>
                  change({ round: scene.round + 1, combatants: resetTurns() })
                }
              >
                Следующий раунд
              </Button>
            ) : (
              <Button iconOnly icon="play"
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => change({ status: "active" })}
              >
                Продолжить сцену
              </Button>
            )}
            {scene.kind === "encounter" && (
              <label className="scene-inline-number">
                Раздор
                <input
                  className="input"
                  aria-label="Раздор"
                  type="number"
                  min="0"
                  disabled={busy}
                  key={`malice-${scene.malice}`}
                  defaultValue={scene.malice ?? 0}
                  onBlur={(e) => change({ malice: Number(e.target.value) })}
                />
              </label>
            )}
          </>
        ) : (
          <span className="muted">
            {scene.initiative === "heroes" ? "Ход героев" : "Ход противников"}
          </span>
        )}
      </div>
      {director && (
        <>
          <CardDetailModal open={editingNotes} onClose={() => setEditingNotes(false)} title="Заметки ведущего" className="table-dialog">
            {error && <p role="alert">{error}</p>}
            <label>
              Заметки ведущего
              <textarea
                className="textarea"
                disabled={busy}
                key={scene.directorNotes}
                defaultValue={scene.directorNotes ?? ""}
                onBlur={(e) => change({ directorNotes: e.target.value })}
              />
            </label>
          </CardDetailModal>
            {!narrow && managementControls}
            <CardDetailModal open={narrow && managementOpen} onClose={() => setManagementOpen(false)} title="Управление сценой" className="table-dialog scene-management-modal">
              {error && <p role="alert">{error}</p>}
              {managementControls}
            </CardDetailModal>
        </>
      )}
      {counters.length > 0 && (
        <div className="scene-counters" aria-label="Счётчики сцены">
          {counters.map((c) => (
            <div className="scene-counter" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                {director && (
                  <span className="muted">
                    {c.public ? "Общий" : "Только ведущему"}
                  </span>
                )}
              </div>
              <div className="scene-counter-controls">
                {director && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || c.value <= 0}
                    icon="minus"
                    iconOnly
                    title={`Уменьшить: ${c.name}`}
                    aria-label={`Уменьшить: ${c.name}`}
                    onClick={() =>
                      change({
                        counters: scene.counters.map((x) =>
                          x.id === c.id ? { ...x, value: x.value - 1 } : x,
                        ),
                      })
                    }
                  >
                    Уменьшить
                  </Button>
                )}
                <strong>
                  {c.value}
                  {c.max !== undefined && <small> / {c.max}</small>}
                </strong>
                {director && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || (c.max !== undefined && c.value >= c.max)}
                    icon="plus"
                    iconOnly
                    title={`Увеличить: ${c.name}`}
                    aria-label={`Увеличить: ${c.name}`}
                    onClick={() =>
                      change({
                        counters: scene.counters.map((x) =>
                          x.id === c.id ? { ...x, value: x.value + 1 } : x,
                        ),
                      })
                    }
                  >
                    Увеличить
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="table-section-heading">
        <h3>
          Участники <span className="muted">{visible.length}</span>
        </h3>
        {director && (
          <span className="muted small">
            Раскрыто: {visible.filter((c) => c.revealed).length}
          </span>
        )}
      </div>
      {!visible.length && (
        <p className="table-empty">
          {director
            ? "Добавьте существ в подготовке сцены."
            : "Ведущий пока не раскрыл участников сцены."}
        </p>
      )}
      <div className="scene-roster">
        {visible.map((c) => (
          <Card
            key={c.id}
            aria-label={`Участник: ${c.name}`}
            className={`scene-combatant is-${c.turn}${director && !c.revealed ? " is-hidden" : ""}`}
          >
            <div className="scene-combatant-heading">
              <div className="scene-identity">
                <h4>{c.name}</h4>
                <span className="scene-health" data-health={c.health}>
                  {healthLabel(c.health)}
                </span>
                {director && (
                  <span className="muted small">
                    {[
                      c.organization,
                      c.count && c.count > 1 ? `${c.count} в отряде` : null,
                      c.faction === "ally" ? "Союзник" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {director && <span className="scene-visibility-status">{scene.published && c.revealed ? "Виден игрокам" : c.revealed ? "Раскрыт · сцена скрыта" : "Скрыт от игроков"}</span>}
              </div>
              <div className="scene-actions">
                {director ? (
                  <>
                    <Button icon="settings" iconOnly size="sm" variant="ghost" onClick={() => setEditingCombatant(c.id)} aria-label={`Настройки: ${c.name}`} title={`Настройки: ${c.name}`}>Настройки участника</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      aria-pressed={c.revealed}
                      iconOnly
                      icon={c.revealed ? "eye-off" : "eye"}
                      title={`${c.revealed ? "Скрыть" : "Раскрыть"}: ${c.name}`}
                      aria-label={`${c.revealed ? "Скрыть" : "Раскрыть"}: ${c.name}`}
                      onClick={() => combatant(c.id, { revealed: !c.revealed })}
                    >
                      {c.revealed ? "Скрыть" : "Раскрыть"}
                    </Button>
                    <Button
                      size="sm"
                      variant={c.turn === "active" ? "primary" : "default"}
                      disabled={busy}
                      aria-label={`${c.turn === "ready" ? "Начать ход" : c.turn === "active" ? "Завершить ход" : "Вернуть ход"}: ${c.name}`}
                      onClick={() =>
                        combatant(c.id, { turn: nextTurn[c.turn] })
                      }
                    >
                      {c.turn === "ready"
                        ? "Начать ход"
                        : c.turn === "active"
                          ? "Завершить ход"
                          : "Вернуть ход"}
                    </Button>
                  </>
                ) : (
                  <span className="scene-turn-label">{turnNames[c.turn]}</span>
                )}
              </div>
            </div>
            {director && (
              <div className="scene-combatant-vitals">
                {c.stamina !== undefined && (
                  <label className="scene-inline-number">
                    {/миньон|minion/i.test(c.organization)
                      ? "Запас отряда"
                      : "Выносливость"}
                    <input
                      className="input"
                      aria-label={`Выносливость: ${c.name}`}
                      type="number"
                      min="0"
                      disabled={busy}
                      key={c.stamina}
                      defaultValue={c.stamina}
                      onBlur={(e) =>
                        combatant(c.id, { stamina: Number(e.target.value) })
                      }
                    />
                    <span className="muted">/ {c.maxStamina ?? "—"}</span>
                  </label>
                )}
                {(c.temporaryStamina ?? 0) > 0 && (
                  <span className="table-badge">
                    +{c.temporaryStamina} врем.
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-disabled={busy}
                  aria-pressed={c.reactionUsed}
                  aria-label={`${c.reactionUsed ? "Вернуть реакцию" : "Отметить реакцию"}: ${c.name}`}
                  onClick={() =>
                    combatant(c.id, { reactionUsed: !c.reactionUsed })
                  }
                >
                  {c.reactionUsed ? "Вернуть реакцию" : "Отметить реакцию"}
                </Button>
                {c.sourceId && (
                  <Button iconOnly
                    size="sm"
                    variant="ghost"
                    icon="book"
                    aria-label={`Открыть статблок: ${c.name}`}
                    title={`Открыть статблок: ${c.name}`}
                    onClick={() =>
                      setSource({
                        id: c.sourceId!,
                        name: c.name,
                        minion: /миньон|minion/i.test(c.organization),
                      })
                    }
                  >
                    Статблок
                  </Button>
                )}
              </div>
            )}
            {c.conditions.some((x) => director || x.public) && (
              <div className="scene-condition-chips">
                {c.conditions
                  .filter((x) => director || x.public)
                  .map((x) => (
                    <span className="table-badge" key={x.id}>
                      {x.name}
                      {x.ends && ` · ${x.ends}`}
                      {director && !x.public && " · скрыто"}
                    </span>
                  ))}
              </div>
            )}
            {director && (
              <CardDetailModal open={editingCombatant === c.id} onClose={() => setEditingCombatant(null)} title={`Состояния и настройки: ${c.name}`} className="scene-ui table-dialog" wide>
                {error && <p role="alert">{error}</p>}
                <fieldset disabled={busy}>
                  <div className="scene-grid">
                    {(["maxStamina", "temporaryStamina"] as const).map(
                      (key, i) => (
                        <label key={key}>
                          {
                            ["Максимум выносливости", "Временная выносливость"][
                              i
                            ]
                          }
                          <input
                            className="input"
                            type="number"
                            min="0"
                            key={c[key]}
                            defaultValue={c[key] ?? 0}
                            onBlur={(e) =>
                              combatant(c.id, { [key]: Number(e.target.value) })
                            }
                          />
                        </label>
                      ),
                    )}
                    <label>
                      Ход
                      <select
                        className="select"
                        value={c.turn}
                        onChange={(e) =>
                          combatant(c.id, {
                            turn: e.target.value as SceneCombatant["turn"],
                          })
                        }
                      >
                        {Object.entries(turnNames).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {c.conditions.map((condition) => (
                    <div className="scene-condition-row" key={condition.id}>
                      <label>
                        Состояние
                        <input
                          className="input"
                          key={condition.name}
                          defaultValue={condition.name}
                          onBlur={(e) =>
                            combatant(c.id, {
                              conditions: c.conditions.map((x) =>
                                x.id === condition.id
                                  ? {
                                      ...x,
                                      name: e.target.value.trim() || x.name,
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Окончание
                        <input
                          className="input"
                          key={condition.ends}
                          defaultValue={condition.ends}
                          onBlur={(e) =>
                            combatant(c.id, {
                              conditions: c.conditions.map((x) =>
                                x.id === condition.id
                                  ? { ...x, ends: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="table-check">
                        <input
                          type="checkbox"
                          checked={condition.public}
                          onChange={(e) =>
                            combatant(c.id, {
                              conditions: c.conditions.map((x) =>
                                x.id === condition.id
                                  ? { ...x, public: e.target.checked }
                                  : x,
                              ),
                            })
                          }
                        />
                        Видно игрокам
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="trash"
                        iconOnly
                        aria-label={`Удалить состояние: ${condition.name}`}
                        onClick={() =>
                          combatant(c.id, {
                            conditions: c.conditions.filter(
                              (x) => x.id !== condition.id,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  <div>
                    <Button iconOnly
                      size="sm"
                      variant="soft"
                      icon="plus"
                      onClick={() =>
                        combatant(c.id, {
                          conditions: [
                            ...c.conditions,
                            {
                              id: sceneId(),
                              name: "Новое состояние",
                              public: false,
                              ends: "",
                            },
                          ],
                        })
                      }
                    >
                      Добавить состояние
                    </Button>
                  </div>
                  <label>
                    Заметки ведущего о существе
                    <textarea
                      className="textarea"
                      key={c.notes}
                      defaultValue={c.notes ?? ""}
                      onBlur={(e) => combatant(c.id, { notes: e.target.value })}
                    />
                  </label>
                </fieldset>
              </CardDetailModal>
            )}
          </Card>
        ))}
      </div>
      <CardDetailModal
        open={!!source}
        onClose={() => setSource(null)}
        title={source?.name ?? "Правила"}
        wide
        className="table-dialog"
      >
        {source && (
          <Suspense fallback={<p>Загрузка статблока…</p>}>
            {source.minion && (
              <p className="muted small">
                Показатели одного миньона. В трекере указан общий запас
                выносливости отряда; состав отмечается вручную.
              </p>
            )}
            <RuleArticleReader articleId={source.id} />
          </Suspense>
        )}
      </CardDetailModal>
    </section>
  );
}
