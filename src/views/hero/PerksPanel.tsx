import { useLocale } from "../../i18n/locale";
import { useState } from "react";
import { Icon } from "../../components/Icons";
import { Button, Chip, EmptyState, Field, Modal, Panel, Select, TextInput } from "../../components/ui";
import { PerkCard } from "../../components/PerkCard";
import { PerkDetailModal, PerkRulesText } from "../../components/PerkDetailModal";
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

function typeLabel(type: PerkType, english = false): string {
  const names: Record<PerkType, string> = { crafting: "Crafting", exploration: "Exploration", interpersonal: "Interpersonal", intrigue: "Intrigue", lore: "Lore", supernatural: "Supernatural" };
  return english ? names[type] : PERK_TYPE_META[type].label;
}
function slotTitle(slot: PerkSlot, english: boolean): string {
  return english ? slot.source === "career" ? "Career" : `Class · level ${slot.level}` : slot.title;
}

export function PerksPanel() {
  const { locale, t } = useLocale();
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
    notify(t(`Перк «${perk.name}» выбран`, `Selected perk “${perk.originalName || perk.name}”`), "success");
  };

  const detailPerk = detail
    ? perkById(detail.selected.perkId)
    : undefined;

  return (
    <Panel
      title={t("Перки", "Perks")}
      icon="spark"
      actions={
        <Chip tone={selectedCount === slots.length ? "accent" : "default"}>
          {selectedCount} / {slots.length}
        </Chip>
      }
      className="perks-panel"
    >
      <div className="perk-card-grid">
        {slots.map((slot) => {
          const selected = selectedPerkForSlot(character, slot);
          const perk = selected ? perkById(selected.perkId) : undefined;

          if (!selected) {
            return (
              <article
                className="sheet-perk-card is-empty"
                key={slot.key}
                role="button"
                tabIndex={0}
                onClick={() => setPickerSlot(slot)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setPickerSlot(slot);
                  }
                }}
              >
                <header className="card-header sheet-perk-head">
                  <span className="eyebrow">{slotTitle(slot, locale === "en")}</span>
                </header>
                <button
                  type="button"
                  className="sheet-perk-empty"
                  onClick={() => setPickerSlot(slot)}
                >
                  <Icon name="plus" size={16} aria-hidden="true" />
                  <span className="sheet-perk-empty-title">{t("Выбрать перк", "Choose perk")}</span>
                </button>
              </article>
            );
          }

          return (
            <PerkCard
              key={slot.key}
              eyebrow={slotTitle(slot, locale === "en")}
              name={locale === "en" && perk?.name === selected.name && perk.originalName ? perk.originalName : selected.name}
              type={selected.type}
              summary={
                (locale === "en" && perk?.originalDescription && (!selected.summary || selected.summary === perk.summary) ? perk.originalDescription : selected.summary) ?? perk?.summary ??
                selected.summary ??
                t("Описание перка недоступно.", "Perk description unavailable.")
              }
              onOpen={() => setDetail({ slot, selected })}
            />
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

      <PerkDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        name={detail?.selected.name ?? ""}
        perkId={detail?.selected.perkId}
        type={detail?.selected.type}
        eyebrow={detail ? slotTitle(detail.slot, locale === "en") : undefined}
        summary={detail?.selected.summary ?? detailPerk?.summary}
        description={detail?.selected.description}
        action={
          detail ? (
            <Button iconOnly
              icon="edit"
              onClick={() => {
                setPickerSlot(detail.slot);
                setDetail(null);
              }}
            >
              {t("Заменить", "Replace")}
            </Button>
          ) : undefined
        }
      />

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
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PerkType | "all">("all");
  const [previewId, setPreviewId] = useState("");

  const eligible = PERK_COMPENDIUM.filter((perk) => slot.allowedTypes.includes(perk.type));
  const needle = query.trim().toLowerCase();
  const filtered = eligible.filter((perk) => {
    if (typeFilter !== "all" && perk.type !== typeFilter) return false;
    if (!needle) return true;
    return `${perk.name} ${perk.originalName ?? ""} ${perk.summary} ${typeLabel(perk.type, locale === "en")}`.toLowerCase().includes(needle);
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
          {slotTitle(slot, locale === "en")}
        </span>
      }
      footer={
        <>
          <span className="grow" />
          <Button iconOnly icon="close" variant="ghost" onClick={onClose}>
            {t("Отмена", "Cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!preview || previewUsed}
            onClick={() => preview && onChoose(preview)}
          >
            {previewUsed ? t("Уже выбран", "Already selected") : t("Выбрать перк", "Choose perk")}
          </Button>
        </>
      }
    >
      <div className="perk-picker-filters">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Поиск перка…", "Search perks…")}
          aria-label={t("Поиск перка", "Search perks")}
        />
        {slot.allowedTypes.length > 1 && (
          <Field label={t("Тип", "Type")}>
            <Select
              value={typeFilter}
              aria-label={t("Тип перка", "Perk type")}
              onChange={(event) => setTypeFilter(event.target.value as PerkType | "all")}
            >
              <option value="all">{t("Все доступные", "All available")}</option>
              {slot.allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type, locale === "en")}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title={t("Ничего не найдено", "Nothing found")} />
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
                    <span className="perk-option-name">{locale === "en" && perk.originalName ? perk.originalName : perk.name}</span>
                    {used && <span className="perk-used">{t("в листе", "On sheet")}</span>}
                  </span>
                  <span className="perk-option-meta">{typeLabel(perk.type, locale === "en")}</span>
                  <span className="perk-option-summary">{locale === "en" && perk.originalDescription ? perk.originalDescription : perk.summary}</span>
                </button>
              );
            })}
          </div>

          <aside className="perk-picker-preview">
            {preview ? (
              <>
                <h3>{locale === "en" && preview.originalName ? preview.originalName : preview.name}</h3>
                <div className="hstack wrap">
                  <Chip tone={PERK_TYPE_META[preview.type].tone}>
                    {typeLabel(preview.type, locale === "en")}
                  </Chip>
                  {previewUsed && <Chip tone="yellow">{t("Уже выбран в другом слоте", "Already selected in another slot")}</Chip>}
                </div>
                <PerkRulesText perkId={preview.id} fallback={preview.summary} />
              </>
            ) : (
              <EmptyState icon="book" title={t("Выберите перк", "Choose a perk")} />
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
