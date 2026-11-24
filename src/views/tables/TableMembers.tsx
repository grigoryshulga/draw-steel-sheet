import { useLocale } from "../../i18n/locale";
import { lazy, Suspense, useState } from "react";
import { MemberActions } from "./MemberActions";
import { CardDetailModal } from "../../components/CardDetailModal";
import { CharacterAvatar } from "../../components/CharacterAvatar";
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

export function SharedHeroDetails({ hero, portraitUrl, onClose, combat }: {
  hero?: SharedHero | null;
  portraitUrl?: string;
  onClose: () => void;
  combat?: { round: number; phase: "ready" | "active" | "done" };
}) {
  const { t: tr } = useLocale();
  return <CardDetailModal open={!!hero} onClose={onClose} className="table-dialog shared-hero-modal" wide
    title={hero && <span className="shared-hero-title">
      <CharacterAvatar name={hero.name} url={portraitUrl} showInitials={false} />
      <span>{hero.name}</span>
    </span>}>
    {hero && <Suspense fallback={<p role="status">{tr("Загрузка листа…", "Loading sheet…")}</p>}><SharedHeroSheet hero={hero} combat={combat} /></Suspense>}
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
  const { t: tr } = useLocale();
  const value = Math.max(0, Math.min(current, max));
  const width = max > 0 ? value / max * 100 : 0;
  const accessibility = decorative ? { "aria-hidden": true as const } : {
    role: "meter",
    "aria-label": `${tr("Выносливость", "Stamina")}: ${current} ${tr("из", "of")} ${max}`,
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
  const { t: tr, locale } = useLocale();
  const resources = hero.resources;
  return (
    <div className={`table-hero${compact ? " is-compact" : " shared-hero-sheet"}`}>
      {compact && <h3>{hero.name || tr("Без имени", "Unnamed")}</h3>}
      <p className="muted">
        {hero.ancestry} · {hero.className} · {tr("Уровень", "Level")} {hero.level}
      </p>
      <SharedHeroStaminaBar stamina={hero.stamina} />
      <div className="table-vitals">
        <span>
          <strong>
            {hero.stamina.current} / {hero.stamina.max}
          </strong>{" "}
          {tr("Выносливость", "Stamina")}{hero.stamina.temp > 0 && ` (+${hero.stamina.temp})`}
        </span>
        <span>
          <strong>{resources.heroicResource.current}</strong>{" "}
          {resources.heroicResource.name || tr("Ресурс героя", "Heroic resource")}
        </span>
        <span>
          <strong>
            {resources.recoveries.current} / {resources.recoveries.max}
          </strong>{" "}
          {tr("Восстановления", "Recoveries")}
        </span>
        <span>
          <strong>{resources.surges}</strong> {tr("Всплески", "Surges")}
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
            ([name]) => {
              const condition = CONDITIONS.find((c) => c.key === name);
              return locale === "en" ? condition?.originalName || condition?.label || name : condition?.label ?? name;
            },
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
  const { t: tr } = useLocale();
  const sectionEnglish: Record<string, string> = { hero: "Hero", development: "Development", inventory: "Inventory", journal: "Journal", companions: "Companions" };
  return (
    <div className="table-sharing">
      <p>
        {tr("Основные показатели видны всем участникам. Выберите остальные разделы; их свободный текст тоже станет общим.", "Core stats are visible to everyone. Choose other sections to share, including their free text.")}
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
            {tr(label, sectionEnglish[section] ?? label)}
          </label>
        ))}
      </div>
      <p>{tr("Личные заметки открываются отдельно:", "Share personal notes separately:")}</p>
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
            {tr(note.label, ({ story: "Story", contacts: "Contacts", debts: "Debts", secrets: "Secrets", misc: "Miscellaneous" })[note.key])}
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
  const { t: tr } = useLocale();
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
        <h3>{tr("Участники", "Participants")}</h3>
        {players.length ? <ul className="table-member-list">
          {players.map(({ userId, name, hero }) => (
            <li key={userId} className="table-member-row">
              <div className="table-member-identity">
                <strong>{name}</strong>
                <span className="muted">{hero?.name ?? tr("Без героя", "No hero")}</span>
              </div>
              <MemberActions name={name}>
                <Button variant="ghost" disabled={disabled} onClick={() => {
                  if (confirm(tr(`Предложить ${name} роль ведущего?`, `Offer ${name} the Director role?`))) void command("transfer", { userId });
                }}>{tr("Передать роль", "Transfer role")}</Button>
                {hero && <Button variant="ghost" disabled={disabled} onClick={() => {
                  if (confirm(tr("Убрать героя из стола? Он останется у владельца.", "Remove this hero from the table? The owner will keep it."))) {
                    void command("remove-hero", { userId, heroId: hero.id });
                  }
                }}>{tr("Убрать героя", "Remove hero")}</Button>}
                <Button variant="danger" disabled={disabled} onClick={() => {
                  if (confirm(tr(`Исключить ${name} из стола?`, `Remove ${name} from the table?`))) void command("kick", { userId });
                }}>{tr("Исключить", "Remove")}</Button>
              </MemberActions>
            </li>
          ))}
        </ul> : <p className="table-empty">{tr("За столом пока нет игроков.", "There are no players at this table yet.")}</p>}
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
          {tr("Вам предложили стать ведущим. Ваши герои останутся у вас и будут убраны из этого стола.", "You have been offered the Director role. Your heroes remain yours and will be removed from this table.")}
        </p>
        <Button disabled={disabled} onClick={() => void command("accept-transfer")}>
          {tr("Принять роль ведущего", "Accept Director role")}
        </Button>
      </Card>
    )}
    <Card className="table-member-settings">
      <h3>{tr("Мои герои за столом", "My heroes at this table")}</h3>
      {heroIds.length ? <ul className="table-member-list">
        {heroIds.map(id => {
          const active = activeHero?.id === id;
          return <li key={id} className="table-member-row table-owned-hero">
            <strong>{active ? activeHero.name : characters.find(c => c.id === id)?.name ?? tr("Герой", "Hero")}</strong>
            <div className="table-actions">
              {active ? <>
                <span className="table-badge">{tr("Активный герой", "Active hero")}</span>
                <Button icon="book" iconOnly size="sm" variant="ghost" onClick={() => openHero(id)}>
                  {tr("Открыть свой лист", "Open your sheet")}
                </Button>
              </> : (
                <Button size="sm" disabled={disabled} onClick={() => void command("activate-hero", { heroId: id })}>
                  {tr("Сделать активным", "Make active")}
                </Button>
              )}
              <Button size="sm" icon="settings" iconOnly onClick={() => {
                setEditing(id);
                setVisibility(table.visibility[id] ?? DEFAULT_VISIBILITY);
              }}>
                {tr("Доступ к листу", "Sheet sharing")}
              </Button>
            </div>
          </li>;
        })}
      </ul> : <p className="table-empty">{tr("У вас пока нет героя за этим столом.", "You have no hero at this table yet.")}</p>}
      <CardDetailModal open={!!editing} onClose={() => setEditing(null)} title={tr("Доступ к листу", "Sheet sharing")} className="table-dialog" wide>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          <HeroVisibilityEditor value={visibility} onChange={setVisibility} />
          <div className="table-actions">
            <Button iconOnly icon="close" onClick={() => setEditing(null)}>{tr("Отмена", "Cancel")}</Button>
            <Button variant="primary" iconOnly icon="save" onClick={async () => {
              if (await command("visibility", { heroId: editing, visibility })) setEditing(null);
            }}>
              {tr("Сохранить доступ", "Save sharing")}
            </Button>
          </div>
        </fieldset>
      </CardDetailModal>
      {!table.archived && (
        <div className="table-actions">
          <Button icon="plus" onClick={() => { setVisibility(DEFAULT_VISIBILITY); setAddingHero(true); }}>
            {tr("Добавить героя", "Add hero")}
          </Button>
        </div>
      )}
      <CardDetailModal open={addingHero} onClose={() => setAddingHero(false)} title={tr("Добавить героя", "Add hero")} className="table-dialog" wide>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          <label>
            {tr("Герой", "Hero")}
            <select className="select" value={heroId} onChange={(event) => setHeroId(event.target.value)}>
              <option value="">{tr("Выберите героя", "Choose a hero")}</option>
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
            {tr("Добавить за стол", "Add to table")}
          </Button>
        </fieldset>
      </CardDetailModal>
    </Card>
  </>;
}
