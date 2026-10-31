import { useState } from "react";
import { PerkCard } from "../../components/PerkCard";
import { PerkDetailModal } from "../../components/PerkDetailModal";
import { RichText } from "../../components/RichText";
import {
  Button,
  Chip,
  Field,
  Modal,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "../../components/ui";
import {
  ALL_PERK_TYPES,
  PERK_COMPENDIUM,
  PERK_TYPE_META,
  perkById,
  perkSlots,
  selectedPerkForSlot,
  type PerkSlot,
} from "../../data/perks";
import { makeId } from "../../data/templates";
import { useApp } from "../../state/AppContext";
import type { Perk, PerkType, SelectedPerk } from "../../types";
import "./SheetPerksPanel.css";

interface CustomPerkDraft {
  name: string;
  type: PerkType;
  summary: string;
  description: string;
}

/** Компактный блок перков на листе: слоты, свои перки и описания. */
export function SheetPerksPanel() {
  const { character, update, goTo, notify } = useApp();
  const [detail, setDetail] = useState<{ selected: SelectedPerk; slot?: PerkSlot } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SelectedPerk | null>(null);
  const [pickingSlot, setPickingSlot] = useState<PerkSlot | null>(null);
  const [pickingFree, setPickingFree] = useState(false);

  const slots = perkSlots(character);
  const customPerks = character.perks.filter((perk) => perk.source === "custom");

  const saveCustom = (draft: CustomPerkDraft, initial?: SelectedPerk) => {
    const next: SelectedPerk = {
      perkId: initial?.perkId ?? `custom-${makeId()}`,
      name: draft.name.trim(),
      type: draft.type,
      source: "custom",
      level: character.level,
      summary: draft.summary.trim(),
      description: draft.description.trim(),
    };

    update((current) => ({
      ...current,
      perks: initial
        ? current.perks.map((perk) =>
            perk.source === "custom" && perk.perkId === initial.perkId ? next : perk,
          )
        : [...current.perks, next],
    }));

    setCreating(false);
    setEditing(null);
    notify(initial ? "Свой перк обновлён" : "Свой перк добавлен", "success");
  };

  const removeCustom = (perk: SelectedPerk) => {
    update((current) => ({
      ...current,
      perks: current.perks.filter(
        (item) => !(item.source === "custom" && item.perkId === perk.perkId),
      ),
    }));
    setDetail(null);
    notify("Свой перк удалён", "info");
  };

  const addFromCatalog = (perk: Perk, slot?: PerkSlot) => {
    const selected: SelectedPerk = {
      perkId: perk.id,
      name: perk.name,
      type: perk.type,
      source: slot?.source ?? "custom",
      level: slot?.level ?? character.level,
      summary: perk.summary,
      description: perk.description,
    };

    update((current) => {
      const withoutSlot = slot
        ? current.perks.filter((item) =>
            slot.source === "career"
              ? item.source !== "career"
              : !(item.source === "class" && item.level === slot.level),
          )
        : current.perks;
      return { ...current, perks: [...withoutSlot, selected] };
    });

    setPickingSlot(null);
    setPickingFree(false);
    notify(`Перк «${perk.name}» добавлен`, "success");
  };

  const detailPerk = detail ? perkById(detail.selected.perkId) : undefined;
  const detailText = detail
    ? detail.selected.source === "custom"
      ? detail.selected.description ||
        detail.selected.summary ||
        detailPerk?.description ||
        ""
      : (detailPerk?.description ?? "")
    : "";

  return (
    <>
      <Panel
        title="Перки"
        icon="spark"
        className="sheet-perks-panel"
        actions={
          <Button size="sm" variant="ghost" icon="edit" onClick={() => goTo("development")}>
            Изменить
          </Button>
        }
      >
        <div className="perk-card-grid">
          {slots.map((slot) => {
            const selected = selectedPerkForSlot(character, slot);
            const perk = selected ? perkById(selected.perkId) : undefined;

            if (!selected) {
              return (
                <article className="sheet-perk-card is-empty" key={slot.key}>
                  <header className="sheet-perk-head">
                    <span className="eyebrow">{slot.title}</span>
                  </header>
                  <button
                    type="button"
                    className="sheet-perk-empty"
                    onClick={() => setPickingSlot(slot)}
                    title="Выбрать перк из списка"
                  >
                    <span className="sheet-perk-empty-title">Не выбран</span>
                  </button>
                </article>
              );
            }

            return (
              <PerkCard
                key={slot.key}
                eyebrow={slot.title}
                name={selected.name}
                originalName={perk?.originalName}
                type={selected.type}
                summary={
                  perk?.summary ??
                  selected.summary ??
                  "Описание перка недоступно."
                }
                onOpen={() => setDetail({ selected, slot })}
              />
            );
          })}
        </div>

        <div className="sheet-perk-custom-head">
          <div>
            <span className="eyebrow">Дополнительные перки</span>
          </div>
          <div className="sheet-perk-custom-buttons">
            <Button
              size="sm"
              variant="soft"
              icon="book"
              onClick={() => setPickingFree(true)}
            >
              Выбрать из списка
            </Button>
            <Button size="sm" variant="soft" icon="plus" onClick={() => setCreating(true)}>
              Добавить свой
            </Button>
          </div>
        </div>

        {customPerks.length > 0 && (
          <div className="perk-card-grid sheet-perk-custom-grid">
            {customPerks.map((perk) => {
              const fromCatalog = !!perkById(perk.perkId);
              return (
                <PerkCard
                  key={perk.perkId}
                  eyebrow={fromCatalog ? "Из списка" : "Свой перк"}
                  name={perk.name}
                  originalName={perkById(perk.perkId)?.originalName}
                  type={perk.type}
                  summary={
                    perk.summary ||
                    perk.description ||
                    "Описание не заполнено."
                  }
                  className="is-custom"
                  onOpen={() => setDetail({ selected: perk })}
                  footerAction={
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="edit"
                      onClick={() => setEditing(perk)}
                    >
                      Изменить
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </Panel>

      <PerkDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.selected.name ?? ""}
        type={detail?.selected.type}
        eyebrow={detail?.slot?.title}
        summary={
          detail
            ? (detail.selected.summary ??
              detailPerk?.summary ??
              "Описание перка недоступно.")
            : undefined
        }
        description={detailText}
        action={
          detail?.selected.source === "custom" ? (
            <>
              <Button
                variant="ghost"
                icon="edit"
                onClick={() => {
                  setEditing(detail.selected);
                  setDetail(null);
                }}
              >
                Изменить
              </Button>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => removeCustom(detail.selected)}
              >
                Удалить
              </Button>
            </>
          ) : undefined
        }
      />

      {(creating || editing) && (
        <CustomPerkModal
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(draft) => saveCustom(draft, editing ?? undefined)}
        />
      )}

      {(pickingSlot || pickingFree) && (
        <PerkCatalogModal
          title={pickingSlot ? `Перк: ${pickingSlot.title}` : "Доступные перки"}
          allowedTypes={pickingSlot?.allowedTypes}
          existingIds={new Set(character.perks.map((perk) => perk.perkId))}
          onClose={() => {
            setPickingSlot(null);
            setPickingFree(false);
          }}
          onSelect={(perk) => addFromCatalog(perk, pickingSlot ?? undefined)}
        />
      )}
    </>
  );
}

function CustomPerkModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: SelectedPerk;
  onClose: () => void;
  onSave: (draft: CustomPerkDraft) => void;
}) {
  const [draft, setDraft] = useState<CustomPerkDraft>({
    name: initial?.name ?? "",
    type: initial?.type ?? "lore",
    summary: initial?.summary ?? "",
    description: initial?.description ?? "",
  });
  const valid = draft.name.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Изменить свой перк" : "Новый свой перк"}
      footer={
        <>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="sheet-perk-form">
        <Field label="Название">
          <TextInput
            value={draft.name}
            autoFocus
            placeholder="Например: Хитрый план"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label="Тип">
          <Select
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as PerkType })
            }
          >
            {ALL_PERK_TYPES.map((type) => (
              <option key={type} value={type}>
                {PERK_TYPE_META[type].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Краткое описание">
          <TextArea
            rows={2}
            value={draft.summary}
            placeholder="Что даёт перк в двух словах"
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          />
        </Field>
        <Field label="Полное описание">
          <TextArea
            rows={5}
            value={draft.description}
            placeholder="Полный текст перка"
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function PerkCatalogModal({
  title,
  allowedTypes,
  existingIds,
  onClose,
  onSelect,
}: {
  title: string;
  allowedTypes?: PerkType[];
  existingIds: Set<string>;
  onClose: () => void;
  onSelect: (perk: Perk) => void;
}) {
  const types = allowedTypes ?? ALL_PERK_TYPES;
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PerkType | "all">("all");
  const [selectedId, setSelectedId] = useState<string>("");

  const needle = query.trim().toLowerCase();
  const filtered = PERK_COMPENDIUM.filter((perk) => {
    if (!types.includes(perk.type)) return false;
    if (typeFilter !== "all" && perk.type !== typeFilter) return false;
    if (!needle) return true;
    return `${perk.name} ${perk.summary} ${PERK_TYPE_META[perk.type].label}`
      .toLowerCase()
      .includes(needle);
  });
  const selected = filtered.find((perk) => perk.id === selectedId) ?? filtered[0];
  const used = selected ? existingIds.has(selected.id) : false;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={title}
      footer={
        <>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            variant="primary"
            icon="plus"
            disabled={!selected || used}
            onClick={() => selected && onSelect(selected)}
          >
            {used ? "Уже на листе" : "Добавить"}
          </Button>
        </>
      }
    >
      <div className="sheet-perk-picker-filters">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию или описанию…"
          aria-label="Поиск перка"
        />
        <Select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as PerkType | "all")}
          aria-label="Тип перка"
        >
          <option value="all">Все типы</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {PERK_TYPE_META[type].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="sheet-perk-picker-body">
        <div className="sheet-perk-picker-list">
          {filtered.length === 0 && (
            <p className="muted small">Ничего не найдено.</p>
          )}
          {filtered.map((perk) => {
            const isSelected = selected?.id === perk.id;
            const isUsed = existingIds.has(perk.id);
            return (
              <button
                type="button"
                key={perk.id}
                className={`sheet-perk-picker-item ${isSelected ? "is-active" : ""}`.trim()}
                onClick={() => setSelectedId(perk.id)}
              >
                <span className="sheet-perk-picker-name">{perk.name}</span>
                <span className="sheet-perk-picker-meta">
                  {PERK_TYPE_META[perk.type].short}
                  {isUsed ? " · уже на листе" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <aside className="sheet-perk-picker-preview">
          {selected ? (
            <>
              <div className="hstack wrap">
                <Chip tone={PERK_TYPE_META[selected.type].tone}>
                  {PERK_TYPE_META[selected.type].label}
                </Chip>
                {used && <Chip tone="accent">Уже на листе</Chip>}
              </div>
              <h3>{selected.name}</h3>
              <p className="muted small">{selected.summary}</p>
              <RichText text={selected.description} />
            </>
          ) : null}
        </aside>
      </div>
    </Modal>
  );
}
