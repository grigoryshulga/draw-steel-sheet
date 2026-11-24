import { useLocale } from "../../i18n/locale";
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
  const { t: tr } = useLocale();
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
    onClick={() => { setManagementOpen(false); setEditingNotes(true); }}>{tr("Заметки ведущего", "Director notes")}</Button>;
  const visibilityLabel = scene.published ? tr("Скрыть сцену от игроков", "Hide scene from players") : tr("Опубликовать сцену", "Publish scene");
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
          {tr("Приостановить", "Pause")}
        </Button>
      )}
      {scene.kind !== "encounter" && scene.combatants.length > 0 && (
        <Button size="sm" icon="refresh" iconOnly={!live && !narrow} disabled={busy}
          onClick={() => { setManagementOpen(false); change({ combatants: resetTurns() }); }}>
          {tr("Сбросить ходы и реакции", "Reset turns and reactions")}
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
                tr("Завершить сцену? Её можно будет продолжить позднее.", "End this scene? You can resume it later."),
              )
            ) {
              setManagementOpen(false);
              change({ status: "finished" });
            }
          }}
        >
          {tr("Завершить сцену", "End scene")}
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
          {tr("Правила Раздора", "Malice rules")}
        </Button>
      )}
    </div>
  );
  const maliceControl = live ? (
    <div className="scene-live-malice">
      <span>{tr("Раздор", "Malice")}</span>
      <fieldset disabled={busy}>
        <NumberInput className="tiny-num" value={scene.malice ?? 0}
          label={tr("Раздор", "Malice")} min={0} max={1_000_000_000} integer
          onChange={value => { maliceDraft.current = value; }}
          onBlur={() => change({ malice: maliceDraft.current })}
          onCommit={value => change({ malice: value })} />
      </fieldset>
    </div>
  ) : (
    <label className="scene-inline-number">
      {tr("Раздор", "Malice")}
      <input className="input" aria-label={tr("Раздор", "Malice")} type="number" min="0" disabled={busy}
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
              {tr("Новый раунд", "New round")}
            </Button>
          )}
        </>
      ) : director && onCombat ? (
        <>
          <Select aria-label={tr("Кто начинает бой", "Who starts the encounter")} value={initiative} disabled={busy}
            onChange={event => setInitiative(event.target.value as CombatSide)}>
            <option value="heroes">{tr("Начинают игроки", "Players start")}</option>
            <option value="enemies">{tr("Начинает ведущий", "Director starts")}</option>
          </Select>
          <Button size="sm" variant="primary" disabled={busy}
            onClick={() => onCombat("combat-start", { sceneId: scene.id, initiative })}>
            {tr("Начать бой", "Start encounter")}
          </Button>
        </>
      ) : onCombat && <span className="muted">{tr("Ведущий выбирает инициативу", "Director chooses initiative")}</span>}
      {director && !live && maliceControl}
    </div>
  );
  const counterList = (editable: boolean) => counters.length > 0 && (
    <div className="scene-counters" aria-label={tr("Счётчики сцены", "Scene counters")}>
      {counters.map((c) => (
        <div className="scene-counter" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            {director && (!live || !c.public) && (
              <span className="muted">
                {c.public ? tr("Общий", "Shared") : tr("Только ведущему", "Director only")}
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
                title={`${tr("Уменьшить", "Decrease")}: ${c.name}`}
                aria-label={`${tr("Уменьшить", "Decrease")}: ${c.name}`}
                onClick={() =>
                  change({
                    counters: scene.counters.map((x) =>
                      x.id === c.id ? { ...x, value: x.value - 1 } : x,
                    ),
                  })
                }
              >
                {tr("Уменьшить", "Decrease")}
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
                title={`${tr("Увеличить", "Increase")}: ${c.name}`}
                aria-label={`${tr("Увеличить", "Increase")}: ${c.name}`}
                onClick={() =>
                  change({
                    counters: scene.counters.map((x) =>
                      x.id === c.id ? { ...x, value: x.value + 1 } : x,
                    ),
                  })
                }
              >
                {tr("Увеличить", "Increase")}
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
        <h3>{tr("Участники", "Participants")} <span className="muted">{visible.length}</span></h3>
        {director && <span className="muted small">{tr("Раскрыто", "Revealed")}: {visible.filter((c) => c.revealed).length}</span>}
      </div>
      {!visible.length && (
        <p className="table-empty">
          {director ? tr("Добавьте существ в подготовке сцены.", "Add creatures when preparing the scene.") : tr("Ведущий пока не раскрыл участников сцены.", "The Director has not revealed any participants.")}
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
                  encounter: tr("Бой", "Encounter"),
                  negotiation: tr("Переговоры", "Negotiation"),
                  montage: tr("Монтаж", "Montage"),
                }[scene.kind]
              }{" "}
              ·{" "}
              {
                { prepared: tr("На паузе", "Paused"), active: tr("Идёт", "Active"), finished: tr("Завершена", "Finished") }[
                  scene.status
                ]
              }
            </span>
            <h2>{scene.name}</h2>
          </div>
          {director && (
            <div className="scene-actions">
              {notesButton}
              {narrow && <Button icon="more" iconOnly size="sm" variant="ghost" onClick={() => setManagementOpen(true)}>{tr("Управление сценой", "Scene management")}</Button>}
              <span className="scene-visibility-status">
                {scene.published ? tr("Видна игрокам", "Visible to players") : tr("Скрыта от игроков", "Hidden from players")}
              </span>
              {visibilityButton}
            </div>
          )}
        </header>
      )}
      {live ? <>
        {director && <Button icon="more" iconOnly size="sm" className="scene-live-manage"
          onClick={() => setManagementOpen(true)}>{tr("Управление сценой", "Scene management")}</Button>}
        {scene.kind === "encounter" && <>
          <SceneCombatStatus table={table} combat={combat} />
          {(director || !combat) && toolbar}
        </>}
        {counterList(director && scene.kind === "encounter")}
        {challenge}
      </> : <>
        {director && !scene.published && (
          <p className="muted small">{tr("Сцена скрыта от игроков. Раскрытые участники появятся после публикации.", "The scene is hidden. Revealed participants appear after publication.")}</p>
        )}
        {scene.objective && <p className="scene-objective"><strong>{tr("Цель", "Objective")}:</strong> {scene.objective}</p>}
        {scene.description && <p className="table-prose muted">{scene.description}</p>}
        {scene.kind === "encounter" && toolbar}
        {counterList(director && !challenge)}
        {challenge}
        {roster}
      </>}
      {director && (
        <>
          <CardDetailModal open={editingNotes} onClose={() => setEditingNotes(false)} title={tr("Заметки ведущего", "Director notes")} className="table-dialog">
            {error && <p role="alert">{error}</p>}
            <label>
              {tr("Заметки ведущего", "Director notes")}
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
            <CardDetailModal open={(live || narrow) && managementOpen} onClose={() => setManagementOpen(false)} title={tr("Управление сценой", "Scene management")} className="table-dialog scene-management-modal">
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
