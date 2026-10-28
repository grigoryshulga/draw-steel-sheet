import { lazy, Suspense, useMemo, useState } from "react";
import { Icon } from "../../components/Icons";
import { AbilityCard } from "../../components/AbilityCard";
import { DamageChip } from "../../components/DamageChip";
import { TierBadge } from "../../components/TierBadge";
import { RollModal } from "../abilities/RollModal";
import { AbilityEditor } from "../abilities/AbilityEditor";
import { TemplatesModal } from "../abilities/TemplatesModal";
import { makeId } from "../../data/templates";
import { Button, Chip, EmptyState, Modal, Panel } from "../../components/ui";
import { RichText } from "../../components/RichText";
import { actionLabel, kindLabel } from "../../data/actions";
import { abilityDistance } from "../../lib/character-calculations";
import {
  characteristicShort,
  evaluateAbilityDamage,
  TIER_ROLL_RANGES,
  type Tier,
} from "../../lib/rules";
import { inferDamageType } from "../../lib/damageType";
import { useApp } from "../../state/AppContext";
import type { Ability } from "../../types";
import {
  TierRequirementSummary,
  blankAbility,
  kindTone,
  rollSummary,
} from "../abilities/shared";
import {
  abilityTierRequirements,
  preferredCharacteristic,
  tierRequirementText,
} from "../../lib/abilities";
import {
  BASIC_ABILITY_SOURCE,
  abilityFilterOptions,
  sheetAbilityLayout,
  type AbilitySheetFilter,
} from "../../lib/ability-sheet-groups";
import {
  subclassAbilitySource,
  subclassAbilitySources,
} from "../../lib/ability-origin";
import {
  matchesFeatureQuery,
  passiveClassFeatures,
} from "../../lib/class-feature-view";
import { PassiveFeatureCard } from "./PassiveFeatureCard";
import "./SheetAbilitiesPanel.css";

const AbilityPicker = lazy(() =>
  import("../abilities/AbilityPicker").then((module) => ({
    default: module.AbilityPicker,
  })),
);

/** Окно добавления: каталог, базовые действия или своя способность — по одному за раз. */
type AddMode = "catalog" | "templates" | "custom" | null;

/** Компактный справочник способностей внизу листа, сгруппированный по типу действия. */
export function SheetAbilitiesPanel() {
  const { character, update, notify } = useApp();
  const [selected, setSelected] = useState<Ability | null>(null);
  const [using, setUsing] = useState<Ability | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AbilitySheetFilter>("all");
  const [query, setQuery] = useState("");
  const [passivesCollapsed, setPassivesCollapsed] = useState(false);
  const [editing, setEditing] = useState<{
    ability: Ability;
    isNew: boolean;
  } | null>(null);
  const abilities = character.abilities;
  // Карта «способность → подкласс» не зависит от поиска и фильтра, поэтому
  // считается один раз на героя.
  const subclassSources = useMemo(
    () => subclassAbilitySources(character),
    [character],
  );
  const filterOptions = abilityFilterOptions(abilities, subclassSources);
  const allPassives = useMemo(
    () => passiveClassFeatures(character),
    [character],
  );
  const passives = useMemo(
    () => allPassives.filter((item) => matchesFeatureQuery(item, query)),
    [allPassives, query],
  );
  // Удаление последней способности категории не должно оставлять пустой лист:
  // неизвестный фильтр откатывается к «Все».
  const activeFilter = filterOptions.some((option) => option.key === filter)
    ? filter
    : "all";
  const { groups, topMatches, visible } = sheetAbilityLayout(
    abilities,
    activeFilter,
    query,
    subclassSources,
  );
  const hasFilter = filterOptions.length > 2;
  const hasQuery = query.trim().length > 0;
  // Пассивные эффекты участвуют в поиске и счётчике, но не в фильтре по виду.
  const passiveMatches = activeFilter === "all" ? passives.length : 0;
  const totalMatches = topMatches.length + passiveMatches;
  const totalVisible =
    visible + (activeFilter === "all" ? allPassives.length : 0);

  const renderAbilityCard = (ability: Ability) => (
    <AbilityCard
      key={ability.id}
      ability={ability}
      character={character}
      origin={subclassAbilitySource(subclassSources, ability)}
      onOpen={() => openAbility(ability)}
      footerAction={
        <Button
          size="sm"
          variant="soft"
          icon="abilities"
          aria-label={`Использовать: ${ability.name}`}
          onClick={() => setUsing(ability)}
        >
          Использовать
        </Button>
      }
    />
  );

  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
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
            onClick={() => setAddMode("catalog")}
          >
            Добавить способность
          </Button>
        }
      >
        {abilities.length === 0 ? (
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
            {hasQuery && totalMatches === 0 && (
              <p className="sheet-ability-search-empty" role="status">
                Ничего не найдено. Попробуйте другое слово — поиск смотрит
                в название, эффект, триггер, тиры, заметки и пассивные эффекты.
              </p>
            )}
            {hasFilter && (
              <div
                className="sheet-ability-filters"
                role="group"
                aria-label="Фильтр способностей по виду"
              >
                {filterOptions.map((option) => (
                  <Chip
                    key={option.key}
                    active={activeFilter === option.key}
                    onClick={() => setFilter(option.key)}
                    title={
                      option.key === "all"
                        ? "Показать все способности"
                        : `Показать: ${option.label.toLowerCase()}`
                    }
                  >
                    {option.label}
                    <span className="sheet-ability-filter-count mono">
                      {option.count}
                    </span>
                  </Chip>
                ))}
              </div>
            )}
            {hasQuery && topMatches.length > 0 && (
              <section
                className="sheet-ability-section is-search-results"
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
                </header>
                <div className="sheet-ability-grid">
                  {topMatches.map(renderAbilityCard)}
                </div>
              </section>
            )}
            {activeFilter === "all" && passives.length > 0 && (
              <section
                className={`sheet-ability-section${passivesCollapsed ? " is-collapsed" : ""}`}
                data-action="passive"
                aria-label="Пассивные эффекты"
              >
                <header className="sheet-ability-section-head">
                  <button
                    type="button"
                    className="sheet-ability-section-toggle"
                    aria-expanded={!passivesCollapsed}
                    onClick={() => setPassivesCollapsed((value) => !value)}
                  >
                    <Icon name="chevron-down" size={14} />
                    <h3>Пассивные эффекты</h3>
                    <span className="sheet-ability-count mono">
                      {passives.length}
                    </span>
                  </button>
                  <span className="sheet-ability-rule" />
                </header>
                {!passivesCollapsed && (
                  <div className="sheet-ability-grid">
                    {passives.map((item) => (
                      <PassiveFeatureCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.key);
              return (
                <section
                  className={`sheet-ability-section${isCollapsed ? " is-collapsed" : ""}`}
                  key={group.key}
                  data-action={group.key}
                >
                  <header className="sheet-ability-section-head">
                    <button
                      type="button"
                      className="sheet-ability-section-toggle"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <Icon name="chevron-down" size={14} />
                      <h3>{group.label}</h3>
                      <span className="sheet-ability-count mono">
                        {group.items.length}
                      </span>
                    </button>
                    <span className="sheet-ability-rule" />
                  </header>

                  {!isCollapsed && (
                    <div className="sheet-ability-grid">
                      {group.items.map(renderAbilityCard)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      {selected && (
        <AbilityDetailModal
          ability={selected}
          onClose={() => setSelected(null)}
          onUse={() => {
            setUsing(selected);
            setSelected(null);
          }}
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
      {using && (
        <RollModal
          key={using.id}
          ability={using}
          character={character}
          onClose={() => setUsing(null)}
        />
      )}
    </>
  );
}

function AbilityDetailModal({
  ability,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
}: {
  ability: Ability;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUse: () => void;
}) {
  const { character } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subclassSources = useMemo(
    () => subclassAbilitySources(character),
    [character],
  );
  const origin = subclassAbilitySource(subclassSources, ability);
  const requirements = abilityTierRequirements(ability, character);
  const tiers = ability.tiers
    .map((tier, index) => ({ ...tier, tier: (index + 1) as Tier }))
    .filter((tier) => tier.damage || tier.effect);

  return (
    <Modal
      open
      onClose={onClose}
      className="sheet-ability-modal"
      headerActions={
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
      }
      title={
        <span className="sheet-ability-detail-title">
          {ability.name || "Без названия"}
        </span>
      }
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() =>
              confirmDelete ? onDelete() : setConfirmDelete(true)
            }
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? "Точно удалить?" : "Удалить"}
          </Button>
          <span className="grow" />
          <Button variant="primary" onClick={onUse}>
            Использовать
          </Button>
        </>
      }
    >
      <div className="sheet-ability-detail">
        <div className="hstack wrap">
          <Chip tone={kindTone(ability.kind)}>{kindLabel(ability.kind)}</Chip>
          {origin && <Chip tone="accent">{origin.text}</Chip>}
          {ability.source === BASIC_ABILITY_SOURCE && <Chip>Базовая</Chip>}
          {ability.resourceCost > 0 && (
            <Chip tone="yellow">Стоимость: {ability.resourceCost}</Chip>
          )}
          {ability.keywords.map((keyword) => (
            <Chip key={keyword}>{keyword}</Chip>
          ))}
        </div>

        {ability.flavor && (
          <p className="sheet-ability-detail-flavor">{ability.flavor}</p>
        )}

        <div className="sheet-ability-detail-facts">
          <div>
            <span className="eyebrow">Дистанция</span>
            <span>{abilityDistance(ability, character) || "—"}</span>
          </div>
          <div>
            <span className="eyebrow">Цель</span>
            <span>{ability.target || "—"}</span>
          </div>
          <div>
            <span className="eyebrow">Бросок силы</span>
            <span className="mono">{rollSummary(ability)}</span>
          </div>
          {preferredCharacteristic(ability) && (
            <div>
              <span className="eyebrow">Предпочтительная</span>
              <span className="mono">
                {characteristicShort(preferredCharacteristic(ability)!)}
              </span>
            </div>
          )}
          <div>
            <span className="eyebrow">Стоимость</span>
            <span>
              {ability.resourceCost > 0
                ? `${ability.resourceCost} ресурса`
                : "—"}
            </span>
          </div>
          <div>
            <span className="eyebrow">Тип действия</span>
            <span>{actionLabel(ability.actionType)}</span>
          </div>
        </div>

        {ability.trigger && (
          <div className="sheet-ability-detail-block sheet-ability-detail-trigger">
            <span className="eyebrow">Триггер</span>
            <RichText text={ability.trigger} />
          </div>
        )}

        {tiers.length > 0 && (
          <>
            <TierRequirementSummary ability={ability} character={character} />
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
                      <TierBadge tier={tier.tier} size="md" />
                      <span className="sheet-ability-detail-range mono">
                        {requirements
                          ? tierRequirementText(requirements, tier.tier)
                          : TIER_ROLL_RANGES[tier.tier]}
                      </span>
                      {tier.damage && (
                        <DamageChip
                          value={damage.display}
                          type={inferDamageType(ability, tier.effect)}
                        />
                      )}
                    </div>
                    {tier.effect && <RichText text={tier.effect} />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {ability.effect && (
          <div className="sheet-ability-detail-block">
            <span className="eyebrow">Эффект</span>
            <RichText text={ability.effect} />
          </div>
        )}

        {ability.notes && (
          <div className="sheet-ability-detail-block sheet-ability-detail-notes">
            <span className="eyebrow">Заметки</span>
            <RichText text={ability.notes} />
          </div>
        )}
      </div>
    </Modal>
  );
}
