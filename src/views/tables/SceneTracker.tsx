import { useRef, useState } from "react";
import { useMediaQuery } from "../../lib/hooks";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button, NumberInput, Select } from "../../components/ui";
import { normalizeScene } from "../../lib/tables/scenes";
import type { CombatSide, SceneCombatant, TableCombat, TableScene, TableSnapshot } from "../../lib/tables/types";
import { SceneCombatantCard, SceneRuleDialog, type SceneRuleSource } from "./SceneCombatantCard";
import { SceneCombatStatus } from "./SceneCombatStatus";
import { SceneChallengeControls } from "./SceneChallengeControls";
import "./Scenes.css";

export function SceneTracker({
  scene,
  director,
  onChange,
  busy = false,
  error = "",
  live = false,
  showRoster = true,
  table,
  combat = table?.combat,
  onCombat,
}: {
  scene: TableScene;
  director: boolean;
  onChange: (scene: TableScene) => void;
  busy?: boolean;
  error?: string;
  live?: boolean;
  showRoster?: boolean;
  table?: TableSnapshot;
  combat?: TableCombat;
  onCombat?: (type: string, payload: Record<string, unknown>) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [initiative, setInitiative] = useState<CombatSide>(scene.initiative);
  const narrow = useMediaQuery("(max-width: 700px)");
  const maliceDraft = useRef(scene.malice ?? 0);
  const [source, setSource] = useState<SceneRuleSource | null>(null);
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
  const notesButton = <Button icon="sheet" iconOnly={!live} size="sm" variant="ghost"
    onClick={() => { setManagementOpen(false); setEditingNotes(true); }}>Заметки ведущего</Button>;
  const visibilityLabel = scene.published ? "Скрыть сцену от игроков" : "Опубликовать сцену";
  const visibilityButton = <Button iconOnly={!live} icon={scene.published ? "eye-off" : "eye"}
    size="sm" variant="ghost" disabled={busy} aria-label={visibilityLabel} aria-pressed={!live ? scene.published : undefined}
    onClick={() => { setManagementOpen(false); change({ published: !scene.published }); }}>{visibilityLabel}</Button>;
  const managementControls = (
    <div className="scene-actions">
      {live && <>{notesButton}{visibilityButton}</>}
      {scene.status === "active" && (
        <Button iconOnly={!live && !narrow} icon="pause"
          size="sm"
          disabled={busy}
          onClick={() => { setManagementOpen(false); change({ status: "prepared" }); }}
        >
          Приостановить
        </Button>
      )}
      {scene.kind !== "encounter" && scene.combatants.length > 0 && (
        <Button size="sm" icon="refresh" iconOnly={!live && !narrow} disabled={busy}
          onClick={() => { setManagementOpen(false); change({ combatants: resetTurns() }); }}>
          Сбросить ходы и реакции
        </Button>
      )}
      {scene.status !== "finished" && (
        <Button
          size="sm"
          icon={live ? "check" : undefined}
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Завершить сцену? Её можно будет продолжить позднее.",
              )
            ) {
              setManagementOpen(false);
              change({ status: "finished" });
            }
          }}
        >
          Завершить сцену
        </Button>
      )}
      {scene.kind === "encounter" && (
        <Button iconOnly={!live && !narrow}
          size="sm"
          variant="ghost"
          icon="book"
          onClick={() => {
            setManagementOpen(false);
            setSource({
              id: "monsters.rule.monster.malice",
              name: "Раздор",
            });
          }}
        >
          Правила Раздора
        </Button>
      )}
    </div>
  );
  const maliceControl = live ? (
    <div className="scene-live-malice">
      <span>Раздор</span>
      <fieldset disabled={busy}>
        <NumberInput className="tiny-num" value={scene.malice ?? 0}
          label="Раздор" min={0} max={1_000_000_000} integer
          onChange={value => { maliceDraft.current = value; }}
          onBlur={() => change({ malice: maliceDraft.current })}
          onCommit={value => change({ malice: value })} />
      </fieldset>
    </div>
  ) : (
    <label className="scene-inline-number">
      Раздор
      <input className="input" aria-label="Раздор" type="number" min="0" disabled={busy}
        key={`malice-${scene.malice}`} defaultValue={scene.malice ?? 0}
        onBlur={event => change({ malice: Number(event.target.value) })} />
    </label>
  );
  const toolbar = (
    <div className={live ? "scene-live-round-actions" : "scene-toolbar"}>
      {combat ? (
        <>
          {!live && <SceneCombatStatus combat={combat} />}
          {director && onCombat && (
            <Button size="sm" variant="soft" disabled={busy}
              onClick={() => onCombat("combat-next-round", { sceneId: scene.id, combatId: combat.id })}>
              Новый раунд
            </Button>
          )}
        </>
      ) : director && onCombat ? (
        <>
          <Select aria-label="Кто начинает бой" value={initiative} disabled={busy}
            onChange={event => setInitiative(event.target.value as CombatSide)}>
            <option value="heroes">Начинают игроки</option>
            <option value="enemies">Начинает ведущий</option>
          </Select>
          <Button size="sm" variant="primary" disabled={busy}
            onClick={() => onCombat("combat-start", { sceneId: scene.id, initiative })}>
            Начать бой
          </Button>
        </>
      ) : onCombat && <span className="muted">Ведущий выбирает инициативу</span>}
      {director && !live && maliceControl}
    </div>
  );
  const counterList = (editable: boolean) => counters.length > 0 && (
    <div className="scene-counters" aria-label="Счётчики сцены">
      {counters.map((c) => (
        <div className="scene-counter" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            {director && (!live || !c.public) && (
              <span className="muted">
                {c.public ? "Общий" : "Только ведущему"}
              </span>
            )}
          </div>
          {scene.kind === "negotiation" && !!c.max &&
            <meter className="scene-negotiation-meter" min={0} max={c.max} value={c.value} aria-label={c.name} />}
          <div className="scene-counter-controls">
            {editable && (
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
            {editable && (
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
  );
  const challenge = scene.kind !== "encounter" && scene.status === "active" && (
    <SceneChallengeControls scene={scene} director={director} busy={busy}
      members={table?.members ?? []} onChange={change} corrections={counterList(director)} />
  );

  const roster = showRoster && (
    <>
      <div className="table-section-heading">
        <h3>Участники <span className="muted">{visible.length}</span></h3>
        {director && <span className="muted small">Раскрыто: {visible.filter((c) => c.revealed).length}</span>}
      </div>
      {!visible.length && (
        <p className="table-empty">
          {director ? "Добавьте существ в подготовке сцены." : "Ведущий пока не раскрыл участников сцены."}
        </p>
      )}
      <div className="scene-roster">
        {visible.map(c => (
          <SceneCombatantCard key={c.id} combatant={c} director={director}
            published={scene.published} busy={busy} error={error}
            onChange={patch => combatant(c.id, patch)} />
        ))}
      </div>
    </>
  );

  return (
    <section
      className={`scene-ui scene-tracker scene-kind-${scene.kind}${live ? " is-live-tracker" : ""}`}
      onKeyDown={(event) => {
        if (
          !event.defaultPrevented && event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          event.target.type !== "checkbox"
        ) {
          event.preventDefault();
          event.target.blur();
        }
      }}
    >
      {!live && (
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
              {notesButton}
              {narrow && <Button icon="more" iconOnly size="sm" variant="ghost" onClick={() => setManagementOpen(true)}>Управление сценой</Button>}
              <span className="scene-visibility-status">
                {scene.published ? "Видна игрокам" : "Скрыта от игроков"}
              </span>
              {visibilityButton}
            </div>
          )}
        </header>
      )}
      {live ? <>
        {director && <Button icon="more" iconOnly size="sm" className="scene-live-manage"
          onClick={() => setManagementOpen(true)}>Управление сценой</Button>}
        {scene.kind === "encounter" && <>
          <SceneCombatStatus table={table} combat={combat} />
          {(director || !combat) && toolbar}
        </>}
        {counterList(director && scene.kind === "encounter")}
        {challenge}
      </> : <>
        {director && !scene.published && (
          <p className="muted small">Сцена скрыта от игроков. Раскрытые участники появятся после публикации.</p>
        )}
        {scene.objective && <p className="scene-objective"><strong>Цель:</strong> {scene.objective}</p>}
        {scene.description && <p className="table-prose muted">{scene.description}</p>}
        {scene.kind === "encounter" && toolbar}
        {counterList(director && !challenge)}
        {challenge}
        {roster}
      </>}
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
            {!live && !narrow && managementControls}
            <CardDetailModal open={(live || narrow) && managementOpen} onClose={() => setManagementOpen(false)} title="Управление сценой" className="table-dialog scene-management-modal">
              {error && <p role="alert">{error}</p>}
              {live && scene.kind === "encounter" && maliceControl}
              {managementControls}
            </CardDetailModal>
        </>
      )}
      <SceneRuleDialog source={source} onClose={() => setSource(null)} />

    </section>
  );
}
