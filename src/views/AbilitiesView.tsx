import { lazy, Suspense, useMemo, useState } from "react";
import type { Ability, AbilityKind, ActionType } from "../types";
import { ABILITY_KINDS, ACTION_TYPES } from "../data/actions";
import { makeId } from "../data/templates";
import { useApp } from "../state/AppContext";
import { Button, Chip, EmptyState, Select, TextInput } from "../components/ui";
import { Icon } from "../components/Icons";
import { AbilityCard } from "./abilities/AbilityCard";
import { AbilityEditor } from "./abilities/AbilityEditor";
import { RollModal } from "./abilities/RollModal";
import { TemplatesModal } from "./abilities/TemplatesModal";
import { blankAbility, matchesQuery } from "./abilities/shared";
import "./AbilitiesView.css";

const AbilityPicker = lazy(() =>
  import("./abilities/AbilityPicker").then((module) => ({
    default: module.AbilityPicker,
  })),
);

/** При большом списке карточки по умолчанию свёрнуты. */
const COMPACT_THRESHOLD = 6;

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function AbilitiesView() {
  const { character, update, notify } = useApp();
  const abilities = character.abilities;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ActionType[]>([]);
  const [kindFilter, setKindFilter] = useState<AbilityKind | "all">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<ActionType[]>([]);
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [editorTarget, setEditorTarget] = useState<{ ability: Ability; isNew: boolean } | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [rolling, setRolling] = useState<Ability | null>(null);

  const filtersActive = typeFilter.length > 0 || kindFilter !== "all" || query.trim() !== "";

  const filtered = useMemo(
    () =>
      abilities.filter(
        (ability) =>
          matchesQuery(ability, query) &&
          (typeFilter.length === 0 || typeFilter.includes(ability.actionType)) &&
          (kindFilter === "all" || kindFilter === ability.kind),
      ),
    [abilities, query, typeFilter, kindFilter],
  );

  const groups = useMemo(
    () =>
      ACTION_TYPES.map((type) => ({
        key: type.key,
        label: type.label,
        hint: type.hint,
        items: filtered.filter((ability) => ability.actionType === type.key),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );


  const defaultExpanded = abilities.length <= COMPACT_THRESHOLD;

  const resetFilters = () => {
    setQuery("");
    setTypeFilter([]);
    setKindFilter("all");
  };

  const handleSave = (ability: Ability) => {
    if (editorTarget?.isNew) {
      update((c) => ({ ...c, abilities: [...c.abilities, ability] }));
      notify("Способность добавлена", "success");
    } else {
      update((c) => ({
        ...c,
        abilities: c.abilities.map((item) => (item.id === ability.id ? ability : item)),
      }));
      notify("Способность сохранена", "success");
    }
    setEditorTarget(null);
  };

  const addFromCatalog = (ability: Ability, message: string) => {
    update((c) => ({ ...c, abilities: [...c.abilities, ability] }));
    notify(message, "success");
  };

  const duplicateAbility = (ability: Ability) => {
    update((c) => ({
      ...c,
      abilities: [...c.abilities, { ...ability, id: makeId(), name: `${ability.name} (копия)` }],
    }));
    notify("Копия создана", "success");
  };

  const deleteAbility = (ability: Ability) => {
    update((c) => ({ ...c, abilities: c.abilities.filter((item) => item.id !== ability.id) }));
    notify(`«${ability.name}» удалена`, "info");
  };

  return (
    <div className="abil-view">
      <div className="page-head">
        <h1 className="page-title">
          <Icon name="abilities" size={20} />
          Способности
        </h1>
        <div className="page-actions">
          <Button icon="sword" onClick={() => setTemplatesOpen(true)}>
            Базовые действия
          </Button>
          <Button icon="book" onClick={() => setPickerOpen(true)}>
            Выбрать из каталога
          </Button>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setEditorTarget({ ability: blankAbility(), isNew: true })}
          >
            Добавить способность
          </Button>
        </div>
      </div>

      <div className="abil-toolbar">
        <div className="abil-search">
          <Icon name="search" size={15} />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск способности…"
            aria-label="Поиск способности"
          />
        </div>
        <div className="abil-filter-inline">
          <Select
            value={kindFilter}
            aria-label="Вид способности"
            className="abil-kind-select"
            onChange={(event) => setKindFilter(event.target.value as AbilityKind | "all")}
          >
            <option value="all">Все виды</option>
            {ABILITY_KINDS.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.label}
              </option>
            ))}
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon="close" onClick={resetFilters}>
              Сбросить
            </Button>
          )}
        </div>
        <div className="abil-chips abil-type-chips">
          {ACTION_TYPES.map((type) => (
            <Chip
              key={type.key}
              active={typeFilter.includes(type.key)}
              onClick={() => setTypeFilter((prev) => toggleInList(prev, type.key))}
              title={type.hint}
            >
              {type.short}
            </Chip>
          ))}
        </div>
      </div>

      {abilities.length === 0 ? (
        <EmptyState
          icon="sword"
          title="Способностей пока нет"
          action={
            <div className="hstack">
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setEditorTarget({ ability: blankAbility(), isNew: true })}
              >
                Добавить способность
              </Button>
              <Button icon="book" onClick={() => setPickerOpen(true)}>
                Каталог
              </Button>
              <Button icon="sword" onClick={() => setTemplatesOpen(true)}>
                Базовые действия
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Ничего не найдено"
          action={
            <Button variant="primary" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          }
        />
      ) : (
        groups.map((group) => {
          const collapsed = collapsedGroups.includes(group.key);
          return (
            <section className="abil-group" key={group.key}>
              <button
                type="button"
                className="abil-group-head"
                onClick={() =>
                  setCollapsedGroups((prev) => toggleInList(prev, group.key))
                }
                title={group.hint}
                aria-expanded={!collapsed}
              >
                <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={16} />
                <h2>{group.label}</h2>
                <span className="abil-group-count mono">{group.items.length}</span>
              </button>
              {!collapsed && (
                <div className="abil-grid">
                  {group.items.map((ability) => (
                    <AbilityCard
                      key={ability.id}
                      ability={ability}
                      character={character}
                      expanded={expandedOverrides[ability.id] ?? defaultExpanded}
                      onToggle={() =>
                        setExpandedOverrides((prev) => ({
                          ...prev,
                          [ability.id]: !(prev[ability.id] ?? defaultExpanded),
                        }))
                      }
                      onEdit={() => setEditorTarget({ ability, isNew: false })}
                      onDuplicate={() => duplicateAbility(ability)}
                      onDelete={() => deleteAbility(ability)}
                      onRoll={() => setRolling(ability)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {editorTarget && (
        <AbilityEditor
          key={editorTarget.ability.id}
          initial={editorTarget.ability}
          isNew={editorTarget.isNew}
          onClose={() => setEditorTarget(null)}
          onSave={handleSave}
        />
      )}
      {pickerOpen && (
        <Suspense fallback={null}>
          <AbilityPicker
            existing={abilities}
            character={character}
            onClose={() => setPickerOpen(false)}
            onAdd={(ability) => addFromCatalog(ability, "Способность добавлена из каталога")}
          />
        </Suspense>
      )}
      {templatesOpen && (
        <TemplatesModal
          existing={abilities}
          onClose={() => setTemplatesOpen(false)}
          onAdd={(ability) => addFromCatalog(ability, "Базовое действие добавлено")}
        />
      )}
      {rolling && (
        <RollModal ability={rolling} character={character} onClose={() => setRolling(null)} />
      )}
    </div>
  );
}
