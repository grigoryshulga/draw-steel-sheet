import { resourceLabel } from "../../i18n/resource-language";
import { useLocale } from "../../i18n/locale";
import { useId, useState } from "react";
import { CardDetailModal } from "../../components/CardDetailModal";
import { Button } from "../../components/ui";
import type { ResourceGainLabel } from "../../lib/resources";
import type { Character } from "../../types";

export function DramaSourcesDialog({ gains, value, onClose, onSave }: {
  gains: readonly ResourceGainLabel[];
  value: Character["dramaSources"];
  onClose: () => void;
  onSave: (value: Character["dramaSources"]) => void;
}) {
  const { t, locale } = useLocale();
  const formId = useId();
  const [hidden, setHidden] = useState(() => new Set(value?.hidden));
  const [note, setNote] = useState(value?.note ?? "");
  return <CardDetailModal open title={t("Источники Драмы", "Drama sources")} onClose={onClose}
    footer={<Button type="submit" form={formId} variant="primary">{t("Сохранить", "Save")}</Button>}>
    <form id={formId} className="drama-sources-form" onSubmit={event => {
      event.preventDefault();
      const text = note.trim();
      onSave(hidden.size || text ? { hidden: [...hidden], note: text } : undefined);
    }}>
      <p className="muted">{t("Отметьте источники, которые хотите видеть на листе. Правила начисления Драмы действуют для всех источников.", "Select the sources to show on the sheet. Drama gain rules apply to every source.")}</p>
      {gains.length > 0 && <fieldset className="drama-sources-list">
        <legend className="sr-only">{t("Источники на листе", "Sources on sheet")}</legend>
        {gains.map(gain => <label key={gain.tag}>
          <input type="checkbox" checked={!hidden.has(gain.tag)} onChange={event => {
            const visible = event.currentTarget.checked;
            setHidden(previous => {
              const next = new Set(previous);
              if (visible) next.delete(gain.tag);
              else next.add(gain.tag);
              return next;
            });
          }} />
          {resourceLabel(gain.label, locale)}
        </label>)}
      </fieldset>}
      <label className="field">
        <span className="field-label">{t("Личная заметка", "Personal note")}</span>
        <textarea className="textarea" rows={3} maxLength={1000} value={note}
          onChange={event => setNote(event.currentTarget.value)} />
      </label>
    </form>
  </CardDetailModal>;
}
