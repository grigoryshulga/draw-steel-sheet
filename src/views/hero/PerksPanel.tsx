import { useState } from "react";
import { Icon } from "../../components/Icons";
import { RichText } from "../../components/RichText";
import { Button, Chip, EmptyState, Field, Modal, Panel, Select, TextInput } from "../../components/ui";
import {
  PERK_COMPENDIUM,
  PERK_TYPE_META,
  isPerkUsed,
  perkById,
  perkSlots,
  selectedPerkForSlot,
  type PerkSlot,
} from "../../data/perks";
import { useApp } from "../../state/AppContext";
import type { Character, Perk, PerkType, SelectedPerk } from "../../types";
import "./PerksPanel.css";

function typeChip(type: PerkType) {
  const meta = PERK_TYPE_META[type];
  return (
    <Chip key={type} tone={meta.tone}>
      {meta.short}
    </Chip>
  );
}

function typeLabel(type: PerkType): string {
  return PERK_TYPE_META[type].label;
}

export function PerksPanel() {
  const { character, update, notify } = useApp();
  const slots = perkSlots(character);
  const [pickerSlot, setPickerSlot] = useState<PerkSlot | null>(null);
  const [detail, setDetail] = useState<{ slot: PerkSlot; selected: SelectedPerk } | null>(null);

  const selectedCount = slots.filter((slot) => selectedPerkForSlot(character, slot)).length;

  const choose = (slot: PerkSlot, perk: Perk) => {
    update((current) => ({
      ...current,
      perks: [
        ...current.perks.filter((item) =>
          slot.source === "career"
            ? item.source !== "career"
            : !(item.source === "class" && item.level === slot.level),
        ),
        {
          perkId: perk.id,
          name: perk.name,
          type: perk.type,
          source: slot.source,
          level: slot.level,
        },
      ],
    }));
    setPickerSlot(null);
    notify(`Перк «${perk.name}» выбран`, "success");
  };

  const remove = (slot: PerkSlot) => {
    update((current) => ({
      ...current,
      perks: current.perks.filter((item) =>
        slot.source === "career"
          ? item.source !== "career"
          : !(item.source === "class" && item.level === slot.level),
      ),
    }));
    setDetail(null);
    notify("Перк убран", "info");
  };

  return (
    <Panel
      title="Перки"
      icon="spark"
      actions={
        <Chip tone={selectedCount === slots.length ? "accent" : "default"}>
          {selectedCount} / {slots.length}
        </Chip>
      }
      className="perks-panel"
    >
      <div className="perk-slots">
        {slots.map((slot) => {
          const selected = selectedPerkForSlot(character, slot);
          const perk = selected ? perkById(selected.perkId) : undefined;
          return (
            <section className="perk-slot" key={slot.key}>
              <header className="perk-slot-head">
                <span className="eyebrow">{slot.title}</span>
                <div className="perk-slot-types">
                  {slot.allowedTypes.slice(0, 3).map((type) => typeChip(type))}
                  {slot.allowedTypes.length > 3 && (
                    <Chip title={slot.allowedTypes.map(typeLabel).join(", ")}>
                      +{slot.allowedTypes.length - 3}
                    </Chip>
                  )}
                </div>
              </header>

              {selected ? (
                <div className="perk-chosen">
                  <div className="perk-chosen-head">
                    <h3>{selected.name}</h3>
                    {typeChip(selected.type)}
                  </div>
                  <p className="perk-summary">{perk?.summary ?? "Описание перка недоступно."}</p>
                  <div className="perk-actions">
                    <Button
                      size="sm"
                      variant="soft"
                      icon="book"
                      onClick={() => setDetail({ slot, selected })}
                    >
                      Подробнее
                    </Button>
                    <Button size="sm" icon="edit" onClick={() => setPickerSlot(slot)}>
                      Заменить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="close"
                      onClick={() => remove(slot)}
                    >
                      Убрать
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" className="perk-empty" onClick={() => setPickerSlot(slot)}>
                  <Icon name="plus" size={17} />
                  <span>Выбрать перк</span>
                </button>
              )}
            </section>
          );
        })}
      </div>


      {pickerSlot && (
        <PerkPicker
          slot={pickerSlot}
          character={character}
          onClose={() => setPickerSlot(null)}
          onChoose={(perk) => choose(pickerSlot, perk)}
        />
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Перк: ${detail.selected.name}` : "Перк"}
        footer={
          detail && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon="close"
                onClick={() => remove(detail.slot)}
              >
                Убрать
              </Button>
              <span className="grow" />
              <Button
                icon="edit"
                onClick={() => {
                  setPickerSlot(detail.slot);
                  setDetail(null);
                }}
              >
                Заменить
              </Button>
              <Button variant="primary" onClick={() => setDetail(null)}>
                Закрыть
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="perk-detail">
            <div className="hstack wrap">
              <Chip tone={PERK_TYPE_META[detail.selected.type].tone}>
                {typeLabel(detail.selected.type)}
              </Chip>
              <span className="small muted">{detail.slot.title}</span>
            </div>
            {(() => {
              const perk = perkById(detail.selected.perkId);
              return perk ? (
                <RichText text={perk.description} />
              ) : (
                <p className="muted">Полное описание этого перка недоступно.</p>
              );
            })()}
          </div>
        )}
      </Modal>
    </Panel>
  );
}

function PerkPicker({
  slot,
  character,
  onClose,
  onChoose,
}: {
  slot: PerkSlot;
  character: Character;
  onClose: () => void;
  onChoose: (perk: Perk) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PerkType | "all">("all");
  const [previewId, setPreviewId] = useState("");

  const eligible = PERK_COMPENDIUM.filter((perk) => slot.allowedTypes.includes(perk.type));
  const needle = query.trim().toLowerCase();
  const filtered = eligible.filter((perk) => {
    if (typeFilter !== "all" && perk.type !== typeFilter) return false;
    if (!needle) return true;
    return `${perk.name} ${perk.summary} ${typeLabel(perk.type)}`.toLowerCase().includes(needle);
  });
  const preview = filtered.find((perk) => perk.id === previewId) ?? filtered[0];
  const previewUsed = preview ? isPerkUsed(character, preview.id, slot) : false;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <span className="perk-picker-title">
          {slot.title}
        </span>
      }
      footer={
        <>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!preview || previewUsed}
            onClick={() => preview && onChoose(preview)}
          >
            {previewUsed ? "Уже выбран" : "Выбрать перк"}
          </Button>
        </>
      }
    >
      <div className="perk-picker-filters">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск перка…"
          aria-label="Поиск перка"
        />
        {slot.allowedTypes.length > 1 && (
          <Field label="Тип">
            <Select
              value={typeFilter}
              aria-label="Тип перка"
              onChange={(event) => setTypeFilter(event.target.value as PerkType | "all")}
            >
              <option value="all">Все доступные</option>
              {slot.allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" />
      ) : (
        <div className="perk-picker-body">
          <div className="perk-picker-list">
            {filtered.map((perk) => {
              const used = isPerkUsed(character, perk.id, slot);
              const active = preview?.id === perk.id;
              return (
                <button
                  key={perk.id}
                  type="button"
                  className={`perk-option ${active ? "is-active" : ""}`.trim()}
                  onClick={() => setPreviewId(perk.id)}
                >
                  <span className="perk-option-top">
                    <span className="perk-option-name">{perk.name}</span>
                    {used && <span className="perk-used">в листе</span>}
                  </span>
                  <span className="perk-option-meta">{typeLabel(perk.type)}</span>
                  <span className="perk-option-summary">{perk.summary}</span>
                </button>
              );
            })}
          </div>

          <aside className="perk-picker-preview">
            {preview ? (
              <>
                <h3>{preview.name}</h3>
                <div className="hstack wrap">
                  <Chip tone={PERK_TYPE_META[preview.type].tone}>
                    {typeLabel(preview.type)}
                  </Chip>
                  {previewUsed && <Chip tone="yellow">Уже выбран в другом слоте</Chip>}
                </div>
                <RichText text={preview.description} />
              </>
            ) : (
              <EmptyState icon="book" title="Выберите перк" />
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
