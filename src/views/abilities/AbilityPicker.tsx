import { useMemo, useState } from "react";
import type {
  Ability,
  AbilityKind,
  ActionType,
  Character,
  CompendiumAbility,
} from "../../types";
import {
  ABILITY_KINDS,
  ACTION_TYPES,
  CLASS_NAMES,
  actionShort,
  kindLabel,
} from "../../data/actions";
import { ABILITY_COMPENDIUM } from "../../data/compendium";
import { makeId } from "../../data/templates";
import {
  Button,
  Chip,
  EmptyState,
  Modal,
  Select,
  TextInput,
} from "../../components/ui";
import { AbilityCard } from "../../components/AbilityCard";
import { Icon } from "../../components/Icons";
import { ownershipKey } from "./shared";
import "../AbilitiesView.css";

type SourceFilter = "all" | "class" | "kit" | "basic";

export interface AbilityPickerProps {
  existing: Ability[];
  character: Character;
  onClose: () => void;
  onAdd: (ability: Ability) => void;
  /** Переключиться на создание своей способности. */
  onCreateOwn?: () => void;
  /** Переключиться на базовые действия. */
  onOpenTemplates?: () => void;
}

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "class", label: "Классы" },
  { key: "kit", label: "Комплекты" },
  { key: "basic", label: "Базовые" },
];

export function AbilityPicker({
  existing,
  character,
  onClose,
  onAdd,
  onCreateOwn,
  onOpenTemplates,
}: AbilityPickerProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [level, setLevel] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | ActionType>("all");
  const [kindFilter, setKindFilter] = useState<"all" | AbilityKind>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const owned = useMemo(() => {
    const set = new Set<string>();
    for (const ability of existing)
      set.add(ownershipKey(ability.name, ability.source));
    return set;
  }, [existing]);

  /** Классы в порядке CLASS_NAMES, затем редкие значения из каталога. */
  const classOptions = useMemo(() => {
    const found = new Set<string>();
    for (const entry of ABILITY_COMPENDIUM) {
      if (entry.className) found.add(entry.className);
    }
    const ordered = CLASS_NAMES.filter((name) => found.has(name));
    const extras = [...found]
      .filter((name) => !CLASS_NAMES.includes(name))
      .sort();
    return [...ordered, ...extras];
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ABILITY_COMPENDIUM.filter((entry) => {
      if (source !== "all" && entry.sourceKind !== source) return false;
      if (classFilter !== "all" && entry.className !== classFilter)
        return false;
      if (level !== "all" && entry.level !== Number(level)) return false;
      if (actionFilter !== "all" && entry.actionType !== actionFilter)
        return false;
      if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
      if (needle) {
        const haystack = [
          entry.name,
          entry.keywords.join(" "),
          entry.flavor,
          entry.effect,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [query, source, classFilter, level, actionFilter, kindFilter]);

  const selected: CompendiumAbility | null = useMemo(
    () =>
      filtered.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const selectedOwned = selected
    ? owned.has(ownershipKey(selected.name, selected.source))
    : false;

  const add = () => {
    if (!selected) return;
    onAdd({
      ...selected,
      id: makeId(),
      preferredCharacteristic:
        selected.preferredCharacteristic ||
        selected.rollCharacteristics[0] ||
        "",
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      className="abil-picker-modal"
      title={
        <span className="abil-picker-title">
          <Icon name="book" size={18} />
          Каталог способностей
        </span>
      }
      footer={
        <div className="abil-picker-footer">
          {onOpenTemplates && (
            <Button variant="ghost" icon="sword" onClick={onOpenTemplates}>
              Базовые действия
            </Button>
          )}
          {onCreateOwn && (
            <Button variant="ghost" icon="plus" onClick={onCreateOwn}>
              Создать свою
            </Button>
          )}
          <span className="grow" />
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            variant="primary"
            icon="plus"
            disabled={!selected}
            onClick={add}
          >
            {selectedOwned ? "Добавить ещё" : "Добавить в лист"}
          </Button>
        </div>
      }
    >
      <div className="abil-picker-filters">
        <div className="abil-search">
          <Icon name="search" size={15} />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию или эффекту…"
          />
        </div>
        <div className="abil-chips">
          {SOURCE_FILTERS.map((item) => (
            <Chip
              key={item.key}
              active={source === item.key}
              onClick={() => setSource(item.key)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
        <Select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          aria-label="Класс"
        >
          <option value="all">Все классы</option>
          {classOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          aria-label="Уровень"
        >
          <option value="all">Любой уровень</option>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              Уровень {value}
            </option>
          ))}
        </Select>
        <Select
          value={actionFilter}
          onChange={(event) =>
            setActionFilter(event.target.value as "all" | ActionType)
          }
          aria-label="Тип действия"
        >
          <option value="all">Любое действие</option>
          {ACTION_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </Select>
        <Select
          value={kindFilter}
          onChange={(event) =>
            setKindFilter(event.target.value as "all" | AbilityKind)
          }
          aria-label="Вид"
        >
          <option value="all">Любой вид</option>
          {ABILITY_KINDS.map((kind) => (
            <option key={kind.key} value={kind.key}>
              {kind.label}
            </option>
          ))}
        </Select>
      </div>

      {ABILITY_COMPENDIUM.length === 0 ? (
        <EmptyState
          icon="book"
          title="Каталог пуст"
          text="Записи способностей ещё не загружены."
        />
      ) : (
        <div className="abil-picker-body">
          <div className="abil-picker-list">
            {filtered.length === 0 && (
              <EmptyState
                icon="search"
                title="Ничего не найдено"
                text="Смягчите фильтры или поиск."
              />
            )}
            {filtered.map((entry) => {
              const isActive = selected?.id === entry.id;
              const isOwned = owned.has(ownershipKey(entry.name, entry.source));
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`abil-picker-item ${isActive ? "is-active" : ""}`.trim()}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className="abil-picker-item-name">
                    {entry.name}
                    {isOwned && (
                      <span className="abil-owned-badge">в листе</span>
                    )}
                  </span>
                  <span className="abil-picker-item-meta">
                    {entry.className} · ур. {entry.level} ·{" "}
                    {actionShort(entry.actionType)} · {kindLabel(entry.kind)}
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="abil-picker-preview">
            {selected ? (
              <AbilityCard
                ability={selected}
                character={character}
                full
                className="abil-picker-card"
              />
            ) : (
              <EmptyState
                icon="book"
                title="Выберите способность"
                text="Превью появится справа."
              />
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
