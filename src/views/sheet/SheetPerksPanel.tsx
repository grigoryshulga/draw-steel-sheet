import { useLocale } from "../../i18n/locale";
import { useState } from "react";
import { PerkCard } from "../../components/PerkCard";
import { PerkDetailModal, PerkRulesText } from "../../components/PerkDetailModal";
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
  const { t } = useLocale();
  const { character, update, goTo, notify, readOnly } = useApp();
  const [detail, setDetail] = useState<{ selected: SelectedPerk; slot?: PerkSlot } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SelectedPerk | null>(null);
  const [pickingSlot, setPickingSlot] = useState<PerkSlot | null>(null);
  const [pickingFree, setPickingFree] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [compact, setCompact] = useState(false);

  const slots = perkSlots(character);
  const customPerks = character.perks.filter((perk) => perk.source === "custom");
  const slotEntries = slots.map((slot) => ({ slot, selected: selectedPerkForSlot(character, slot) }));
  const emptySlots = slotEntries.filter((entry) => !entry.selected);
  const entries = [
    ...slotEntries.flatMap(({ slot, selected }) => selected ? [{ selected, slot }] : []),
    ...customPerks.map((selected) => ({ selected, slot: undefined })),
  ];

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
    notify(initial ? t("Свой перк обновлён", "Custom perk updated") : t("Свой перк добавлен", "Custom perk added"), "success");
  };

  const removeCustom = (perk: SelectedPerk) => {
    update((current) => ({
      ...current,
      perks: current.perks.filter(
        (item) => !(item.source === "custom" && item.perkId === perk.perkId),
      ),
    }));
    setDetail(null);
    notify(t("Свой перк удалён", "Custom perk removed"), "info");
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
    notify(t(`Перк «${perk.name}» добавлен`, `Perk “${perk.name}” added`), "success");
  };

  const detailPerk = detail ? perkById(detail.selected.perkId) : undefined;
  const detailCustomText = detail?.selected.source === "custom" && detail.selected.description &&
    detail.selected.description !== detailPerk?.description ? detail.selected.description : undefined;

  if (readOnly && entries.length === 0) return null;

  return (
    <>
      <Panel
        title={<button type="button" className="sheet-perks-title-toggle" aria-expanded={!panelCollapsed} title={panelCollapsed ? t("Развернуть раздел перков", "Expand perks") : t("Свернуть раздел перков", "Collapse perks")} onClick={() => setPanelCollapsed((current) => !current)}>{t("Перки", "Perks")}</button>}
        icon="spark"
        className={`sheet-perks-panel${panelCollapsed ? " is-collapsed" : ""}${compact ? " is-compact" : ""}`}
        actions={
          <>
            {!panelCollapsed && entries.length > 0 && (
              <Button size="sm" variant="ghost" icon={compact ? "plus" : "minus"} iconOnly
                aria-label={compact ? t("Развернуть карточки перков", "Expand perk cards") : t("Свернуть карточки перков до заголовков", "Collapse perk cards to titles")}
                aria-expanded={!compact}
                title={compact ? t("Развернуть карточки", "Expand cards") : t("Свернуть карточки до заголовков", "Collapse cards to titles")}
                onClick={() => setCompact((value) => !value)} />
            )}
            {!readOnly && <>
              <Button size="sm" variant="ghost" icon="edit" iconOnly aria-label={t("Изменить перки", "Edit perks")} title={t("Изменить перки", "Edit perks")} onClick={() => goTo("development")} />
              <Button size="sm" variant="soft" icon="plus" iconOnly aria-label={t("Добавить перк", "Add perk")} title={t("Добавить перк", "Add perk")} onClick={() => setPickingFree(true)} />
            </>}
          </>
        }
      >
        {!panelCollapsed && (
          <div className="perk-card-grid">
            {entries.map(({ selected, slot }) => {
              const perk = perkById(selected.perkId);
              const isCustom = selected.source === "custom";
              const preview = isCustom
                ? selected.summary || perk?.summary || t("Откройте полное описание перка.", "Open the full perk description.")
                : perk?.summary || selected.summary || t("Откройте полное описание перка.", "Open the full perk description.");
              return (
                <PerkCard
                  key={slot?.key ?? `custom-${selected.perkId}`}
                  name={selected.name}
                  type={selected.type}
                  summary={preview}
                  ruleId={perk?.id}
                  originalName={perk?.originalName}
                  originalDescription={(!isCustom || !selected.description || selected.description === perk?.description) ? perk?.originalDescription : undefined}
                  banded
                  className={isCustom ? "is-custom" : undefined}
                  onOpen={() => setDetail({ selected, slot })}
                  footerAction={isCustom && !readOnly ? (
                    <Button size="sm" variant="ghost" icon="edit" iconOnly aria-label={t(`Изменить перк: ${selected.name}`, `Edit perk: ${selected.name}`)} title={t("Изменить перк", "Edit perk")} onClick={() => setEditing(selected)} />
                  ) : undefined}
                />
              );
            })}
            {!readOnly && emptySlots.map(({ slot }) => (
              <article className="sheet-perk-card is-empty" key={slot.key}>
                <header className="card-header sheet-perk-head"><span className="eyebrow">{slot.source === "career" ? t(slot.title, "Career") : t(slot.title, `Class · level ${slot.level}`)}</span></header>
                <button type="button" className="sheet-perk-empty" onClick={() => setPickingSlot(slot)} title={t("Выбрать перк из списка", "Choose a perk")}>
                  <span className="sheet-perk-empty-title">{t("Не выбран", "Not selected")}</span>
                </button>
              </article>
            ))}
          </div>
        )}

      </Panel>

      <PerkDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.selected.name ?? ""}
        perkId={detailCustomText ? undefined : detail?.selected.perkId}
        type={detail?.selected.type}
        eyebrow={detail?.slot ? (detail.slot.source === "career" ? t(detail.slot.title, "Career") : t(detail.slot.title, `Class · level ${detail.slot.level}`)) : undefined}
        summary={
          detail
            ? (detail.selected.summary ??
              detailPerk?.summary ??
              t("Описание перка недоступно.", "Perk description unavailable."))
            : undefined
        }
        description={detail?.selected.description}
        action={
          !readOnly && detail?.selected.source === "custom" ? (
            <>
              <Button iconOnly
                variant="ghost"
                icon="edit"
                onClick={() => {
                  setEditing(detail.selected);
                  setDetail(null);
                }}
              >
                {t("Изменить", "Edit")}
              </Button>
              <Button iconOnly
                variant="danger"
                icon="trash"
                onClick={() => removeCustom(detail.selected)}
              >
                {t("Удалить", "Delete")}
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
          title={pickingSlot ? `${t("Перк", "Perk")}: ${pickingSlot.source === "career" ? t(pickingSlot.title, "Career") : t(pickingSlot.title, `Class · level ${pickingSlot.level}`)}` : t("Доступные перки", "Available perks")}
          allowedTypes={pickingSlot?.allowedTypes}
          existingIds={new Set(character.perks.map((perk) => perk.perkId))}
          onClose={() => {
            setPickingSlot(null);
            setPickingFree(false);
          }}
          onCreateOwn={!pickingSlot ? () => {
            setPickingFree(false);
            setCreating(true);
          } : undefined}
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
  const { t, locale } = useLocale();
  const valid = draft.name.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? t("Изменить свой перк", "Edit custom perk") : t("Новый свой перк", "New custom perk")}
      footer={
        <>
          <span className="grow" />
          <Button iconOnly icon="close" variant="ghost" onClick={onClose}>
            {t("Отмена", "Cancel")}
          </Button>
          <Button iconOnly
            variant="primary"
            icon="check"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            {t("Сохранить", "Save")}
          </Button>
        </>
      }
    >
      <div className="sheet-perk-form">
        <Field label={t("Название", "Name")}>
          <TextInput
            value={draft.name}
            autoFocus
            placeholder={t("Например: Хитрый план", "For example: Cunning Plan")}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Field>
        <Field label={t("Тип", "Type")}>
          <Select
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as PerkType })
            }
          >
            {ALL_PERK_TYPES.map((type) => (
              <option key={type} value={type}>
                {locale === "en" ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[type] : PERK_TYPE_META[type].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Краткое описание", "Summary")}>
          <TextArea
            rows={2}
            value={draft.summary}
            placeholder={t("Что даёт перк в двух словах", "Briefly describe the benefit")}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          />
        </Field>
        <Field label={t("Полное описание", "Full description")}>
          <TextArea
            rows={5}
            value={draft.description}
            placeholder={t("Полный текст перка", "Full perk text")}
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
  onCreateOwn,
}: {
  title: string;
  allowedTypes?: PerkType[];
  existingIds: Set<string>;
  onClose: () => void;
  onSelect: (perk: Perk) => void;
  onCreateOwn?: () => void;
}) {
  const { t, locale } = useLocale();
  const types = allowedTypes ?? ALL_PERK_TYPES;
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PerkType | "all">("all");
  const [selectedId, setSelectedId] = useState<string>("");

  const needle = query.trim().toLowerCase();
  const filtered = PERK_COMPENDIUM.filter((perk) => {
    if (!types.includes(perk.type)) return false;
    if (typeFilter !== "all" && perk.type !== typeFilter) return false;
    if (!needle) return true;
    return `${perk.name} ${perk.originalName || ""} ${perk.summary} ${PERK_TYPE_META[perk.type].label}`
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
          {onCreateOwn && (
            <Button variant="ghost" icon="plus" onClick={onCreateOwn}>{t("Создать свой", "Create custom")}</Button>
          )}
          <span className="grow" />
          <Button
            variant="primary"
            icon="plus"
            disabled={!selected || used}
            onClick={() => selected && onSelect(selected)}
          >
            {used ? t("Уже на листе", "Already on sheet") : t("Добавить", "Add")}
          </Button>
        </>
      }
    >
      <div className="sheet-perk-picker-filters">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Поиск по названию или описанию…", "Search name or description…")}
          aria-label={t("Поиск перка", "Search perks")}
        />
        <Select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as PerkType | "all")}
          aria-label={t("Тип перка", "Perk type")}
        >
          <option value="all">{t("Все типы", "All types")}</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {locale === "en" ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[type] : PERK_TYPE_META[type].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="sheet-perk-picker-body">
        <div className="sheet-perk-picker-list">
          {filtered.length === 0 && (
            <p className="muted small">{t("Ничего не найдено.", "Nothing found.")}</p>
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
                <span className="sheet-perk-picker-name">{locale === "en" && perk.originalDescription ? perk.originalName || perk.name : perk.name}</span>
                <span className="sheet-perk-picker-meta">
                  {locale === "en" ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[perk.type] : PERK_TYPE_META[perk.type].short}
                  {isUsed ? t(" · уже на листе", " · already on sheet") : ""}
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
                  {locale === "en" ? ({ crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" } as const)[selected.type] : PERK_TYPE_META[selected.type].label}
                </Chip>
                {used && <Chip tone="accent">{t("Уже на листе", "Already on sheet")}</Chip>}
              </div>
              <h3>{locale === "en" && selected.originalDescription ? selected.originalName || selected.name : selected.name}</h3>
              <PerkRulesText perkId={selected.id} fallback={selected.summary} />
            </>
          ) : null}
        </aside>
      </div>
    </Modal>
  );
}
