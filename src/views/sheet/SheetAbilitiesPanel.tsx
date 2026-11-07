import { lazy, Suspense, useMemo, useState } from "react";
import { Icon } from "../../components/Icons";
import { AbilityCard } from "../../components/AbilityCard";
import { AbilityFacts } from "../../components/rules/AbilitySheet";
import { AbilityGroup } from '../../components/rules/AbilityGroup';
import { abilityCardView } from "../../components/rules/abilityCardView";
import { CharacteristicGlyphText } from "../../components/CharacteristicGlyph";
import { DamageChip } from "../../components/DamageChip";
import { AbilityRollPanel } from "../abilities/RollModal";
import { AbilityEditor } from "../abilities/AbilityEditor";
import { TemplatesModal } from "../abilities/TemplatesModal";
import { makeId } from "../../data/templates";
import { Button, Chip, EmptyState, Panel, Select } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import { RichText } from "../../components/RichText";
import { kindLabel } from "../../data/actions";
import {
  evaluateAbilityDamage,
  TIER_ROLL_RANGES,
  type Tier,
} from "../../lib/rules";
import { inferDamageType } from "../../lib/damageType";
import { useApp } from "../../state/AppContext";
import type { Ability } from "../../types";
import {
  blankAbility,
  kindTone,
} from "../abilities/shared";
import {
  BASIC_ABILITY_SOURCE,
  abilityFilterOptions,
  sheetAbilityLayout,
  type AbilitySheetFilter,
} from "../../lib/ability-sheet-groups";
import {
  ancestryAbilitySourcesFrom,
  ancestryAbilitySource,
  subclassAbilitySource,
  subclassAbilitySources,
} from "../../lib/ability-origin";
import {
  ancestryAbilityEntries,
  ancestryFeatureChoicesForSheet,
  withAncestryFeatureSelection,
} from "../../lib/ancestry-features";
import "./SheetAbilitiesPanel.css";

const AbilityPicker = lazy(() =>
  import("../abilities/AbilityPicker").then((module) => ({
    default: module.AbilityPicker,
  })),
);

/** Окно добавления: каталог, базовые действия или своя способность — по одному за раз. */
type AddMode = "catalog" | "templates" | "custom" | null;

function CardSummaryToggle({ label, compact, onToggle }: {
  label: string;
  compact: boolean;
  onToggle: () => void;
}) {
  const action = compact ? "Развернуть карточки" : "Свернуть карточки до заголовков";
  return (
    <button
      type="button"
      className="sheet-ability-summary-toggle"
      aria-label={`${action}: ${label}`}
      aria-expanded={!compact}
      title={action}
      onClick={onToggle}
    >
      <Icon name={compact ? "plus" : "minus"} size={14} />
    </button>
  );
}

/** Выбор способности, которую выдаёт черта происхождения (например, дар Рейдера Времени). */
function AncestryFeatureChoices() {
  const { character, update } = useApp();
  const choices = ancestryFeatureChoicesForSheet(character);
  if (choices.length === 0) return null;
  return (
    <div className="sheet-ability-ancestry-choices">
      {choices.map((choice) => (
        <label className="sheet-ability-ancestry-choice" key={choice.group}>
          <span className="eyebrow">{choice.label}</span>
          <Select
            value={choice.selected}
            aria-label={`${choice.label}: выберите способность`}
            onChange={(event) =>
              update((current) =>
                withAncestryFeatureSelection(
                  current,
                  choice.group,
                  event.target.value,
                ),
              )
            }
          >
            <option value="">Не выбрана</option>
            {choice.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          {choice.warning && (
            <span className="sheet-ability-ancestry-warning">
              {choice.warning}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

/** Компактный справочник способностей внизу листа, сгруппированный по типу действия. */
export function SheetAbilitiesPanel() {
  const { character, update, notify } = useApp();
  const [selected, setSelected] = useState<Ability | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [compactSections, setCompactSections] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AbilitySheetFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{
    ability: Ability;
    isNew: boolean;
  } | null>(null);
  const abilities = character.abilities;
  // Способности происхождения не хранятся в `character.abilities`: их выдаёт
  // выбранная черта или знаковая черта. Для листа это такие же карточки,
  // поэтому они вливаются в общий список до фильтра и поиска.
  const ancestryEntries = useMemo(
    () => ancestryAbilityEntries(character),
    [character],
  );
  const ancestrySources = useMemo(
    () => ancestryAbilitySourcesFrom(ancestryEntries),
    [ancestryEntries],
  );
  const sheetAbilities = useMemo(
    () => [
      ...abilities,
      ...ancestryEntries.map((entry) => entry.ability),
    ],
    [abilities, ancestryEntries],
  );
  // Карта «способность → подкласс» не зависит от поиска и фильтра, поэтому
  // считается один раз на героя.
  const subclassSources = useMemo(
    () => subclassAbilitySources(character),
    [character],
  );
  const ancestryChoices = useMemo(
    () => ancestryFeatureChoicesForSheet(character),
    [character],
  );
  const filterOptions = abilityFilterOptions(
    sheetAbilities,
    subclassSources,
    ancestrySources,
  );
  // Удаление последней способности категории не должно оставлять пустой лист:
  // неизвестный фильтр откатывается к «Все».
  const activeFilter = filterOptions.some((option) => option.key === filter)
    ? filter
    : "all";
  const { groups, topMatches, visible } = sheetAbilityLayout(
    sheetAbilities,
    activeFilter,
    query,
    subclassSources,
    ancestrySources,
  );
  const hasFilter = filterOptions.length > 2;
  const hasQuery = query.trim().length > 0;
  const totalMatches = topMatches.length;
  const totalVisible = visible;

  const renderAbilityCard = (ability: Ability) => (
    <AbilityCard
      key={ability.id}
      ability={ability}
      character={character}
      origin={
        subclassAbilitySource(subclassSources, ability) ??
        ancestryAbilitySource(ancestrySources, ability)
      }
      onOpen={() => openAbility(ability)}
      openOnCardClick
    />
  );

  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const toggleCardSummary = (key: string) =>
    setCompactSections((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const openAbility = (ability: Ability) => setSelected(ability);

  const addAbility = (ability: Ability, message: string) => {
    update((c) => ({ ...c, abilities: [...c.abilities, ability] }));
    notify(message, "success");
  };
  const saveAbility = (ability: Ability) => {
    if (editing?.isNew) {
      addAbility(ability, "Способность добавлена");
    } else {
      update((c) => ({
        ...c,
        abilities: c.abilities.map((item) =>
          item.id === ability.id ? ability : item,
        ),
      }));
      notify("Способность сохранена", "success");
    }
    setEditing(null);
  };
  const duplicateAbility = (ability: Ability) => {
    update((c) => ({
      ...c,
      abilities: [
        ...c.abilities,
        { ...ability, id: makeId(), name: `${ability.name} (копия)` },
      ],
    }));
    notify("Копия создана", "success");
  };
  const deleteAbility = (ability: Ability) => {
    update((c) => ({
      ...c,
      abilities: c.abilities.filter((item) => item.id !== ability.id),
    }));
    notify(`«${ability.name}» удалена`, "info");
  };

  return (
    <>
      <Panel
        title="Способности"
        icon="abilities"
        className="sheet-abilities-panel"
        actions={
          <Button
            size="sm"
            variant="soft"
            icon="plus"
            iconOnly
            aria-label="Добавить способность"
            title="Добавить способность"
            onClick={() => setAddMode("catalog")}
          />
        }
      >
        {sheetAbilities.length === 0 && ancestryChoices.length === 0 ? (
          <EmptyState
            icon="abilities"
            title="Способностей пока нет"
            text="Добавьте способности из каталога или создайте свою."
            action={
              <Button onClick={() => setAddMode("catalog")}>
                Добавить способность
              </Button>
            }
          />
        ) : (
          <div className="sheet-ability-sections">
            <AncestryFeatureChoices />
            {sheetAbilities.length > 0 && (
              <div className="sheet-ability-toolbar">
                <div className="sheet-ability-search">
                  <Icon name="search" size={15} />
                  <input
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder="Поиск по названию, эффекту, триггеру…"
                    aria-label="Поиск по способностям"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {hasQuery && (
                    <>
                      <span className="sheet-ability-search-count mono">
                        {totalMatches} из {totalVisible}
                      </span>
                      <button
                        type="button"
                        className="sheet-ability-search-clear"
                        aria-label="Очистить поиск"
                        title="Очистить поиск"
                        onClick={() => setQuery("")}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </>
                  )}
                </div>
                {hasFilter && (
                  <Select
                    className="sheet-ability-filter"
                    aria-label="Фильтр способностей по виду"
                    value={activeFilter}
                    onChange={(event) => {
                      const option = filterOptions.find((item) => item.key === event.target.value);
                      if (option) setFilter(option.key);
                    }}
                  >
                    {filterOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.key === "all" ? "Все способности" : option.label} ({option.count})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            {hasQuery && totalMatches === 0 && (
              <p className="sheet-ability-search-empty" role="status">
                Ничего не найдено. Попробуйте другое слово — поиск смотрит
                в название, эффект, триггер, тиры и заметки.
              </p>
            )}
            {hasQuery && topMatches.length > 0 && (
              <section
                className={`sheet-ability-section is-search-results${compactSections.has("search") ? " is-compact" : ""}`}
                data-action="search"
                aria-label="Совпадения поиска"
              >
                <header className="sheet-ability-section-head">
                  <span className="sheet-ability-section-toggle is-static">
                    <Icon name="search" size={14} />
                    <h3>Совпадения</h3>
                    <span className="sheet-ability-count mono">
                      {topMatches.length}
                    </span>
                  </span>
                  <span className="sheet-ability-rule" />
                  <CardSummaryToggle label="Совпадения" compact={compactSections.has("search")} onToggle={() => toggleCardSummary("search")} />
                </header>
                <div className="sheet-ability-grid">
                  {topMatches.map(renderAbilityCard)}
                </div>
              </section>
            )}
            {groups.map(group => <AbilityGroup key={group.key}
              action={group.key} label={group.label} count={group.items.length}
              collapsed={collapsed.has(group.key)} onToggle={() => toggleGroup(group.key)}
              compact={compactSections.has(group.key)}
              headerActions={<CardSummaryToggle label={group.label} compact={compactSections.has(group.key)} onToggle={() => toggleCardSummary(group.key)} />}>
              {group.items.map(renderAbilityCard)}
            </AbilityGroup>)}
          </div>
        )}
      </Panel>

      {selected && (
        <AbilityDetailModal
          ability={selected}
          derived={ancestryAbilitySource(ancestrySources, selected) !== undefined}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing({ ability: selected, isNew: false });
            setSelected(null);
          }}
          onDuplicate={() => {
            duplicateAbility(selected);
            setSelected(null);
          }}
          onDelete={() => {
            deleteAbility(selected);
            setSelected(null);
          }}
        />
      )}
      {addMode === "catalog" && (
        <Suspense fallback={null}>
          <AbilityPicker
            existing={abilities}
            character={character}
            onClose={() => setAddMode(null)}
            onAdd={(ability) =>
              addAbility(ability, "Способность добавлена из каталога")
            }
            onOpenTemplates={() => setAddMode("templates")}
            onCreateOwn={() => {
              setAddMode(null);
              setEditing({ ability: blankAbility(), isNew: true });
            }}
          />
        </Suspense>
      )}
      {addMode === "templates" && (
        <TemplatesModal
          existing={abilities}
          onClose={() => setAddMode(null)}
          onAdd={(ability) => addAbility(ability, "Базовое действие добавлено")}
        />
      )}
      {editing && (
        <AbilityEditor
          key={editing.ability.id}
          initial={editing.ability}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={saveAbility}
        />
      )}

    </>
  );
}

function AbilityDetailModal({
  ability,
  derived = false,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  ability: Ability;
  /** Карточка выдана происхождением: её нельзя править или удалить на листе. */
  derived?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { character } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subclassSources = useMemo(
    () => subclassAbilitySources(character),
    [character],
  );
  const ancestrySources = useMemo(
    () => ancestryAbilitySourcesFrom(ancestryAbilityEntries(character)),
    [character],
  );
  const origin =
    subclassAbilitySource(subclassSources, ability) ??
    ancestryAbilitySource(ancestrySources, ability);
  const tiers = ability.tiers
    .map((tier, index) => ({ ...tier, tier: (index + 1) as Tier }))
    .filter((tier) => tier.damage || tier.effect);

  return (
    <CardDetailModal
      open
      onClose={onClose}
      className={`sheet-ability-modal${ability.source === BASIC_ABILITY_SOURCE ? " is-basic" : ""}`}
      sidecar={<AbilityRollPanel key={ability.id} ability={ability} character={character} />}
      headerActions={
        derived ? undefined : (
          <>
            <Button
              variant="ghost"
              icon="copy"
              iconOnly
              aria-label="Создать копию"
              title="Копия"
              onClick={onDuplicate}
            />
            <Button
              variant="ghost"
              icon="edit"
              iconOnly
              aria-label="Изменить"
              title="Изменить"
              onClick={onEdit}
            />
          </>
        )
      }
      title={ability.name || "Без названия"}
      meta={
        <Chip tone={ability.source === BASIC_ABILITY_SOURCE ? "default" : kindTone(ability.kind)}>
          {kindLabel(ability.kind)}
        </Chip>
      }
      footer={
        <>
          {!derived && (
            <Button
              variant="ghost"
              onClick={() =>
                confirmDelete ? onDelete() : setConfirmDelete(true)
              }
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? "Точно удалить?" : "Удалить"}
            </Button>
          )}
          {derived && (
            <span className="sheet-ability-derived-note">
              Выдана происхождением
            </span>
          )}
        </>
      }
    >
      <div className="sheet-ability-detail">
        {(origin || ability.source === BASIC_ABILITY_SOURCE || ability.resourceCost > 0) && (
          <div className="hstack wrap">
            {origin && <Chip tone="accent">{origin.text}</Chip>}
            {ability.source === BASIC_ABILITY_SOURCE && <Chip>Базовая</Chip>}
            {ability.resourceCost > 0 && <Chip tone="yellow">Стоимость: {ability.resourceCost}</Chip>}
          </div>
        )}

        {ability.flavor && (
          <p className="sheet-ability-detail-flavor"><CharacteristicGlyphText text={ability.flavor} /></p>
        )}

        <AbilityFacts view={abilityCardView(ability, character)} />

        {ability.trigger && (
          <div className="sheet-ability-detail-block sheet-ability-detail-trigger">
            <span className="eyebrow">Триггер</span>
            <RichText characteristicGlyphs text={ability.trigger} />
          </div>
        )}

        {tiers.length > 0 && (
          <>
            <div className="sheet-ability-detail-tiers">
              {tiers.map((tier) => {
                const damage = evaluateAbilityDamage(
                  ability,
                  tier.tier,
                  character,
                );
                return (
                  <div
                    className="sheet-ability-detail-tier"
                    data-tier={tier.tier}
                    key={tier.tier}
                  >
                    <div className="sheet-ability-detail-tier-head">
                      <span className="sheet-ability-detail-range" title="Диапазон суммы броска силы" aria-label={TIER_ROLL_RANGES[tier.tier]}>
                        <span className={`sheet-ability-tier-glyph tier-${tier.tier}`} aria-hidden="true" />
                      </span>
                      {tier.damage && (
                        <DamageChip
                          value={damage.display}
                          type={inferDamageType(ability, tier.effect)}
                        />
                      )}
                    </div>
                    {tier.effect && <RichText characteristicGlyphs text={tier.effect} />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {ability.effect && (
          <div className="sheet-ability-detail-block">
            <span className="eyebrow">Эффект</span>
            <RichText characteristicGlyphs text={ability.effect} />
          </div>
        )}

        {ability.notes && (
          <div className="sheet-ability-detail-block sheet-ability-detail-notes">
            <span className="eyebrow">Заметки</span>
            <RichText characteristicGlyphs text={ability.notes} />
          </div>
        )}
      </div>
    </CardDetailModal>
  );
}
