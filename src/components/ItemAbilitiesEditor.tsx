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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const ids = normalizeItemAbilityIds(value);
  const needle = query.trim().toLocaleLowerCase("ru");
  const options = ABILITY_COMPENDIUM.filter(ability => !ids.includes(ability.id) &&
    `${ability.name} ${ability.originalName ?? ""} ${ability.source}`.toLocaleLowerCase("ru").includes(needle));
  const selected = options.find(ability => ability.id === selectedId) ?? options[0];
  return <section className="item-abilities-editor" aria-label="Способности предмета">
    <h3>Способности предмета</h3>
    <p className="muted small">Появляются на листе, пока предмет экипирован. Снятие или удаление предмета убирает его способности.</p>
    {ids.map(id => <div className="hstack" key={id}>
      <span>{ABILITY_COMPENDIUM.find(ability => ability.id === id)?.name ?? "Способность недоступна в каталоге"}</span>
      <Button size="sm" icon="trash" iconOnly disabled={disabled} onClick={() => onChange(ids.filter(value => value !== id))}>Убрать способность предмета</Button>
    </div>)}
    {!selecting && <div><Button size="sm" icon="plus" disabled={disabled || ids.length >= 16} onClick={() => setSelecting(true)}>Привязать способность</Button></div>}
    {selecting && <>
    <TextInput aria-label="Поиск способности предмета" placeholder="Поиск по названию или источнику…" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} />
    <Select aria-label="Способность предмета" value={selected?.id ?? ""} disabled={disabled || !options.length} onChange={event => setSelectedId(event.target.value)}>
      {!options.length && <option value="">Способности не найдены</option>}
      {options.map(ability => <option value={ability.id} key={ability.id}>{ability.name} · {ability.source}</option>)}
    </Select>
    {selected && <RuleText text={selected.effect || selected.flavor} />}
    <div className="hstack"><Button icon="plus" size="sm" disabled={disabled || !selected || ids.length >= 16} onClick={() => { if (selected) { onChange([...ids, selected.id]); setSelecting(false); } }}>Добавить способность предмету</Button><Button size="sm" variant="ghost" onClick={() => setSelecting(false)}>Отмена</Button></div>
    </>}
  </section>;
}
