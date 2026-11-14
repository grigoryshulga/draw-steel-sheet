import { useEffect, useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button, Card } from "../../components/ui";
import {
  combatantFromSeed,
  resizeMinionGroup,
  encounterBudget,
  normalizeScene,
  sceneId,
} from "../../lib/tables/scenes";
import { monsterGroupName, searchMonsterSeeds, type MonsterSeed } from "../../lib/tables/monster-catalog";
import { SceneEditorHeader } from "./SceneEditorHeader";
import { SceneBudgetBar } from "./SceneBudgetBar";
import { SceneCatalog } from "./SceneCatalog";
import type { SceneCombatant, TableScene } from "../../lib/tables/types";
import "./Scenes.css";

export function SceneEditor({
  scene,
  onSave,
  onCancel,
  onDirtyChange,
  busy = false,
  partyLevels = [],
  onSaveTemplate,
}: {
  scene: TableScene;
  onSave: (scene: TableScene) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  busy?: boolean;
  partyLevels?: number[];
  onSaveTemplate?: (scene: TableScene) => void;
}) {
  const [catalogActionHost, setCatalogActionHost] = useState<HTMLDivElement | null>(null);
  const [catalogTab, setCatalogTab] = useState<"monster" | "terrain" | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => structuredClone(scene));
  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== JSON.stringify(scene));
  }, [draft, scene, onDirtyChange]);
  const terrainIds = new Set(searchMonsterSeeds("", { kind: "terrain" }).map((s) => s.sourceId));
  const [levels, setLevels] = useState(
    partyLevels.length ? partyLevels : [1, 1, 1, 1, 1],
  );
  const [victories, setVictories] = useState(0);
  const budget = encounterBudget(draft, levels, victories);
  const update = (patch: Partial<TableScene>) =>
    setDraft((s) => ({ ...s, ...patch }));
  const combatant = (id: string, patch: Partial<SceneCombatant>) =>
    setDraft((s) => ({
      ...s,
      combatants: s.combatants.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
  const add = (seed?: MonsterSeed) => {
    setDraft((current) => ({
      ...current,
      combatants: [...current.combatants, combatantFromSeed(seed)],
    }));
  };
  const renderParticipants = (participants: SceneCombatant[]) => (<>
        {participants.map((c, index) => (
          <Card key={c.id} className="scene-editor-creature is-compact">
            <section>
              <h3>
                <span className="scene-editor-name">
                  <small className="muted">{index + 1}</small>
                  <strong>{c.name}</strong>
                </span>
                <span className="muted">
                  {c.count && c.count > 1 ? `${c.count} в отряде · ` : ""}
                  {c.encounterValue ?? 0} БЦ
                </span>
              </h3>
              <div className="scene-participant-facts">
                <span>{monsterGroupName(c.group)}</span>
                <span>{c.organization}</span>
                {c.maxStamina !== undefined && <span>Выносливость: {c.stamina ?? c.maxStamina} / {c.maxStamina}</span>}
                <span>{c.faction === "ally" ? "Союзник" : "Противник"}</span>
              </div>
              <CardDetailModal open={editingParticipant === c.id} onClose={() => setEditingParticipant(null)} title={c.name} className="scene-ui table-dialog" wide>
                <fieldset disabled={busy}>
              <div className="table-stack">
                <div className="scene-grid">
                  <label>
                    Имя
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) =>
                        combatant(c.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Группа
                    <input
                      className="input"
                      value={monsterGroupName(c.group)}
                      onChange={(e) =>
                        combatant(c.id, { group: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Организация
                    <input
                      className="input"
                      value={c.organization}
                      onChange={(e) =>
                        combatant(c.id, { organization: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Сторона
                    <select
                      className="select"
                      value={c.faction}
                      onChange={(e) =>
                        combatant(c.id, {
                          faction: e.target.value as SceneCombatant["faction"],
                        })
                      }
                    >
                      <option value="enemy">Противник</option>
                      <option value="ally">Союзник</option>
                    </select>
                  </label>
                  <label>
                    Капитан
                    <select
                      className="select"
                      value={c.captainId ?? ""}
                      onChange={(e) =>
                        combatant(c.id, {
                          captainId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Нет</option>
                      {draft.combatants
                        .filter((x) => x.id !== c.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {(
                    [
                      "count",
                      "stamina",
                      "maxStamina",
                      "temporaryStamina",
                      "encounterValue",
                    ] as const
                  ).map((key, i) => (
                    <label key={key}>
                      {
                        [
                          "Количество",
                          /миньон|minion/i.test(c.organization)
                            ? "Запас отряда"
                            : "Выносливость",
                          "Максимум",
                          "Временная выносливость",
                          "БЦ",
                        ][i]
                      }
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step={key === "encounterValue" ? "0.25" : "1"}
                        disabled={
                          key === "count" &&
                          !/миньон|minion/i.test(c.organization)
                        }
                        value={c[key] ?? 0}
                        onChange={(e) =>
                          combatant(
                            c.id,
                            key === "count"
                              ? resizeMinionGroup(c, Number(e.target.value))
                              : { [key]: Number(e.target.value) },
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={c.revealed}
                      onChange={(e) =>
                        combatant(c.id, { revealed: e.target.checked })
                      }
                    />{" "}
                    Раскрыт игрокам
                  </label>
                </div>
                <label>
                  Заметки
                  <textarea
                    className="textarea"
                    value={c.notes ?? ""}
                    onChange={(e) => combatant(c.id, { notes: e.target.value })}
                  />
                </label>
              </div>
                </fieldset>
              </CardDetailModal>
                <div className="scene-actions">
                  <Button size="sm" variant="ghost" icon="edit" iconOnly onClick={() => setEditingParticipant(c.id)}>{`Изменить участника ${index + 1}: ${c.name}`}</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="copy"
                    onClick={() =>
                      update({
                        combatants: [
                          ...draft.combatants,
                          {
                            ...structuredClone(c),
                            id: sceneId(),
                            name: `${c.name} — копия`,
                            captainId: undefined,
                          },
                        ],
                      })
                    }
                    iconOnly
                  >
                    {`Добавить копию участника ${index + 1}: ${c.name}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    onClick={() =>
                      update({
                        combatants: draft.combatants
                          .filter((x) => x.id !== c.id)
                          .map((x) =>
                            x.captainId === c.id
                              ? { ...x, captainId: undefined }
                              : x,
                          ),
                      })
                    }
                    iconOnly
                  >
                    {`Удалить участника ${index + 1}: ${c.name}`}
                  </Button>
                </div>
            </section>
          </Card>
        ))}
  </>);
  return (
    <section className="scene-ui scene-editor" onFocusCapture={(event) => {
      const target = event.target;
      const scroller = event.currentTarget.querySelector<HTMLElement>(":scope > fieldset");
      if (!window.matchMedia("(max-width: 700px)").matches || !scroller?.contains(target)) return;
      requestAnimationFrame(() => {
        if (!target.isConnected || document.activeElement !== target) return;
        const bounds = scroller.getBoundingClientRect();
        const focusArea = target.closest("label") ?? target;
        const rect = focusArea.getBoundingClientRect();
        const margin = 8;
        if (rect.top < bounds.top + margin) scroller.scrollBy({ top: rect.top - bounds.top - margin, behavior: "instant" });
        else if (rect.bottom > bounds.bottom - margin) scroller.scrollBy({ top: rect.bottom - bounds.bottom + margin, behavior: "instant" });
      });
    }}>
      <SceneEditorHeader onBack={onCancel}>
          <Button disabled={busy} iconOnly icon="close" onClick={onCancel}>Отмена</Button>
          {onSaveTemplate && (
            <Button
              onClick={() => onSaveTemplate(normalizeScene(draft))}
              disabled={busy}
              icon="bookmark"
              iconOnly
            >
              В библиотеку
            </Button>
          )}
          <Button iconOnly icon="save"
            variant="primary"
            disabled={
              busy || !draft.name.trim() || draft.combatants.some((c) => !c.name.trim())
            }
            onClick={() => onSave(normalizeScene(draft))}
          >
            Сохранить
          </Button>
      </SceneEditorHeader>
      <fieldset disabled={busy}>
        <section className="scene-editor-section" aria-labelledby="scene-description-title">
          <header><h3 id="scene-description-title">Описание</h3></header>
        <div className="scene-grid scene-description-identity">
          <label>
            Название
            <input
              className="input"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
        <label>
          Цель
          <input
            className="input"
            placeholder="Что нужно сделать героям?"
            value={draft.objective}
            onChange={(e) => update({ objective: e.target.value })}
          />
        </label>
        </div>
        <div>
          <div className="scene-grid">
            {" "}
            <label>
              Описание
              <textarea
                className="textarea"
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              Заметки ведущего
              <textarea
                className="textarea"
                value={draft.directorNotes ?? ""}
                onChange={(e) => update({ directorNotes: e.target.value })}
              />
            </label>
          </div>
        </div>
        <label>
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => update({ published: e.target.checked })}
          />{" "}
          Опубликовать сцену
        </label>
        </section>
        {draft.kind === "encounter" && (
          <section className="scene-editor-section scene-budget-section" aria-labelledby="scene-budget-title">
            <header><h3 id="scene-budget-title">Сложность и бюджет</h3></header>
            <div className="table-stack">
              <div className="scene-grid scene-party-inputs">
                <label>
                  Герои и помощники
                  <input
                    className="input"
                    aria-label="Число героев и союзных помощников"
                    type="number"
                    min={1}
                    max={20}
                    value={levels.length}
                    onChange={(e) =>
                      setLevels(
                        Array.from(
                          {
                            length: Math.max(
                              1,
                              Math.min(20, Number(e.target.value)),
                            ),
                          },
                          (_, i) => levels[i] ?? levels[0] ?? 1,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Уровень группы
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10}
                    value={levels[0]}
                    onChange={(e) =>
                      setLevels(
                        levels.map(() =>
                          Math.max(1, Math.min(10, Number(e.target.value))),
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Средние Победы
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={victories}
                    onChange={(e) =>
                      setVictories(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
              </div>
              {budget && <div className="scene-budget-summary">
                <span>Сила группы <strong>{budget.strength}</strong></span>
                <span>Стандартный бой <strong>до {budget.standardMax} БЦ</strong></span>
                <span>Трудный бой <strong>до {budget.hardMax} БЦ</strong></span>
                <span className="table-badge">{budget.difficulty}</span>
              </div>}
              {budget && <SceneBudgetBar cost={budget.cost} standardMax={budget.standardMax} hardMax={budget.hardMax} />}
            </div>
          </section>
        )}
        <div className="scene-actions scene-add-actions">
          <Button icon="plus" onClick={() => setCatalogTab("monster")}>Добавить участников</Button>
          <Button icon="plus" onClick={() => setCatalogTab("terrain")}>Добавить местность</Button>
        </div>
        {draft.combatants.some((c) => !terrainIds.has(c.sourceId ?? "")) && <section className="scene-editor-section" aria-labelledby="scene-enemies-title">
          <header><h3 id="scene-enemies-title">Участники</h3></header>
          {renderParticipants(draft.combatants.filter((c) => !terrainIds.has(c.sourceId ?? "")))}
        </section>}
        {draft.combatants.some((c) => terrainIds.has(c.sourceId ?? "")) && <section className="scene-editor-section" aria-labelledby="scene-complications-title">
          <header><h3 id="scene-complications-title">Осложнения</h3></header>
          {renderParticipants(draft.combatants.filter((c) => terrainIds.has(c.sourceId ?? "")))}
        </section>}
        <section
          className="table-disclosure"
        >
          <h3>
            Счётчики{" "}
            <span className="table-badge">{draft.counters.length}</span>
          </h3>
          <div className="table-stack">
            {draft.counters.map((c) => (
              <Card key={c.id} className="scene-counter-editor">
                <div className="scene-grid">
                  <label>
                    Название
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) =>
                        update({
                          counters: draft.counters.map((x) =>
                            x.id === c.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Значение
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={c.value}
                      onChange={(e) =>
                        update({
                          counters: draft.counters.map((x) =>
                            x.id === c.id
                              ? { ...x, value: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Максимум
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={c.max ?? ""}
                      onChange={(e) =>
                        update({
                          counters: draft.counters.map((x) =>
                            x.id === c.id
                              ? {
                                  ...x,
                                  max:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={c.public}
                      onChange={(e) =>
                        update({
                          counters: draft.counters.map((x) =>
                            x.id === c.id
                              ? { ...x, public: e.target.checked }
                              : x,
                          ),
                        })
                      }
                    />{" "}
                    Открытый
                  </label>
                </div>
                <div className="scene-actions">
                <Button
                  onClick={() =>
                    update({
                      counters: draft.counters.filter((x) => x.id !== c.id),
                    })
                  }
                  icon="trash"
                  iconOnly
                >
                  Удалить
                </Button>
                </div>
              </Card>
            ))}
            <Button
              onClick={() =>
                update({
                  counters: [
                    ...draft.counters,
                    {
                      id: sceneId(),
                      name: "Новый счётчик",
                      value: 0,
                      public: false,
                    },
                  ],
                })
              }
              icon="plus"
              iconOnly
            >
              Добавить счётчик
            </Button>
          </div>
        </section>
      </fieldset>
      <CardDetailModal open={catalogTab !== null} onClose={() => setCatalogTab(null)} title={catalogTab === "terrain" ? "Добавить местность" : "Добавить участников"} headerActions={draft.kind === "encounter" && budget ? <SceneBudgetBar cost={budget.cost} standardMax={budget.standardMax} hardMax={budget.hardMax} floatingEnabled={false} /> : undefined} className="scene-ui scene-catalog-modal" wide footer={<div className="scene-catalog-footer">{catalogTab === "monster" && <div className="scene-actions scene-add-actions"><Button icon="plus" onClick={() => { const c = combatantFromSeed(); setDraft((old) => ({ ...old, combatants: [...old.combatants, c] })); setCatalogTab(null); setEditingParticipant(c.id); }}>Добавить вручную</Button></div>}<div ref={setCatalogActionHost} /></div>}>
        <fieldset disabled={busy}>
          {catalogTab && <SceneCatalog key={catalogTab} kind={catalogTab} onAdd={add} actionHost={catalogActionHost} forecast={draft.kind === "encounter" ? (seed) => encounterBudget({ ...draft, combatants: [...draft.combatants, combatantFromSeed({ ...seed, maxStamina: 0 })] }, levels, victories) : undefined} />}

        </fieldset>
      </CardDetailModal>
    </section>
  );
}
