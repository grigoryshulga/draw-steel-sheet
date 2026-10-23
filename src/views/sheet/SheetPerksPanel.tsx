import { useState } from "react";
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

  return (
    <>
      <Panel
        title="Перки"
        icon="spark"
        className="sheet-perks-panel"
        actions={
          <Button size="sm" variant="ghost" icon="edit" onClick={() => goTo("hero")}>
            Изменить
          </Button>
        }
      >
        <div className="sheet-perk-grid">
          {slots.map((slot) => {
            const selected = selectedPerkForSlot(character, slot);
            const perk = selected ? perkById(selected.perkId) : undefined;
            const type = selected ? PERK_TYPE_META[selected.type] : null;

            return (
              <article
                className={`sheet-perk-card ${selected ? "is-filled" : "is-empty"}`.trim()}
                key={slot.key}
              >
                <header className="sheet-perk-head">
                  <span className="eyebrow">{slot.title}</span>
                  {type && <Chip tone={type.tone}>{type.short}</Chip>}
                </header>

                {selected ? (
                  <>
                    <h3>{selected.name}</h3>
                    <p className="sheet-perk-summary">
                      {perk?.summary ?? selected.summary ?? "Описание перка недоступно."}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="book"
                      className="sheet-perk-more"
                      onClick={() => setDetail({ selected, slot })}
                    >
                      Подробнее
                    </Button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="sheet-perk-empty"
                    onClick={() => setPickingSlot(slot)}
                    title="Выбрать перк из списка"
                  >
                    <span className="sheet-perk-empty-title">Не выбран</span>
                  </button>
                )}
              </article>
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
          <div className="sheet-perk-grid sheet-perk-custom-grid">
            {customPerks.map((perk) => {
              const type = PERK_TYPE_META[perk.type];
              const fromCatalog = !!perkById(perk.perkId);
              return (
                <article className="sheet-perk-card is-filled is-custom" key={perk.perkId}>
                  <header className="sheet-perk-head">
                    <span className="eyebrow">{fromCatalog ? "Из списка" : "Свой перк"}</span>
                    <Chip tone={type.tone}>{type.short}</Chip>
                  </header>
                  <h3>{perk.name}</h3>
                  <p className="sheet-perk-summary">
                    {perk.summary || perk.description || "Описание не заполнено."}
                  </p>
                  <div className="sheet-perk-custom-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="book"
                      onClick={() => setDetail({ selected: perk })}
                    >
                      Подробнее
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="edit"
                      onClick={() => setEditing(perk)}
                    >
                      Изменить
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Перк: ${detail.selected.name}` : "Перк"}
        footer={
          detail && (
            <>
              {detail.selected.source === "custom" && (
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
              )}
              <span className="grow" />
              {detail.selected.source !== "custom" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDetail(null);
                    goTo("hero");
                  }}
                >
                  Открыть на вкладке «Герой»
                </Button>
              )}
              <Button variant="primary" onClick={() => setDetail(null)}>
                Закрыть
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="sheet-perk-detail">
            <div className="hstack wrap">
              <Chip tone={PERK_TYPE_META[detail.selected.type].tone}>
                {PERK_TYPE_META[detail.selected.type].label}
              </Chip>
            </div>
            {(() => {
              const perk = perkById(detail.selected.perkId);
              const text =
                detail.selected.source === "custom"
                  ? detail.selected.description ||
                    detail.selected.summary ||
                    perk?.description ||
                    ""
                  : (perk?.description ?? "");
              return text ? (
                <RichText text={text} />
              ) : (
                <p className="muted">Полное описание этого перка недоступно.</p>
              );
            })()}
          </div>
        )}
      </Modal>

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
