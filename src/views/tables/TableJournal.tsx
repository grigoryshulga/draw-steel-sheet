import { useLocale } from "../../i18n/locale";
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
  const { t: tr } = useLocale();
  const textId = useId();
  const [text, setText] = useState(entry?.text ?? "");
  const [isPublic, setPublic] = useState(entry?.public ?? true);
  return <form className="table-journal-composer" onSubmit={async event => {
    event.preventDefault();
    if (!busy && text.trim() && await onSave(text.trim(), isPublic) && !entry) setText("");
  }}>
    {error && <p role="alert">{error}</p>}
    <div className="field">
      <label htmlFor={textId}>{tr("Запись", "Entry")}</label>
      <textarea id={textId} className="textarea" required value={text} maxLength={entry ? 10000 : 4000} rows={entry ? 5 : 2}
        placeholder={tr("Итог сцены, находка или важное решение…", "Scene outcome, discovery, or important decision…")}
        onChange={event => setText(event.currentTarget.value)} />
    </div>
    <div className="table-actions table-form-footer">
      {director && <label className="table-check">
        <input type="checkbox" checked={isPublic} onChange={event => setPublic(event.currentTarget.checked)} />
        {tr("Видна игрокам", "Visible to players")}
      </label>}
      <Button type="submit" size="sm" variant="primary" icon={entry ? undefined : "plus"}
        iconOnly={!entry} disabled={busy || !text.trim()}>
        {entry ? tr("Сохранить", "Save") : tr("Добавить запись", "Add entry")}
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
  const { t: tr } = useLocale();
  const director = table.actorId === table.ownerId;
  const [editing, setEditing] = useState<TableEvent>();
  const current = editing && table.events.find(event => event.id === editing.id);
  const conflict = editing && (!current || current.text !== editing.text || current.public !== editing.public);
  return <section className="table-stack table-journal-panel">
    <h2>{tr("Журнал стола", "Table journal")}</h2>
    {!table.archived && <EntryForm director={director} busy={busy}
      onSave={async (text, isPublic) => Boolean(await command("event", { text, public: director ? isPublic : true, kind: "message" }))} />}
    {table.events.length === 0 && <p className="table-empty">{tr("Здесь сохраняется история игры и записи участников.", "Game history and members’ entries appear here.")}</p>}
    <ol className="table-journal">
      {[...table.events].reverse().map(event => {
        const own = event.actor === table.actorId;
        const manual = !table.archived && event.kind === "message";
        return <li key={event.id}>
          <div className="table-journal-entry-head">
            <div className="muted">
              <time dateTime={event.at}>{new Date(event.at).toLocaleString("ru")}</time>
              {" · "}{table.members.find(member => member.userId === event.actor)?.name ?? tr("Участник", "Member")}
              {!event.public && tr(" · Только ведущему", " · Director only")}
              {event.editedAt && <> · <time dateTime={event.editedAt} title={new Date(event.editedAt).toLocaleString("ru")}>{tr("Изменена", "Edited")}</time></>}
            </div>
            {manual && (own || director) && <div className="table-actions">
              {own && <Button size="sm" variant="ghost" icon="edit" iconOnly disabled={busy}
                onClick={() => setEditing(event)}>{tr("Изменить запись", "Edit entry")}</Button>}
              <Button size="sm" variant="ghost" icon="trash" iconOnly disabled={busy} onClick={() => {
                if (window.confirm(tr("Удалить запись из журнала стола?", "Delete this table journal entry?"))) void command("event-delete", { eventId: event.id });
              }}>{tr("Удалить запись", "Delete entry")}</Button>
            </div>}
          </div>
          <p className="table-prose">{event.text}</p>
        </li>;
      })}
    </ol>
    {editing && <CardDetailModal open title={tr("Изменить запись", "Edit entry")} className="table-dialog" onClose={() => setEditing(undefined)}>
      <EntryForm entry={editing} director={director} busy={busy || table.archived || !!conflict}
        error={conflict ? tr("Запись изменилась. Закройте это окно и откройте её снова.", "This entry changed. Close and reopen this window.") : commandError}
        onSave={async (text, isPublic) => {
          const result = await command("event-edit", { eventId: editing.id, text, ...(director ? { public: isPublic } : {}) });
          if (result) setEditing(undefined);
          return Boolean(result);
        }} />
    </CardDetailModal>}
  </section>;
}
