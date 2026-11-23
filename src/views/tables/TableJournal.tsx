import { useId, useState } from "react";
import { Button } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import type { TableEvent, TableSnapshot } from "../../lib/tables/types";
import type { SendTableCommand } from "./TableMembers";

function EntryForm({ director, busy, entry, error, onSave }: {
  director: boolean;
  busy: boolean;
  entry?: TableEvent;
  error?: string;
  onSave: (text: string, isPublic: boolean) => Promise<boolean>;
}) {
  const textId = useId();
  const [text, setText] = useState(entry?.text ?? "");
  const [isPublic, setPublic] = useState(entry?.public ?? true);
  return <form className="table-journal-composer" onSubmit={async event => {
    event.preventDefault();
    if (!busy && text.trim() && await onSave(text.trim(), isPublic) && !entry) setText("");
  }}>
    {error && <p role="alert">{error}</p>}
    <div className="field">
      <label htmlFor={textId}>Запись</label>
      <textarea id={textId} className="textarea" required value={text} maxLength={entry ? 10000 : 4000} rows={entry ? 5 : 2}
        placeholder="Итог сцены, находка или важное решение…"
        onChange={event => setText(event.currentTarget.value)} />
    </div>
    <div className="table-actions table-form-footer">
      {director && <label className="table-check">
        <input type="checkbox" checked={isPublic} onChange={event => setPublic(event.currentTarget.checked)} />
        Видна игрокам
      </label>}
      <Button type="submit" size="sm" variant="primary" icon={entry ? undefined : "plus"}
        iconOnly={!entry} disabled={busy || !text.trim()}>
        {entry ? "Сохранить" : "Добавить запись"}
      </Button>
    </div>
  </form>;
}

export function TableJournal({ table, busy, command, commandError }: {
  table: TableSnapshot;
  busy: boolean;
  command: SendTableCommand;
  commandError: string;
}) {
  const director = table.actorId === table.ownerId;
  const [editing, setEditing] = useState<TableEvent>();
  const current = editing && table.events.find(event => event.id === editing.id);
  const conflict = editing && (!current || current.text !== editing.text || current.public !== editing.public);
  return <section className="table-stack table-journal-panel">
    <h2>Журнал стола</h2>
    {!table.archived && <EntryForm director={director} busy={busy}
      onSave={async (text, isPublic) => Boolean(await command("event", { text, public: director ? isPublic : true, kind: "message" }))} />}
    {table.events.length === 0 && <p className="table-empty">Здесь сохраняется история игры и записи участников.</p>}
    <ol className="table-journal">
      {[...table.events].reverse().map(event => {
        const own = event.actor === table.actorId;
        const manual = !table.archived && event.kind === "message";
        return <li key={event.id}>
          <div className="table-journal-entry-head">
            <div className="muted">
              <time dateTime={event.at}>{new Date(event.at).toLocaleString("ru")}</time>
              {" · "}{table.members.find(member => member.userId === event.actor)?.name ?? "Участник"}
              {!event.public && " · Только ведущему"}
              {event.editedAt && <> · <time dateTime={event.editedAt} title={new Date(event.editedAt).toLocaleString("ru")}>Изменена</time></>}
            </div>
            {manual && (own || director) && <div className="table-actions">
              {own && <Button size="sm" variant="ghost" icon="edit" iconOnly disabled={busy}
                onClick={() => setEditing(event)}>Изменить запись</Button>}
              <Button size="sm" variant="ghost" icon="trash" iconOnly disabled={busy} onClick={() => {
                if (window.confirm("Удалить запись из журнала стола?")) void command("event-delete", { eventId: event.id });
              }}>Удалить запись</Button>
            </div>}
          </div>
          <p className="table-prose">{event.text}</p>
        </li>;
      })}
    </ol>
    {editing && <CardDetailModal open title="Изменить запись" className="table-dialog" onClose={() => setEditing(undefined)}>
      <EntryForm entry={editing} director={director} busy={busy || table.archived || !!conflict}
        error={conflict ? "Запись изменилась. Закройте это окно и откройте её снова." : commandError}
        onSave={async (text, isPublic) => {
          const result = await command("event-edit", { eventId: editing.id, text, ...(director ? { public: isPublic } : {}) });
          if (result) setEditing(undefined);
          return Boolean(result);
        }} />
    </CardDetailModal>}
  </section>;
}
