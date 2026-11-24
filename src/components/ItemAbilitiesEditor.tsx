import { useLocale } from "../i18n/locale";
import "./ItemAbilitiesEditor.css";
import { useState } from "react";
import { ABILITY_COMPENDIUM } from "../data/compendium";
import { normalizeItemAbilityIds } from "../lib/item-ability-ids";
import { Button, Select, TextInput } from "./ui";
import { RuleText } from "./RuleText";

export function ItemAbilitiesEditor({ value = [], onChange, disabled = false }: {
  value?: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [selecting, setSelecting] = useState(false);
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const ids = normalizeItemAbilityIds(value);
  const needle = query.trim().toLocaleLowerCase("ru");
  const options = ABILITY_COMPENDIUM.filter(ability => !ids.includes(ability.id) &&
    `${ability.name} ${ability.originalName ?? ""} ${ability.source}`.toLocaleLowerCase("ru").includes(needle));
  const selected = options.find(ability => ability.id === selectedId) ?? options[0];
  return <section className="item-abilities-editor" aria-label={t("Способности предмета", "Item abilities")}>
    <h3>{t("Способности предмета", "Item abilities")}</h3>
    <p className="muted small">{t("Появляются на листе, пока предмет экипирован. Снятие или удаление предмета убирает его способности.", "These appear on the sheet while the item is equipped. Unequipping or removing the item removes its abilities.")}</p>
    {ids.map(id => <div className="hstack" key={id}>
      <span>{(locale === "en" ? ABILITY_COMPENDIUM.find(ability => ability.id === id)?.originalName : undefined) || ABILITY_COMPENDIUM.find(ability => ability.id === id)?.name || t("Способность недоступна в каталоге", "Ability unavailable in catalog")}</span>
      <Button size="sm" icon="trash" iconOnly disabled={disabled} onClick={() => onChange(ids.filter(value => value !== id))}>{t("Убрать способность предмета", "Remove item ability")}</Button>
    </div>)}
    {!selecting && <div><Button size="sm" icon="plus" disabled={disabled || ids.length >= 16} onClick={() => setSelecting(true)}>{t("Привязать способность", "Link an ability")}</Button></div>}
    {selecting && <>
    <TextInput aria-label={t("Поиск способности предмета", "Search item abilities")} placeholder={t("Поиск по названию или источнику…", "Search by name or source…")} value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} />
    <Select aria-label={t("Способность предмета", "Item ability")} value={selected?.id ?? ""} disabled={disabled || !options.length} onChange={event => setSelectedId(event.target.value)}>
      {!options.length && <option value="">{t("Способности не найдены", "No abilities found")}</option>}
      {options.map(ability => <option value={ability.id} key={ability.id}>{locale === "en" && ability.originalName ? ability.originalName : ability.name} · {ability.source}</option>)}
    </Select>
    {selected && <RuleText text={locale === "en" && selected.originalDescription ? selected.originalDescription : selected.effect || selected.flavor} />}
    <div className="hstack"><Button icon="plus" size="sm" disabled={disabled || !selected || ids.length >= 16} onClick={() => { if (selected) { onChange([...ids, selected.id]); setSelecting(false); } }}>{t("Добавить способность предмету", "Add ability to item")}</Button><Button size="sm" variant="ghost" onClick={() => setSelecting(false)}>{t("Отмена", "Cancel")}</Button></div>
    </>}
  </section>;
}
