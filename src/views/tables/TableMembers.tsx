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
export function SharedHeroCard({ hero, compact = false }: { hero: SharedHero; compact?: boolean }) {
  const resources = hero.resources;
  return (
    <div className={`table-hero${compact ? " is-compact" : " shared-hero-sheet"}`}>
      {compact && <h3>{hero.name || "Без имени"}</h3>}
      <p className="muted">
        {hero.ancestry} · {hero.className} · Уровень {hero.level}
      </p>
      <div className="shared-hero-hp" role="meter" aria-label={`Выносливость: ${hero.stamina.current} из ${hero.stamina.max}`} aria-valuemin={0} aria-valuemax={Math.max(1, hero.stamina.max)} aria-valuenow={Math.max(0, Math.min(hero.stamina.current, hero.stamina.max))} aria-valuetext={`${hero.stamina.current} / ${hero.stamina.max}`}>
        <span style={{ width: `${hero.stamina.max > 0 ? Math.max(0, Math.min(100, hero.stamina.current / hero.stamina.max * 100)) : 0}%` }} className={hero.stamina.current <= 0 ? "is-defeated" : hero.stamina.current <= hero.stamina.max / 2 ? "is-winded" : ""} />
      </div>
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

export function TableMembers({
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
  const [viewingHero, setViewingHero] = useState<SharedHero | null>(null);
  const [addingHero, setAddingHero] = useState(false);
  const [heroId, setHeroId] = useState("");
  const [visibility, setVisibility] =
    useState<HeroVisibility>(DEFAULT_VISIBILITY);
  const [editing, setEditing] = useState<string | null>(null);
  const currentHero = table.members.find((member) => member.hero?.id === viewingHero?.id)?.hero;
  return (
    <section className="table-stack">
      <div className="table-section-heading">
        <h2>Группа</h2>
        <span className="muted">Игроков: {table.members.filter((member) => member.role !== "director").length}</span>
      </div>
      {table.transferTo === table.actorId && (
        <Card>
          <p>
            Вам предложили стать ведущим. Ваши герои останутся у вас и будут
            убраны из этого стола.
          </p>
          <Button
            disabled={busy}
            onClick={() => void command("accept-transfer")}
          >
            Принять роль ведущего
          </Button>
        </Card>
      )}
      {!table.members.some((member) => member.role !== "director") && <p className="table-empty">За столом пока нет игроков.</p>}
      <div className="table-card-grid">
        {table.members.filter((member) => member.role !== "director").map((member) => (
          <Card key={member.userId} className="table-member-card">
            <div className="table-section-heading table-member-heading">
              <strong>{member.name}{member.userId === table.actorId ? " · вы" : ""}</strong>
              <div className="table-actions">
                {member.role === "director" && <span className="table-badge">Ведущий</span>}
                {member.hero && <Button icon="eye" iconOnly size="sm" variant="ghost" onClick={() => setViewingHero(member.hero)} aria-label={`Посмотреть героя: ${member.hero.name}`} title={`Посмотреть героя: ${member.hero.name}`}>Посмотреть героя</Button>}
                {member.hero && member.userId === table.actorId && <Button icon="book" iconOnly size="sm" variant="ghost" onClick={() => openHero(member.hero!.id)}>Открыть свой лист</Button>}
                {director && member.userId !== table.actorId && <MemberActions name={member.name}>
                  <Button variant="ghost" disabled={busy || table.archived} onClick={() => { if (confirm(`Предложить ${member.name} роль ведущего?`)) void command("transfer", { userId: member.userId }); }}>Передать роль</Button>
                  {member.hero && <Button variant="ghost" disabled={busy || table.archived} onClick={() => { if (confirm("Убрать героя из стола? Он останется у владельца.")) void command("remove-hero", { userId: member.userId, heroId: member.hero!.id }); }}>Убрать героя</Button>}
                  <Button variant="danger" disabled={busy || table.archived} onClick={() => { if (confirm(`Исключить ${member.name} из стола?`)) void command("kick", { userId: member.userId }); }}>Исключить</Button>
                </MemberActions>}
              </div>
            </div>
            {member.hero ? (
              <SharedHeroCard hero={member.hero} compact />
            ) : (
              <p className="muted">
                {member.role === "director"
                  ? "Ведёт этот стол"
                  : "Активный герой пока не выбран"}
              </p>
            )}
          </Card>
        ))}
      </div>
      {!director && (
        <Card>
          <h3>Мои герои за столом</h3>
          {table.myHeroIds.map((id) => (
            <div key={id} className="table-actions">
              <span>
                {characters.find((c) => c.id === id)?.name ?? "Герой"}
              </span>
              <Button
                disabled={
                  busy ||
                  table.archived ||
                  table.members.find((m) => m.userId === table.actorId)?.hero
                    ?.id === id
                }
                onClick={() => void command("activate-hero", { heroId: id })}
              >
                {table.members.find((m) => m.userId === table.actorId)?.hero
                  ?.id === id
                  ? "Активный герой"
                  : "Сделать активным"}
              </Button>
              <Button
                onClick={() => {
                  setEditing(id);
                  setVisibility(table.visibility[id] ?? DEFAULT_VISIBILITY);
                }}
                icon="settings"
                iconOnly
              >
                Доступ к листу
              </Button>
            </div>
          ))}
          <CardDetailModal open={!!editing} onClose={() => setEditing(null)} title="Доступ к листу" className="table-dialog" wide>
            {error && <p role="alert">{error}</p>}
            <fieldset disabled={busy}>
              <HeroVisibilityEditor
                value={visibility}
                onChange={setVisibility}
              />
              <div className="table-actions">
                <Button iconOnly icon="close" onClick={() => setEditing(null)}>Отмена</Button>
                <Button variant="primary" iconOnly icon="save"
                  onClick={async () => {
                    if (
                      await command("visibility", {
                        heroId: editing,
                        visibility,
                      })
                    )
                      setEditing(null);
                  }}
                >
                  Сохранить доступ
                </Button>
              </div>
            </fieldset>
          </CardDetailModal>
          {!table.archived && <div className="table-actions"><Button icon="plus" onClick={() => { setVisibility(DEFAULT_VISIBILITY); setAddingHero(true); }}>Добавить героя</Button></div>}
          <CardDetailModal open={addingHero} onClose={() => setAddingHero(false)} title="Добавить героя" className="table-dialog" wide>
              {error && <p role="alert">{error}</p>}
              <fieldset disabled={busy}>
                <label>
                  Герой
                  <select
                    className="select"
                    value={heroId}
                    onChange={(e) => setHeroId(e.target.value)}
                  >
                    <option value="">Выберите героя</option>
                    {characters
                      .filter((c) => !table.myHeroIds.includes(c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <HeroVisibilityEditor
                  value={visibility}
                  onChange={setVisibility}
                />
                <Button
                  disabled={!heroId}
                  onClick={async () => {
                    if (await command("attach-hero", { heroId, visibility })) {
                      setHeroId("");
                      setAddingHero(false);
                    }
                  }}
                >
                  Добавить за стол
                </Button>
              </fieldset>
          </CardDetailModal>
        </Card>
      )}
      <CardDetailModal open={!!currentHero} onClose={() => setViewingHero(null)} title={currentHero?.name ?? "Герой"} className="table-dialog shared-hero-modal" wide>
        {currentHero && <Suspense fallback={<p role="status">Загрузка листа…</p>}><SharedHeroSheet hero={currentHero} /></Suspense>}
      </CardDetailModal>
    </section>
  );
}
