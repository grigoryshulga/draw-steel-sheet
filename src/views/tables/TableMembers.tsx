import { lazy, Suspense, useState } from "react";
import { MemberActions } from "./MemberActions";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button, Card } from "../../components/ui";
import { NOTE_SECTIONS } from "../../data/notes";
import { CONDITIONS } from "../../data/conditions";
import type { CharacterSummary } from "../../types";
import type {
  HeroVisibility,
  SharedHero,
  TableSection,
  TableSnapshot,
} from "../../lib/tables/types";

const SharedHeroSheet = lazy(() => import("./SharedHeroSheet").then((module) => ({ default: module.SharedHeroSheet })));

export function SharedHeroDetails({ hero, onClose, combat }: {
  hero?: SharedHero | null;
  onClose: () => void;
  combat?: { round: number; phase: "ready" | "active" | "done" };
}) {
  return <CardDetailModal open={!!hero} onClose={onClose} title={hero?.name ?? "Герой"} className="table-dialog shared-hero-modal" wide>
    {hero && <Suspense fallback={<p role="status">Загрузка листа…</p>}><SharedHeroSheet hero={hero} combat={combat} /></Suspense>}
  </CardDetailModal>;
}

export type SendTableCommand = (
  type: string,
  payload?: Record<string, unknown>,
) => Promise<TableSnapshot | null>;
export const SECTION_NAMES: Record<TableSection, string> = {
  hero: "Герой",
  development: "Развитие",
  inventory: "Инвентарь",
  journal: "Журнал",
  companions: "Спутники",
};
const DEFAULT_VISIBILITY: HeroVisibility = {
  sections: ["hero", "development", "inventory", "journal", "companions"],
  notes: [],
};

export function SharedHeroStaminaBar({ stamina: { current, max }, decorative = false }: {
  stamina: SharedHero["stamina"];
  decorative?: boolean;
}) {
  const value = Math.max(0, Math.min(current, max));
  const width = max > 0 ? value / max * 100 : 0;
  const accessibility = decorative ? { "aria-hidden": true as const } : {
    role: "meter",
    "aria-label": `Выносливость: ${current} из ${max}`,
    "aria-valuemin": 0,
    "aria-valuemax": Math.max(1, max),
    "aria-valuenow": value,
    "aria-valuetext": `${current} / ${max}`,
  };
  return <span className="shared-hero-hp" {...accessibility}>
    <span style={{ width: `${width}%` }} className={current <= 0 ? "is-defeated" : current <= max / 2 ? "is-winded" : ""} />
  </span>;
}

export function SharedHeroCard({ hero, compact = false }: { hero: SharedHero; compact?: boolean }) {
  const resources = hero.resources;
  return (
    <div className={`table-hero${compact ? " is-compact" : " shared-hero-sheet"}`}>
      {compact && <h3>{hero.name || "Без имени"}</h3>}
      <p className="muted">
        {hero.ancestry} · {hero.className} · Уровень {hero.level}
      </p>
      <SharedHeroStaminaBar stamina={hero.stamina} />
      <div className="table-vitals">
        <span>
          <strong>
            {hero.stamina.current} / {hero.stamina.max}
          </strong>{" "}
          Выносливость{hero.stamina.temp > 0 && ` (+${hero.stamina.temp})`}
        </span>
        <span>
          <strong>{resources.heroicResource.current}</strong>{" "}
          {resources.heroicResource.name || "Ресурс героя"}
        </span>
        <span>
          <strong>
            {resources.recoveries.current} / {resources.recoveries.max}
          </strong>{" "}
          Восстановления
        </span>
        <span>
          <strong>{resources.surges}</strong> Всплески
        </span>
        <span>
          <strong>{resources.heroTokens}</strong> Жетоны героя
        </span>
      </div>
      {Object.entries(resources.additional ?? {}).map(([name, value]) => (
        <span className="chip" key={name}>
          {name}: {value}
        </span>
      ))}
      {Object.values(hero.conditions).some((condition) => condition.active) && <p className="shared-hero-conditions">
        {Object.entries(hero.conditions)
          .filter(([, c]) => c.active)
          .map(
            ([name]) => CONDITIONS.find((c) => c.key === name)?.label ?? name,
          )
          .join(", ")}
      </p>}
    </div>
  );
}

export function HeroVisibilityEditor({
  value,
  onChange,
}: {
  value: HeroVisibility;
  onChange: (value: HeroVisibility) => void;
}) {
  return (
    <div className="table-sharing">
      <p>
        Основные показатели видны всем участникам. Выберите остальные разделы;
        их свободный текст тоже станет общим.
      </p>
      <div className="table-checks">
        {Object.entries(SECTION_NAMES).map(([section, label]) => (
          <label key={section}>
            <input
              type="checkbox"
              checked={value.sections.includes(section as TableSection)}
              onChange={(e) =>
                onChange({
                  ...value,
                  sections: e.target.checked
                    ? [...value.sections, section as TableSection]
                    : value.sections.filter((s) => s !== section),
                })
              }
            />
            {label}
          </label>
        ))}
      </div>
      <p>Личные заметки открываются отдельно:</p>
      <div className="table-checks">
        {NOTE_SECTIONS.map((note) => (
          <label key={note.key}>
            <input
              type="checkbox"
              checked={value.notes.includes(note.key)}
              onChange={(e) =>
                onChange({
                  ...value,
                  notes: e.target.checked
                    ? [...value.notes, note.key]
                    : value.notes.filter((n) => n !== note.key),
                })
              }
            />
            {note.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function TableMemberSettings({
  table,
  characters,
  busy,
  command,
  openHero,
  error = "",
}: {
  table: TableSnapshot;
  characters: CharacterSummary[];
  busy: boolean;
  command: SendTableCommand;
  openHero: (id: string) => void;
  error?: string;
}) {
  const director = table.actorId === table.ownerId;
  const [addingHero, setAddingHero] = useState(false);
  const [heroId, setHeroId] = useState("");
  const [visibility, setVisibility] =
    useState<HeroVisibility>(DEFAULT_VISIBILITY);
  const [editing, setEditing] = useState<string | null>(null);
  const disabled = busy || table.archived;
  if (director) {
    const players = table.members.filter(member => member.role === "player");
    return (
      <Card className="table-member-settings">
        <h3>Участники</h3>
        {players.length ? <ul className="table-member-list">
          {players.map(({ userId, name, hero }) => (
            <li key={userId} className="table-member-row">
              <div className="table-member-identity">
                <strong>{name}</strong>
                <span className="muted">{hero?.name ?? "Без героя"}</span>
              </div>
              <MemberActions name={name}>
                <Button variant="ghost" disabled={disabled} onClick={() => {
                  if (confirm(`Предложить ${name} роль ведущего?`)) void command("transfer", { userId });
                }}>Передать роль</Button>
                {hero && <Button variant="ghost" disabled={disabled} onClick={() => {
                  if (confirm("Убрать героя из стола? Он останется у владельца.")) {
                    void command("remove-hero", { userId, heroId: hero.id });
                  }
                }}>Убрать героя</Button>}
                <Button variant="danger" disabled={disabled} onClick={() => {
                  if (confirm(`Исключить ${name} из стола?`)) void command("kick", { userId });
                }}>Исключить</Button>
              </MemberActions>
            </li>
          ))}
        </ul> : <p className="table-empty">За столом пока нет игроков.</p>}
      </Card>
    );
  }

  const activeHero = table.members.find(member => member.userId === table.actorId)?.hero;
  const heroIds = activeHero && !table.myHeroIds.includes(activeHero.id)
    ? [activeHero.id, ...table.myHeroIds] : table.myHeroIds;

  return <>
    {table.transferTo === table.actorId && (
      <Card className="table-member-settings">
        <p>
          Вам предложили стать ведущим. Ваши герои останутся у вас и будут
          убраны из этого стола.
        </p>
        <Button disabled={disabled} onClick={() => void command("accept-transfer")}>
          Принять роль ведущего
        </Button>
      </Card>
    )}
    <Card className="table-member-settings">
      <h3>Мои герои за столом</h3>
      {heroIds.length ? <ul className="table-member-list">
        {heroIds.map(id => {
          const active = activeHero?.id === id;
          return <li key={id} className="table-member-row table-owned-hero">
            <strong>{active ? activeHero.name : characters.find(c => c.id === id)?.name ?? "Герой"}</strong>
            <div className="table-actions">
              {active ? <>
                <span className="table-badge">Активный герой</span>
                <Button icon="book" iconOnly size="sm" variant="ghost" onClick={() => openHero(id)}>
                  Открыть свой лист
                </Button>
              </> : (
                <Button size="sm" disabled={disabled} onClick={() => void command("activate-hero", { heroId: id })}>
                  Сделать активным
                </Button>
              )}
              <Button size="sm" icon="settings" iconOnly onClick={() => {
                setEditing(id);
                setVisibility(table.visibility[id] ?? DEFAULT_VISIBILITY);
              }}>
                Доступ к листу
              </Button>
            </div>
          </li>;
        })}
      </ul> : <p className="table-empty">У вас пока нет героя за этим столом.</p>}
      <CardDetailModal open={!!editing} onClose={() => setEditing(null)} title="Доступ к листу" className="table-dialog" wide>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          <HeroVisibilityEditor value={visibility} onChange={setVisibility} />
          <div className="table-actions">
            <Button iconOnly icon="close" onClick={() => setEditing(null)}>Отмена</Button>
            <Button variant="primary" iconOnly icon="save" onClick={async () => {
              if (await command("visibility", { heroId: editing, visibility })) setEditing(null);
            }}>
              Сохранить доступ
            </Button>
          </div>
        </fieldset>
      </CardDetailModal>
      {!table.archived && (
        <div className="table-actions">
          <Button icon="plus" onClick={() => { setVisibility(DEFAULT_VISIBILITY); setAddingHero(true); }}>
            Добавить героя
          </Button>
        </div>
      )}
      <CardDetailModal open={addingHero} onClose={() => setAddingHero(false)} title="Добавить героя" className="table-dialog" wide>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          <label>
            Герой
            <select className="select" value={heroId} onChange={(event) => setHeroId(event.target.value)}>
              <option value="">Выберите героя</option>
              {characters.filter(c => !heroIds.includes(c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <HeroVisibilityEditor value={visibility} onChange={setVisibility} />
          <Button disabled={!heroId} onClick={async () => {
            if (await command("attach-hero", { heroId, visibility })) {
              setHeroId("");
              setAddingHero(false);
            }
          }}>
            Добавить за стол
          </Button>
        </fieldset>
      </CardDetailModal>
    </Card>
  </>;
}
