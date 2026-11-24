import { creatureCategory, creatureDisplayName } from "./table-display";
import { useLocale } from "../../i18n/locale";
import { useEffect, useState, type ReactNode } from "react";
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
import { SceneChallengeSettings } from "./SceneChallengeSettings";
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
  renderLayout,
}: {
  scene: TableScene;
  onSave: (scene: TableScene) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  busy?: boolean;
  partyLevels?: number[];
  onSaveTemplate?: (scene: TableScene) => void;
  renderLayout?: (draft: TableScene, update: (patch: Partial<TableScene>) => void) => ReactNode;
}) {
  const { t: tr, locale } = useLocale();
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
  const CounterSection = draft.kind === "encounter" ? "section" : "details";
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
                  <strong>{creatureDisplayName(c.sourceId, c.name, locale)}</strong>
                </span>
                <span className="muted">
                  {c.count && c.count > 1 ? `${c.count} ${tr("в отряде", "in squad")} · ` : ""}
                  {c.encounterValue ?? 0} {tr("БЦ", "EV")}
                </span>
              </h3>
              <div className="scene-participant-facts">
                <span>{monsterGroupName(c.group)}</span>
                <span>{creatureCategory(c.organization, locale)}</span>
                {c.maxStamina !== undefined && <span>{tr("Выносливость", "Stamina")}: {c.stamina ?? c.maxStamina} / {c.maxStamina}</span>}
                <span>{c.faction === "ally" ? tr("Союзник", "Ally") : tr("Противник", "Enemy")}</span>
              </div>
              <CardDetailModal open={editingParticipant === c.id} onClose={() => setEditingParticipant(null)} title={creatureDisplayName(c.sourceId, c.name, locale)} className="scene-ui table-dialog" wide>
                <fieldset disabled={busy}>
              <div className="table-stack">
                <div className="scene-grid">
                  <label>
                    {tr("Имя", "Name")}
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) =>
                        combatant(c.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {tr("Группа", "Group")}
                    <input
                      className="input"
                      value={monsterGroupName(c.group)}
                      onChange={(e) =>
                        combatant(c.id, { group: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {tr("Организация", "Organization")}
                    <input
                      className="input"
                      value={c.organization}
                      onChange={(e) =>
                        combatant(c.id, { organization: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {tr("Сторона", "Side")}
                    <select
                      className="select"
                      value={c.faction}
                      onChange={(e) =>
                        combatant(c.id, {
                          faction: e.target.value as SceneCombatant["faction"],
                        })
                      }
                    >
                      <option value="enemy">{tr("Противник", "Enemy")}</option>
                      <option value="ally">{tr("Союзник", "Ally")}</option>
                    </select>
                  </label>
                  <label>
                    {tr("Капитан", "Captain")}
                    <select
                      className="select"
                      value={c.captainId ?? ""}
                      onChange={(e) =>
                        combatant(c.id, {
                          captainId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">{tr("Нет", "None")}</option>
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
                          tr("Количество", "Quantity"),
                          /миньон|minion/i.test(c.organization)
                            ? tr("Запас отряда", "Squad stamina")
                            : tr("Выносливость", "Stamina"),
                          tr("Максимум", "Maximum"),
                          tr("Временная выносливость", "Temporary stamina"),
                          tr("БЦ", "EV"),
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
                    {tr("Раскрыт игрокам", "Revealed to players")}
                  </label>
                </div>
                <label>
                  {tr("Заметки", "Notes")}
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
                  <Button size="sm" variant="ghost" icon="edit" iconOnly onClick={() => setEditingParticipant(c.id)}>{`${tr("Изменить участника", "Edit participant")} ${index + 1}: ${c.name}`}</Button>
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
                    {`${tr("Добавить копию участника", "Duplicate participant")} ${index + 1}: ${c.name}`}
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
                    {`${tr("Удалить участника", "Remove participant")} ${index + 1}: ${c.name}`}
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
      {renderLayout?.(draft, update)}
      <SceneEditorHeader onBack={onCancel}>
          <Button disabled={busy} iconOnly icon="close" onClick={onCancel}>{tr("Отмена", "Cancel")}</Button>
          {onSaveTemplate && (
            <Button
              onClick={() => onSaveTemplate(normalizeScene(draft))}
              disabled={busy}
              icon="bookmark"
              iconOnly
            >
              {tr("В библиотеку", "Save to library")}
            </Button>
          )}
          <Button iconOnly icon="save"
            variant="primary"
            disabled={
              busy || !draft.name.trim() || draft.combatants.some((c) => !c.name.trim())
            }
            onClick={() => onSave(normalizeScene(draft))}
          >
            {tr("Сохранить", "Save")}
          </Button>
      </SceneEditorHeader>
      <fieldset disabled={busy}>
        <section className="scene-editor-section" aria-labelledby="scene-description-title">
          <header><h3 id="scene-description-title">{tr("Описание", "Description")}</h3></header>
        <div className="scene-grid scene-description-identity">
          <label>
            {tr("Название", "Name")}
            <input
              className="input"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
        <label>
          {tr("Цель", "Objective")}
          <input
            className="input"
            placeholder={tr("Что нужно сделать героям?", "What must the heroes do?")}
            value={draft.objective}
            onChange={(e) => update({ objective: e.target.value })}
          />
        </label>
        </div>
        <div>
          <div className="scene-grid">
            {" "}
            <label>
              {tr("Описание", "Description")}
              <textarea
                className="textarea"
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </label>
            <label>
              {tr("Заметки ведущего", "Director notes")}
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
          {tr("Опубликовать сцену", "Publish scene")}
        </label>
        </section>
        {draft.kind === "encounter" && (
          <section className="scene-editor-section scene-budget-section" aria-labelledby="scene-budget-title">
            <header><h3 id="scene-budget-title">{tr("Сложность и бюджет", "Difficulty and budget")}</h3></header>
            <div className="table-stack">
              <div className="scene-grid scene-party-inputs">
                <label>
                  {tr("Герои и помощники", "Heroes and allies")}
                  <input
                    className="input"
                    aria-label={tr("Число героев и союзных помощников", "Number of heroes and allied retainers")}
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
                  {tr("Уровень группы", "Party level")}
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
                  {tr("Средние Победы", "Average victories")}
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
                <span>{tr("Сила группы", "Party strength")} <strong>{budget.strength}</strong></span>
                <span>{tr("Стандартный бой", "Standard encounter")} <strong>{tr("до", "up to")} {budget.standardMax} {tr("БЦ", "EV")}</strong></span>
                <span>{tr("Трудный бой", "Hard encounter")} <strong>{tr("до", "up to")} {budget.hardMax} {tr("БЦ", "EV")}</strong></span>
                <span className="table-badge">{budget.difficulty}</span>
              </div>}
              {budget && <SceneBudgetBar cost={budget.cost} standardMax={budget.standardMax} hardMax={budget.hardMax} />}
            </div>
          </section>
        )}
        <div className="scene-actions scene-add-actions">
          <Button icon="plus" onClick={() => setCatalogTab("monster")}>{tr("Добавить участников", "Add participants")}</Button>
          <Button icon="plus" onClick={() => setCatalogTab("terrain")}>{tr("Добавить местность", "Add terrain")}</Button>
        </div>
        {draft.combatants.some((c) => !terrainIds.has(c.sourceId ?? "")) && <section className="scene-editor-section" aria-labelledby="scene-enemies-title">
          <header><h3 id="scene-enemies-title">{tr("Участники", "Participants")}</h3></header>
          {renderParticipants(draft.combatants.filter((c) => !terrainIds.has(c.sourceId ?? "")))}
        </section>}
        {draft.combatants.some((c) => terrainIds.has(c.sourceId ?? "")) && <section className="scene-editor-section" aria-labelledby="scene-complications-title">
          <header><h3 id="scene-complications-title">{tr("Осложнения", "Complications")}</h3></header>
          {renderParticipants(draft.combatants.filter((c) => terrainIds.has(c.sourceId ?? "")))}
        </section>}
        {draft.kind !== "encounter" && <SceneChallengeSettings scene={draft} heroes={partyLevels.length || 5} onChange={setDraft} />}
        <CounterSection className="table-disclosure">
          {draft.kind === "encounter" ? <h3>{tr("Счётчики", "Counters")}</h3> : <summary>{tr("Дополнительные счётчики и их видимость", "Additional counters and visibility")}</summary>}
          <div className="table-stack">
            {draft.counters.map((c) => (
              <Card key={c.id} className="scene-counter-editor">
                <div className="scene-grid">
                  <label>
                    {tr("Название", "Name")}
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
                    {tr("Значение", "Value")}
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
                    {tr("Максимум", "Maximum")}
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
                    {tr("Открытый", "Public")}
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
                  {tr("Удалить", "Delete")}
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
              {tr("Добавить счётчик", "Add counter")}
            </Button>
          </div>
        </CounterSection>
      </fieldset>
      <CardDetailModal open={catalogTab !== null} onClose={() => setCatalogTab(null)} title={catalogTab === "terrain" ? tr("Добавить местность", "Add terrain") : tr("Добавить участников", "Add participants")} headerActions={draft.kind === "encounter" && budget ? <SceneBudgetBar cost={budget.cost} standardMax={budget.standardMax} hardMax={budget.hardMax} floatingEnabled={false} /> : undefined} className="scene-ui scene-catalog-modal" wide footer={<div className="scene-catalog-footer">{catalogTab === "monster" && <div className="scene-actions scene-add-actions"><Button icon="plus" onClick={() => { const c = combatantFromSeed(); setDraft((old) => ({ ...old, combatants: [...old.combatants, c] })); setCatalogTab(null); setEditingParticipant(c.id); }}>{tr("Добавить вручную", "Add manually")}</Button></div>}<div ref={setCatalogActionHost} /></div>}>
        <fieldset disabled={busy}>
          {catalogTab && <SceneCatalog key={catalogTab} kind={catalogTab} onAdd={add} actionHost={catalogActionHost} forecast={draft.kind === "encounter" ? (seed) => encounterBudget({ ...draft, combatants: [...draft.combatants, combatantFromSeed({ ...seed, maxStamina: 0 })] }, levels, victories) : undefined} />}

        </fieldset>
      </CardDetailModal>
    </section>
  );
}
