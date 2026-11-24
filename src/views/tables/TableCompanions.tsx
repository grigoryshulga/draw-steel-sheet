import { creatureDisplayName } from "./table-display";
import { useLocale } from "../../i18n/locale";
import { useId, useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { RuleArticleReader } from "../../components/rules/RuleArticleReader";
import { Button } from "../../components/ui";
import type { TableCompanion, TableSnapshot } from "../../lib/tables/types";
import { SceneCatalog } from "./SceneCatalog";
import { SharedHeroStaminaBar, type SendTableCommand } from "./TableMembers";

function CompanionEditor({ original, busy, error, onClose, onSave }: {
  original: TableCompanion | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (companion: TableCompanion) => Promise<boolean>;
}) {
  const { t: tr } = useLocale();
  const formId = useId();
  const [draft, setDraft] = useState<TableCompanion>(() => original ?? {
    id: crypto.randomUUID(), name: "", stamina: 1, maxStamina: 1,
  });
  return <CardDetailModal open title={original ? tr("Изменить спутника", "Edit companion") : tr("Добавить спутника вручную", "Add companion manually")}
    className="table-dialog" onClose={onClose} footer={<Button type="submit" form={formId}
      variant="primary" disabled={busy || !draft.name.trim()}>{original ? tr("Сохранить", "Save") : tr("Добавить", "Add")}</Button>}>
    <form id={formId} className="table-stack" onSubmit={async event => {
      event.preventDefault();
      if (!busy && draft.name.trim() && await onSave({ ...draft, name: draft.name.trim() })) onClose();
    }}>
      {error && <p role="alert">{error}</p>}
      <label>{tr("Имя", "Name")}<input autoFocus className="input" required maxLength={160} value={draft.name}
        onChange={event => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
      <div className="table-form-grid">
        <label>{tr("Текущая выносливость", "Current stamina")}<input className="input" type="number" required min={0} max={draft.maxStamina || 9999}
          value={Number.isNaN(draft.stamina) ? "" : draft.stamina}
          onChange={event => setDraft({ ...draft, stamina: event.currentTarget.valueAsNumber })} /></label>
        <label>{tr("Макс. выносливость", "Maximum stamina")}<input className="input" type="number" required min={1} max={9999}
          value={Number.isNaN(draft.maxStamina) ? "" : draft.maxStamina}
          onChange={event => setDraft({ ...draft, maxStamina: event.currentTarget.valueAsNumber })} /></label>
      </div>
    </form>
  </CardDetailModal>;
}

export function TableCompanions({ table, busy, command, commandError }: {
  table: TableSnapshot;
  busy: boolean;
  command: SendTableCommand;
  commandError: string;
}) {
  const { t: tr, locale } = useLocale();
  const director = table.actorId === table.ownerId;
  const canEdit = director && !table.archived;
  const companions = table.companions ?? [];
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogFooter, setCatalogFooter] = useState<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<TableCompanion | null>();
  const [viewing, setViewing] = useState<TableCompanion>();
  const conflict = editing && !companions.some(companion => companion.id === editing.id &&
    companion.name === editing.name && companion.stamina === editing.stamina &&
    companion.maxStamina === editing.maxStamina && companion.sourceId === editing.sourceId);
  const save = async (companion: TableCompanion) => Boolean(await command("save-companion", { companion }));
  return <section className="table-stack table-companions">
    <div className="table-section-heading">
      <h2>{tr("Спутники", "Companions")}</h2>
      {canEdit && <Button icon="plus" variant="primary" disabled={busy || companions.length >= 50}
        onClick={() => setCatalogOpen(true)}>{tr("Добавить спутника", "Add companion")}</Button>}
    </div>
    {companions.length === 0 && <p className="table-empty">{canEdit
      ? tr("Добавьте помощника из справочника или создайте своего спутника.", "Add a retainer from the reference or create a companion.")
      : tr("Ведущий пока не добавил спутников.", "The Director has not added companions yet.")}</p>}
    {companions.length > 0 && <ul className="table-member-list">
      {companions.map(companion => <li className="table-member-row" key={companion.id}>
        <div className="table-member-identity">
          <strong>{creatureDisplayName(companion.sourceId, companion.name, locale)}</strong>
          <span className="muted">{tr("Выносливость", "Stamina")} {companion.stamina} / {companion.maxStamina}</span>
          <SharedHeroStaminaBar stamina={{ current: companion.stamina, max: companion.maxStamina, temp: 0 }} decorative />
        </div>
        <div className="table-actions">
          {companion.sourceId && <Button size="sm" variant="ghost" icon="book" iconOnly
            onClick={() => setViewing(companion)}>{`${tr("Правила", "Rules")}: ${companion.name}`}</Button>}
          {canEdit && <>
            <Button size="sm" variant="ghost" icon="edit" iconOnly disabled={busy}
              onClick={() => setEditing(companion)}>{`${tr("Изменить", "Edit")}: ${companion.name}`}</Button>
            <Button size="sm" variant="ghost" icon="trash" iconOnly disabled={busy} onClick={() => {
              if (window.confirm(tr(`Убрать спутника «${companion.name}» со стола?`, `Remove companion “${companion.name}” from the table?`)))
                void command("delete-companion", { companionId: companion.id });
            }}>{`${tr("Удалить", "Remove")}: ${companion.name}`}</Button>
          </>}
        </div>
      </li>)}
    </ul>}
    {canEdit && catalogOpen && <CardDetailModal open wide title={tr("Добавить спутника", "Add companion")} className="table-dialog scene-catalog-modal"
      onClose={() => setCatalogOpen(false)}
      footer={<>
        <Button variant="ghost" disabled={busy || companions.length >= 50} onClick={() => {
          setCatalogOpen(false);
          setEditing(null);
        }}>{tr("Добавить вручную", "Add manually")}</Button>
        <div ref={setCatalogFooter} />
      </>}>
      {commandError && <p role="alert">{commandError}</p>}
      <SceneCatalog kind="retainer" actionHost={catalogFooter} busy={busy || companions.length >= 50}
        onAdd={seed => save({ id: crypto.randomUUID(), sourceId: seed.sourceId, name: seed.name,
          stamina: seed.maxStamina, maxStamina: seed.maxStamina })} />
    </CardDetailModal>}
    {editing !== undefined && <CompanionEditor original={editing} busy={busy || !canEdit || !!conflict}
      error={conflict ? tr("Данные спутника изменились. Закройте это окно и откройте его снова.", "This companion changed. Close and reopen this window.") : commandError}
      onClose={() => setEditing(undefined)} onSave={save} />}
    {viewing?.sourceId && <CardDetailModal open wide title={viewing.name} className="table-dialog"
      onClose={() => setViewing(undefined)}>
      <RuleArticleReader articleId={viewing.sourceId} />
    </CardDetailModal>}
  </section>;
}
