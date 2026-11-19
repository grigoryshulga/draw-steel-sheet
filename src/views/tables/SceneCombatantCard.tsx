import { lazy, Suspense, useState, type ReactNode } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Icon } from "../../components/Icons";
import { Button, Card } from "../../components/ui";
import { DirectorStaminaContext, type DirectorStaminaOverride } from "../../components/rules/DirectorStatBlock";
import { normalizeNumberInput } from "../../lib/number-input";
import { healthLabel, sceneId } from "../../lib/tables/scenes";
import type { SceneCombatant, TableSnapshot } from "../../lib/tables/types";
import "./Scenes.css";

const RuleArticleReader = lazy(() =>
  import("../../components/rules/RuleArticleReader").then((module) => ({
    default: module.RuleArticleReader,
  })),
);

export type SceneRuleSource = { id: string; name: string; minion?: boolean };
export const turnNames = { ready: "Готов", active: "Ходит", done: "Ход завершён" };

export function sceneCombatantSource(unit: SceneCombatant): SceneRuleSource | null {
  return unit.sourceId
    ? { id: unit.sourceId, name: unit.name, minion: /миньон|minion/i.test(unit.organization) }
    : null;
}

export function SceneRuleDialog({ source, onClose, stamina, footer, error }: {
  source: SceneRuleSource | null;
  onClose: () => void;
  stamina?: DirectorStaminaOverride;
  footer?: ReactNode;
  error?: string;
}) {
  return (
  <CardDetailModal
    open={!!source}
    onClose={onClose}
    title={source?.name ?? "Правила"}
    footer={footer}
    wide
    className="table-dialog"
  >
    {error && <p role="alert">{error}</p>}
    {source && (
      <Suspense fallback={<p>Загрузка статблока…</p>}>
        {source.minion && (
          <p className="muted small">
            {stamina
              ? "Выносливость указана для всего отряда. Остальные показатели относятся к одному миньону."
              : "Показатели одного миньона. В трекере указан общий запас выносливости отряда; состав отмечается вручную."}
          </p>
        )}
        <DirectorStaminaContext value={stamina}>
          <RuleArticleReader articleId={source.id} />
        </DirectorStaminaContext>
      </Suspense>
    )}
  </CardDetailModal>
  );
}

export function SceneStaminaFields({ unit, busy, onChange }: {
  unit: SceneCombatant;
  busy: boolean;
  onChange: (patch: Partial<SceneCombatant>) => Promise<TableSnapshot | null> | undefined;
}) {
  const limit = 1_000_000_000;
  const field = (key: "stamina" | "maxStamina" | "temporaryStamina", label: string, max = limit) => {
    const current = unit[key] ?? 0;
    return (
      <input className="input scene-stamina-value" type="number" inputMode="numeric"
        aria-label={label} title={label} min={0} max={max} step={1}
        key={`${key}-${current}`} defaultValue={current}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={async event => {
          const input = event.currentTarget;
          const next = normalizeNumberInput(input.valueAsNumber, current, 0, max, true);
          input.value = String(next);
          if (next === current) return;
          const saved = await onChange({ [key]: next });
          if (!saved && input.isConnected) input.value = String(current);
        }} />
    );
  };
  return (
    <fieldset className="scene-statblock-stamina" disabled={busy}>
      <div className="scene-stamina-pool">
        {field("stamina", "Текущая выносливость", unit.maxStamina)}
        <span aria-hidden="true">/</span>
        {field("maxStamina", "Максимум выносливости")}
      </div>
      <label className="scene-stamina-temp">
        Временная
        {field("temporaryStamina", "Временная выносливость")}
      </label>
    </fieldset>
  );
}

export function SceneCombatantCard({
  combatant: c, director, published, onChange, busy, error, turn = "ready", inDialog = false, showStamina = true, onOpenStatBlock,
}: {
  combatant: SceneCombatant;
  director: boolean;
  published: boolean;
  onChange: (patch: Partial<SceneCombatant>) => void;
  busy: boolean;
  error?: string;
  turn?: SceneCombatant["turn"];
  inDialog?: boolean;
  showStamina?: boolean;
  onOpenStatBlock?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<SceneRuleSource | null>(null);
  return <>
  <Card
    aria-label={`Участник: ${c.name}`}
    onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "checkbox") {
        event.preventDefault();
        event.target.blur();
      }
    }}
    className={`scene-combatant is-${turn}${director && !c.revealed ? " is-hidden" : ""}`}
  >
    <div className="scene-combatant-heading">
      <div className="scene-identity">
        {!inDialog && <h4>{c.name}{turn === "done" && <Icon name="check" className="scene-turn-check" size={15} aria-label="Ход завершён" />}</h4>}
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
        {director && <span className="scene-visibility-status">{published && c.revealed ? "Виден игрокам" : c.revealed ? "Раскрыт · сцена скрыта" : "Скрыт от игроков"}</span>}
      </div>
      <div className="scene-actions">
        {director ? (
          <>
            <Button icon="settings" iconOnly size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Настройки: ${c.name}`} title={`Настройки: ${c.name}`}>Настройки участника</Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-pressed={c.revealed}
              iconOnly
              icon={c.revealed ? "eye-off" : "eye"}
              title={`${c.revealed ? "Скрыть" : "Раскрыть"}: ${c.name}`}
              aria-label={`${c.revealed ? "Скрыть" : "Раскрыть"}: ${c.name}`}
              onClick={() => onChange({ revealed: !c.revealed })}
            >
              {c.revealed ? "Скрыть" : "Раскрыть"}
            </Button>
          </>
        ) : (
          <span className="scene-turn-label">{turnNames[turn]}</span>
        )}
      </div>
    </div>
    {director && (
      <div className="scene-combatant-vitals">
        {showStamina && c.stamina !== undefined && (
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
                onChange({ stamina: Number(e.target.value) })
              }
            />
            <span className="muted">/ {c.maxStamina ?? "—"}</span>
          </label>
        )}
        {showStamina && (c.temporaryStamina ?? 0) > 0 && (
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
            onChange({ reactionUsed: !c.reactionUsed })
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
            onClick={onOpenStatBlock ?? (() => setSource(sceneCombatantSource(c)))}
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
      <CardDetailModal open={editing} onClose={() => setEditing(false)} title={`Состояния и настройки: ${c.name}`} className="scene-ui table-dialog" wide>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          {(showStamina || !inDialog) && <div className="scene-grid">
            {showStamina && (["maxStamina", "temporaryStamina"] as const).map(
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
                      onChange({ [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ),
            )}
            {!inDialog && <label>
              Ход
              <select
                className="select"
                value={c.turn}
                onChange={(e) =>
                  onChange({
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
            </label>}
          </div>}
          {c.conditions.map((condition) => (
            <div className="scene-condition-row" key={condition.id}>
              <label>
                Состояние
                <input
                  className="input"
                  key={condition.name}
                  defaultValue={condition.name}
                  onBlur={(e) =>
                    onChange({
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
                    onChange({
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
                    onChange({
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
                  onChange({
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
                onChange({
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
              onBlur={(e) => onChange({ notes: e.target.value })}
            />
          </label>
        </fieldset>
      </CardDetailModal>
    )}
  </Card>
  <SceneRuleDialog source={source} onClose={() => setSource(null)} />
  </>;
}
