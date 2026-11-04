import { useEffect, useState } from "react";
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
import { canonicalPerkId } from "../../data/originals";
import { loadRuleEntity } from "../../rules/repository";
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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [compact, setCompact] = useState(false);
  const [fullTexts, setFullTexts] = useState<Record<string, string>>({});

  const slots = perkSlots(character);
  const customPerks = character.perks.filter((perk) => perk.source === "custom");
  const slotEntries = slots.map((slot) => ({ slot, selected: selectedPerkForSlot(character, slot) }));
  const emptySlots = slotEntries.filter((entry) => !entry.selected);
  const entries = [
    ...slotEntries.flatMap(({ slot, selected }) => selected ? [{ selected, slot }] : []),
    ...customPerks.map((selected) => ({ selected, slot: undefined })),
  ];
  const catalogIds = [...new Set(entries
    .filter(({ selected }) => perkById(selected.perkId))
    .map(({ selected }) => canonicalPerkId(selected.perkId)))].sort().join("|");

  useEffect(() => {
    let active = true;
    if (!catalogIds) return;
    void Promise.allSettled(catalogIds.split("|").map(async (id) => {
      const entity = await loadRuleEntity(id);
      const text = entity.markdown.replace(/^\s*#{1,6}\s+[^\n]*\n+/, "").trim();
      return [id, text] as const;
    })).then((results) => {
      if (!active) return;
      setFullTexts((current) => {
        const next = { ...current };
        for (const result of results) {
          if (result.status === "fulfilled") next[result.value[0]] = result.value[1];
        }
        return next;
      });
    });
    return () => { active = false; };
  }, [catalogIds]);

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
  const detailFullText = detail ? fullTexts[canonicalPerkId(detail.selected.perkId)] : undefined;
  const detailCustomText = detail?.selected.source === "custom" && detail.selected.description &&
    detail.selected.description !== detailPerk?.description ? detail.selected.description : undefined;
  const detailText = detail
    ? detail.selected.source === "custom"
      ? detailCustomText || detailFullText || detail.selected.description ||
        detail.selected.summary ||
        detailPerk?.description ||
        ""
      : (detailFullText || detailPerk?.description || detail.selected.description || detail.selected.summary || "")
    : "";

  return (
    <>
      <Panel
        title={<button type="button" className="sheet-perks-title-toggle" aria-expanded={!panelCollapsed} title={panelCollapsed ? "Развернуть раздел перков" : "Свернуть раздел перков"} onClick={() => setPanelCollapsed((current) => !current)}>Перки</button>}
        icon="spark"
        className={`sheet-perks-panel${panelCollapsed ? " is-collapsed" : ""}${compact ? " is-compact" : ""}`}
        actions={
          <>
            {!panelCollapsed && entries.length > 0 && (
              <Button size="sm" variant="ghost" icon={compact ? "plus" : "minus"} iconOnly
                aria-label={compact ? "Развернуть карточки перков" : "Свернуть карточки перков до заголовков"}
                aria-expanded={!compact}
                title={compact ? "Развернуть карточки" : "Свернуть карточки до заголовков"}
                onClick={() => setCompact((value) => !value)} />
            )}
            <Button size="sm" variant="ghost" icon="edit" iconOnly aria-label="Изменить перки" title="Изменить перки" onClick={() => goTo("development")} />
            <Button size="sm" variant="soft" icon="plus" iconOnly aria-label="Добавить перк" title="Добавить перк" onClick={() => setPickingFree(true)} />
          </>
        }
      >
        {!panelCollapsed && (
          <div className="perk-card-grid">
            {entries.map(({ selected, slot }) => {
              const perk = perkById(selected.perkId);
              const isCustom = selected.source === "custom";
              const fullText = fullTexts[canonicalPerkId(selected.perkId)];
              const customText = isCustom && selected.description && selected.description !== perk?.description
                ? selected.description : undefined;
              const preview = (customText || fullText || (isCustom
                ? (selected.description || selected.summary || "Описание не заполнено.")
                : (perk?.description || perk?.summary || selected.description || selected.summary || "Описание перка недоступно.")))
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                .replace(/[*_`#]/g, "");
              return (
                <PerkCard
                  key={slot?.key ?? `custom-${selected.perkId}`}
                  name={selected.name}
                  type={selected.type}
                  summary={preview}
                  banded
                  className={isCustom ? "is-custom" : undefined}
                  onOpen={() => setDetail({ selected, slot })}
                  footerAction={isCustom ? (
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(selected)}>Изменить</Button>
                  ) : undefined}
                />
              );
            })}
            {emptySlots.map(({ slot }) => (
              <article className="sheet-perk-card is-empty" key={slot.key}>
                <header className="card-header sheet-perk-head"><span className="eyebrow">{slot.title}</span></header>
                <button type="button" className="sheet-perk-empty" onClick={() => setPickingSlot(slot)} title="Выбрать перк из списка">
                  <span className="sheet-perk-empty-title">Не выбран</span>
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
  onCreateOwn,
}: {
  title: string;
  allowedTypes?: PerkType[];
  existingIds: Set<string>;
  onClose: () => void;
  onSelect: (perk: Perk) => void;
  onCreateOwn?: () => void;
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
          {onCreateOwn && (
            <Button variant="ghost" icon="plus" onClick={onCreateOwn}>Создать свой</Button>
          )}
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
