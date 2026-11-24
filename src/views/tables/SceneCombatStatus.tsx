import { useLocale } from "../../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { combatAnnouncement } from "../../lib/tables/combat";
import type { TableCombat, TableSnapshot } from "../../lib/tables/types";

const sideNames = { heroes: "Ход игроков", enemies: "Ход ведущего" };

export function SceneCombatStatus({ combat, table }: { combat?: TableCombat; table?: TableSnapshot }) {
  const { locale, t: tr } = useLocale();
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
      <strong className="scene-round">{tr("Раунд", "Round")} {combat.round}</strong>
      <span>{combat.side ? tr(sideNames[combat.side], combat.side === "heroes" ? "Players’ turn" : "Director’s turn") : tr("Все сходили", "Everyone has acted")}</span>
    </span>
    {announcement && <strong className="scene-combat-announcement" key={announcement.key}>{locale === "en" ? announcement.text.replace(/^Ходит (.*)!$/, "$1’s turn!").replace("Достать мечи!", "Draw swords!").replace("К бою!", "To battle!").replace("Украсть дроу!", "Steal the drow!").replace("Рисуй сталь!", "Draw steel!").replace("Мечи наголо!", "Swords drawn!").replace("Поднять оружие!", "Raise your weapons!").replace("В атаку!", "Attack!") : announcement.text}</strong>}
  </span>;
}
