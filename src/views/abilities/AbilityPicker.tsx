import { useLocale } from "../../i18n/locale";
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
  const { t, locale } = useLocale();
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
          entry.originalName || "",
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
          {t("Каталог способностей", "Ability catalog")}
        </span>
      }
      footer={
        <div className="abil-picker-footer">
          {onOpenTemplates && (
            <Button variant="ghost" icon="sword" onClick={onOpenTemplates}>
              {t("Базовые действия", "Basic actions")}
            </Button>
          )}
          {onCreateOwn && (
            <Button variant="ghost" icon="plus" onClick={onCreateOwn}>
              {t("Создать свою", "Create custom")}
            </Button>
          )}
          <span className="grow" />
          <Button
            variant="primary"
            icon="plus"
            disabled={!selected}
            onClick={add}
          >
            {selectedOwned ? t("Добавить ещё", "Add another") : t("Добавить в лист", "Add to sheet")}
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
            placeholder={t("Поиск по названию или эффекту…", "Search name or effect…")}
          />
        </div>
        <div className="abil-chips">
          {SOURCE_FILTERS.map((item) => (
            <Chip
              key={item.key}
              active={source === item.key}
              onClick={() => setSource(item.key)}
            >
              {locale === "en" ? ({ all: "All", class: "Classes", kit: "Kits", basic: "Basic" } as const)[item.key] : item.label}
            </Chip>
          ))}
        </div>
        <Select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          aria-label={t("Класс", "Class")}
        >
          <option value="all">{t("Все классы", "All classes")}</option>
          {classOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          aria-label={t("Уровень", "Level")}
        >
          <option value="all">{t("Любой уровень", "Any level")}</option>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {t("Уровень", "Level")} {value}
            </option>
          ))}
        </Select>
        <Select
          value={actionFilter}
          onChange={(event) =>
            setActionFilter(event.target.value as "all" | ActionType)
          }
          aria-label={t("Тип действия", "Action type")}
        >
          <option value="all">{t("Любое действие", "Any action")}</option>
          {ACTION_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {locale === "en" ? ({ main: "Main action", maneuver: "Maneuver", move: "Move action", trigger: "Triggered action", "free-trigger": "Free triggered action", "free-maneuver": "Free maneuver", none: "No action" } as const)[type.key] : type.label}
            </option>
          ))}
        </Select>
        <Select
          value={kindFilter}
          onChange={(event) =>
            setKindFilter(event.target.value as "all" | AbilityKind)
          }
          aria-label={t("Вид", "Kind")}
        >
          <option value="all">{t("Любой вид", "Any kind")}</option>
          {ABILITY_KINDS.map((kind) => (
            <option key={kind.key} value={kind.key}>
              {locale === "en" ? ({ signature: "Signature", heroic: "Heroic", "free-strike": "Free strike", other: "Other" } as const)[kind.key] : kind.label}
            </option>
          ))}
        </Select>
      </div>

      {ABILITY_COMPENDIUM.length === 0 ? (
        <EmptyState
          icon="book"
          title={t("Каталог пуст", "Catalog is empty")}
          text={t("Записи способностей ещё не загружены.", "Ability entries have not loaded yet.")}
        />
      ) : (
        <div className="abil-picker-body">
          <div className="abil-picker-list">
            {filtered.length === 0 && (
              <EmptyState
                icon="search"
                title={t("Ничего не найдено", "Nothing found")}
                text={t("Смягчите фильтры или поиск.", "Try different filters or search terms.")}
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
                    {locale === "en" && entry.originalDescription ? entry.originalName || entry.name : entry.name}
                    {isOwned && (
                      <span className="abil-owned-badge">{t("в листе", "on sheet")}</span>
                    )}
                  </span>
                  <span className="abil-picker-item-meta">
                    {entry.className} · {t("ур.", "level")} {entry.level} ·{" "}
                    {locale === "en" ? entry.actionType : actionShort(entry.actionType)} · {locale === "en" ? entry.kind : kindLabel(entry.kind)}
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="abil-picker-preview">
            {selected ? (
              <AbilityCard
                ability={selected}
                canonical
                character={character}
                full
                className="abil-picker-card"
              />
            ) : (
              <EmptyState
                icon="book"
                title={t("Выберите способность", "Choose an ability")}
                text={t("Превью появится справа.", "A preview will appear here.")}
              />
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
