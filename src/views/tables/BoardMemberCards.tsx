import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterAvatar } from "../../components/CharacterAvatar";
import { HelpTooltip } from "../../components/HelpTooltip";
import { Icon, type IconName } from "../../components/Icons";
import { Button } from "../../components/ui";
import { artFor } from "../../lib/art";
import { heroTurnPhase } from "../../lib/tables/combat";
import type { TableMember, TableSnapshot } from "../../lib/tables/types";
import { SharedHeroCard, SharedHeroDetails, SharedHeroStaminaBar, type SendTableCommand } from "./TableMembers";

type ResourceGlyph = [label: string, value: string | number, icon: IconName, tone: string];

export function BoardMemberCards({ table, command, busy, openHero }: {
  table: TableSnapshot;
  command: SendTableCommand;
  busy: boolean;
  openHero?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ userId: string; heroId: string } | null>(null);
  const playerSeats = useRef<HTMLDivElement>(null);
  const members = table.members;
  const isDemo = table.id === "demo-old-road";
  const open = pinned ?? focused ?? hovered;
  const openPlayer = members.find(member => member.role === "player" && member.userId === open);
  const currentMember = members.find(member => member.userId === viewing?.userId && member.hero?.id === viewing.heroId);
  const currentHero = currentMember?.hero;
  const combat = table.combat;
  const phaseFor = (member: TableMember) => combat && member.role === "player" && member.hero
    ? heroTurnPhase(combat, member.userId, member.hero.id) : undefined;
  const viewedPhase = currentMember && phaseFor(currentMember);
  const close = useCallback(() => {
    setPinned(null);
    setFocused(null);
    setHovered(null);
  }, []);

  const playerCardOpen = Boolean(openPlayer);
  useEffect(() => {
    if (!playerCardOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || playerSeats.current?.contains(event.target) ||
          event.target.closest(".help-tooltip-popup")) return;
      close();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [playerCardOpen, close]);

  const activatePlayer = (member: TableMember) => {
    if (pinned !== member.userId) {
      setPinned(member.userId);
    } else {
      close();
      if (!member.hero) return;
      if (member.userId === table.actorId && openHero) openHero(member.hero.id);
      else setViewing({ userId: member.userId, heroId: member.hero.id });
    }
  };
  const details = (member: TableMember, mobile = false) => {
    const hero = member.hero;
    const demoPortrait = isDemo && hero && !hero.avatarUrl
      ? artFor("ancestry", hero.ancestry)?.thumbnailSrc
      : undefined;
    if (member.role === "player") {
      const resources = hero?.resources;
      const counters: ResourceGlyph[] = resources ? [
        [resources.heroicResource.name || "Ресурс героя", resources.heroicResource.current, "abilities", "magenta"],
        ["Восстановления", `${resources.recoveries.current}/${resources.recoveries.max}`, "heart", "cyan"],
        ["Всплески", resources.surges, "spark", "yellow"],
        ["Жетоны героя", resources.heroTokens, "shield", "blue"],
        ...Object.entries(resources.additional ?? {}).map(([name, value]): ResourceGlyph => [name, value, "tag", "orange"]),
      ] : [];
      const phase = phaseFor(member);
      const sheetAction = member.userId === table.actorId && openHero ? "Открыть свой лист" : "Открыть лист";
      return <div className={`board-seat-details board-player-card${mobile ? " board-seat-details-mobile" : ""}`} data-turn={phase}
        onClick={event => {
          if (event.target instanceof Element && !event.target.closest("button, .help-tooltip-popup")) activatePlayer(member);
        }}
        onPointerLeave={mobile ? () => setHovered(current => current === member.userId ? null : current) : undefined}>
        {hero && <CharacterAvatar name={hero.name} url={hero.avatarUrl || demoPortrait} showInitials={false}
          className="board-player-portrait" />}
        <button className="board-player-action" type="button" onClick={() => activatePlayer(member)}
          aria-label={pinned === member.userId
            ? hero ? `${sheetAction}: ${hero.name}` : "Свернуть карточку"
            : `Закрепить карточку: ${hero?.name || member.name}`} />
        <div className="board-player-footer">
          <strong className="board-player-summary">{hero?.name || member.name}
            {phase === "done" && <Icon name="check" size={14} className="board-turn-check" aria-label="Ход завершён" />}
          </strong>
          {hero && <div className="board-player-stamina">
            <span aria-hidden="true">{hero.stamina.current}/{hero.stamina.max}{hero.stamina.temp > 0 && ` +${hero.stamina.temp}`}</span>
            <SharedHeroStaminaBar stamina={hero.stamina} />
          </div>}
          {counters.length > 0 && <div className="board-player-resources" role="group" aria-label="Ресурсы героя">
            {counters.map(([name, value, icon, tone], index) => <HelpTooltip key={`${index}-${name}`}
              className={`board-player-resource is-${tone}`} label={`${name}: ${value}`}
              trigger={<><Icon name={icon} size={16} /><span>{value}</span></>}>
              {name}
            </HelpTooltip>)}
          </div>}
        </div>
      </div>;
    }
    return <div className={`board-seat-details${mobile ? " board-seat-details-mobile" : ""}`}>
      <div className="board-seat-details-header">
        {hero && <CharacterAvatar name={hero.name} url={hero.avatarUrl || demoPortrait} showInitials={false}
          className={demoPortrait ? "board-seat-avatar is-demo-portrait" : "board-seat-avatar"} />}
        <strong>{member.name}{member.userId === table.actorId && " · вы"}</strong>
      </div>
      {member.role === "director" && <span className="muted">Ведущий</span>}
      {hero && <>
        <SharedHeroCard hero={hero} compact />
        <Button size="sm" icon="book" onClick={() => setViewing({ userId: member.userId, heroId: hero.id })}>Посмотреть лист</Button>
      </>}
    </div>;
  };

  const card = (member: TableMember) => {
    const expanded = open === member.userId;
    const label = member.hero?.name || member.name;
    const stamina = member.role === "player" ? member.hero?.stamina : undefined;
    const phase = phaseFor(member);
    const mayAct = combat && member.hero && (table.actorId === "local" || table.actorId === member.userId) &&
      (phase === "active" || phase === "ready" && combat.side === "heroes" && !combat.active);
    return (
      <div
        className={`board-seat${expanded ? " is-open" : ""}`}
        key={member.userId}
        data-turn={phase}
        onPointerLeave={event => {
          if (event.relatedTarget instanceof Element && event.relatedTarget.closest(".board-seat-details-mobile")) return;
          setHovered(current => current === member.userId ? null : current);
        }}
        onFocus={event => { if (event.target.matches(":focus-visible")) setFocused(member.userId); }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(current => current === member.userId ? null : current);
        }}
        onKeyDown={event => {
          if (event.key !== "Escape") return;
          event.currentTarget.querySelector("button")?.focus();
          close();
          event.stopPropagation();
        }}
      >
        {mayAct && combat && member.hero && <Button className="board-turn-action" size="sm"
          variant={phase === "active" ? "primary" : "soft"} disabled={busy}
          aria-label={`${phase === "active" ? "Завершить ход" : "Начать ход"}: ${label}`}
          onClick={() => void command(phase === "active" ? "combat-end-turn" : "combat-start-turn", {
            sceneId: combat.sceneId, combatId: combat.id, side: "heroes", id: member.userId, heroId: member.hero?.id,
          })}>
          {phase === "active" ? "Завершить ход" : "Начать ход"}
        </Button>}
        <button
          className="board-seat-tab"
          type="button"
          aria-expanded={expanded}
          aria-label={stamina ? `${label}. Выносливость: ${stamina.current} из ${stamina.max}${phase === "done" ? ". Ход завершён" : phase === "active" ? ". Ходит" : ""}` : undefined}
          onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(member.userId); }}
          onClick={() => {
            if (member.role === "player") activatePlayer(member);
            else if (pinned === member.userId) close();
            else setPinned(member.userId);
          }}
          title={member.role === "director" ? `${label} · Ведущий` : label}
        >
          <span className="board-seat-summary">
            <span className="board-seat-name">{label}{phase === "done" &&
              <Icon name="check" size={14} className="board-turn-check" aria-hidden="true" />}</span>
            {stamina && <span className="board-seat-stamina">
              <SharedHeroStaminaBar stamina={stamina} decorative />
              <span>{stamina.current}/{stamina.max}</span>
            </span>}
          </span>
        </button>
        {expanded && details(member)}
      </div>
    );
  };
  return <>
    {!isDemo && <div className="board-seats board-seats-director" aria-label="Ведущий">
      {members.filter(member => member.role === "director").map(card)}
    </div>}
    <div className="board-seats board-seats-players" ref={playerSeats} aria-label="Игроки" onKeyDown={event => {
      if (event.key === "Escape") {
        event.currentTarget.querySelector<HTMLButtonElement>(".board-seat-tab[aria-expanded=true]")?.focus();
        close();
      }
    }}>
      <div className="board-seats-scroll">{members.filter(member => member.role === "player").map(card)}</div>
      {openPlayer && details(openPlayer, true)}
    </div>
    <SharedHeroDetails hero={currentHero} onClose={() => setViewing(null)}
      combat={combat && viewedPhase ? { round: combat.round, phase: viewedPhase } : undefined} />
  </>;
}
