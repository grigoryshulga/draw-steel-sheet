import { useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Icon } from "../../components/Icons";
import { Button } from "../../components/ui";
import { damageCombatant, healthLabel, normalizeScene } from "../../lib/tables/scenes";
import type { SceneCombatant, TableCombat, TableScene } from "../../lib/tables/types";
import { SceneCombatantCard, SceneRuleDialog, SceneStaminaFields, sceneCombatantSource, turnNames } from "./SceneCombatantCard";
import { SharedHeroStaminaBar, type SendTableCommand } from "./TableMembers";

function turnOf(combat: TableCombat | undefined, unit: SceneCombatant): SceneCombatant["turn"] {
  if (combat?.active?.side === "enemies" && combat.active.id === unit.id) return "active";
  return combat?.enemyTurns.includes(unit.id) ? "done" : "ready";
}

export function BoardMonsterCards({ scene, combat, director, busy, error, command }: {
  scene: TableScene;
  combat?: TableCombat;
  director: boolean;
  busy: boolean;
  error: string;
  command: SendTableCommand;
}) {
  const [hovered, setHovered] = useState<string>();
  const [viewing, setViewing] = useState<{ id: string; details: boolean }>();
  const [damageTarget, setDamageTarget] = useState<string>();
  const visible = scene.combatants.filter(unit => director || unit.revealed);
  const viewedUnit = visible.find(unit => unit.id === viewing?.id);
  const statBlock = director && viewedUnit ? sceneCombatantSource(viewedUnit) : null;
  const inlineStamina = !!statBlock && viewedUnit?.stamina !== undefined;
  if (!visible.length) return null;

  const change = (id: string, patch: Partial<SceneCombatant>) => {
    if (!director || busy) return;
    const next = normalizeScene({
      ...scene,
      combatants: scene.combatants.map(unit => unit.id === id ? { ...unit, ...patch } : unit),
    });
    if (JSON.stringify(next) !== JSON.stringify(scene)) return command("save-scene", { scene: next });
  };

  return <>
    <div className="board-monsters" role="group" aria-label={scene.kind === "encounter" ? "Участники боя" : "Участники сцены"}>
      {visible.map(unit => {
        const turn = turnOf(combat, unit);
        const canStart = combat?.side === "enemies" && !combat.active && turn === "ready" && unit.health !== "defeated";
        const action = turn === "active" ? "Завершить ход" : "Начать ход";
        const stamina = unit.stamina !== undefined && unit.maxStamina
          ? { current: unit.stamina, max: unit.maxStamina, temp: unit.temporaryStamina ?? 0 } : undefined;
        const editingDamage = director && damageTarget === unit.id;
        const health = healthLabel(unit.health);
        const state = stamina ? `Выносливость: ${stamina.current} из ${stamina.max}` : health;
        const hidden = director && !unit.revealed;
        const conditions = unit.conditions.filter(condition => director || condition.public);
        const organization = [
          unit.organization,
          unit.count && unit.count > 1 ? `${unit.count} в отряде` : "",
          unit.faction === "ally" ? "Союзник" : "",
        ].filter(Boolean).join(" · ");
        const staminaBar = stamina && <span className="board-seat-stamina" aria-hidden="true">
          <SharedHeroStaminaBar stamina={stamina} decorative />
          <span>{stamina.current}/{stamina.max}</span>
        </span>;
        const closeDamage = (form: HTMLFormElement) => {
          setDamageTarget(undefined);
          form.closest(".board-monster")?.querySelector<HTMLButtonElement>(".board-monster-hp")?.focus();
        };
        return <div className="board-monster-seat" key={unit.id}
          onPointerLeave={() => setHovered(current => current === unit.id ? undefined : current)}>
          <div className="board-monster" data-turn={turn} data-hovered={hovered === unit.id || undefined}
            data-damage-open={editingDamage || undefined}
            onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(unit.id); }}
            onBlur={event => {
              if (editingDamage && !event.currentTarget.contains(event.relatedTarget)) {
                setDamageTarget(current => current === unit.id ? undefined : current);
              }
            }}>
            <div className="board-monster-compact">
              <div className="board-monster-header">
                <button type="button" className="board-monster-summary" aria-haspopup="dialog" title={unit.name}
                  aria-label={`${unit.name}. ${state}. ${turnNames[turn]}${hidden ? ". Скрыт от игроков" : ""}`}
                  onClick={() => { setDamageTarget(undefined); setViewing({ id: unit.id, details: false }); }}>
                  <span className="board-monster-heading">
                    <span className="board-monster-name">{unit.name}</span>
                    {turn === "done" && <Icon name="check" className="scene-turn-check" size={15} aria-hidden="true" />}
                  </span>
                  {!stamina ? <span className="scene-health" data-health={unit.health}>{health}</span> : !director && staminaBar}
                </button>
                {director && <Button className="board-monster-visibility" size="sm" iconOnly variant="ghost"
                  icon={hidden ? "eye-off" : "eye"} aria-pressed={unit.revealed} disabled={busy}
                  onClick={() => change(unit.id, { revealed: !unit.revealed })}>
                  {`${hidden ? "Показать игрокам" : "Скрыть от игроков"}: ${unit.name}`}
                </Button>}
              </div>
              {director && stamina && <button type="button" className="board-monster-hp" disabled={busy}
                aria-label={`Нанести урон: ${unit.name}. ${state}`} aria-expanded={editingDamage}
                title="Нанести урон" onClick={() => setDamageTarget(editingDamage ? undefined : unit.id)}>
                {staminaBar}
              </button>}
            </div>
            <div className="board-monster-reveal" aria-hidden={!editingDamage}>
              <div className="board-monster-reveal-clip">
                <div className="board-monster-reveal-body">
                  {editingDamage && stamina && <form className="board-monster-damage" onSubmit={event => {
                    event.preventDefault();
                    if (busy) return;
                    const form = event.currentTarget;
                    const amount = Number(new FormData(form).get("damage"));
                    if (!Number.isSafeInteger(amount) || amount < 1) return;
                    closeDamage(form);
                    change(unit.id, damageCombatant(unit, amount));
                  }} onKeyDown={event => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeDamage(event.currentTarget);
                    }
                  }}>
                    <input autoFocus className="input" name="damage" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required
                      inputMode="numeric" enterKeyHint="done" placeholder="Урон" aria-label={`Урон: ${unit.name}`} />
                    <Button size="sm" variant="soft" icon="check" iconOnly type="submit" disabled={busy}>Применить урон</Button>
                  </form>}
                  {organization && <span>{organization}</span>}
                  {unit.group && <span className="muted">{unit.group}</span>}
                  {stamina && <span className="scene-health" data-health={unit.health}>
                    {health}{stamina.temp > 0 && ` · +${stamina.temp} врем.`}
                  </span>}
                  {director && <span className="board-monster-reaction">
                    <Icon name="spark" size={14} />
                    {unit.reactionUsed ? "Реакция потрачена" : "Реакция доступна"}
                  </span>}
                  {conditions.length > 0 && <span className="scene-condition-chips">
                    {conditions.map(condition => <span key={condition.id} className="table-badge">
                      {condition.name}{condition.ends && ` · ${condition.ends}`}
                    </span>)}
                  </span>}
                </div>
              </div>
            </div>
          </div>
          {director && combat && (turn === "active" || canStart) && (
            <Button className="board-monster-action" size="sm" variant={turn === "active" ? "primary" : "soft"}
              aria-label={`${action}: ${unit.name}`} disabled={busy}
              onClick={() => void command(turn === "active" ? "combat-end-turn" : "combat-start-turn", {
                sceneId: scene.id, combatId: combat.id, side: "enemies", id: unit.id,
              })}>
              {action}
            </Button>
          )}
        </div>;
      })}
    </div>
    {viewedUnit && (statBlock && !viewing?.details ? (
      <SceneRuleDialog source={statBlock} onClose={() => setViewing(undefined)} error={error}
        stamina={inlineStamina ? {
          label: statBlock.minion ? "Выносливость отряда" : undefined,
          value: <SceneStaminaFields unit={viewedUnit} busy={busy} onChange={patch => change(viewedUnit.id, patch)} />,
        } : undefined}
        footer={<Button size="sm" variant="ghost"
          onClick={() => setViewing({ id: viewedUnit.id, details: true })}>Управление участником</Button>} />
    ) : (
      <CardDetailModal open title={viewedUnit.name} onClose={() => setViewing(undefined)}
        className="scene-ui table-dialog">
        <SceneCombatantCard key={viewedUnit.id} combatant={viewedUnit} director={director}
          turn={turnOf(combat, viewedUnit)} published={scene.published} inDialog busy={busy} error={error} showStamina={!inlineStamina}
          onOpenStatBlock={statBlock ? () => setViewing({ id: viewedUnit.id, details: false }) : undefined}
          onChange={patch => change(viewedUnit.id, patch)} />
      </CardDetailModal>
    ))}
  </>;
}
