import { useEffect, useRef, useState } from "react";
import { combatAnnouncement } from "../../lib/tables/combat";
import type { TableCombat, TableSnapshot } from "../../lib/tables/types";

const sideNames = { heroes: "Ход игроков", enemies: "Ход ведущего" };

export function SceneCombatStatus({ combat, table }: { combat?: TableCombat; table?: TableSnapshot }) {
  const previous = useRef(combat);
  const [announcement, setAnnouncement] = useState<{ text: string; key: string }>();

  useEffect(() => {
    if (!table) return;
    const next = combatAnnouncement(table, previous.current);
    previous.current = table.combat;
    if (next || !table.combat) setAnnouncement(next);
  }, [table]);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(undefined), 2400);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  if (!combat) return null;

  return <span className="scene-combat-status" role="status">
    <span className="scene-combat-summary">
      <strong className="scene-round">Раунд {combat.round}</strong>
      <span>{combat.side ? sideNames[combat.side] : "Все сходили"}</span>
    </span>
    {announcement && <strong className="scene-combat-announcement" key={announcement.key}>{announcement.text}</strong>}
  </span>;
}
