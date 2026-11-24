import { EnglishHeroAbility } from "../../components/rules/EnglishHeroAbility";
import { findAbilityOriginal, mechanicAbilityName, useAbilityCatalog, useAbilityOriginal } from "../../components/abilityOriginal";
import { useArticleLocale, useLocale, useRuleLanguage } from "../../i18n/locale";
import { ArticleLanguageSwitch } from "../../components/LanguageSwitch";
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icons";
import { AbilityCard } from "../../components/AbilityCard";
import { AbilityFacts, type AbilitySheetView } from "../../components/rules/AbilitySheet";
import { AbilityGroup } from '../../components/rules/AbilityGroup';
import { CalculationInline, CalculationToggle } from "../../components/rules/CalculationInline";
import { abilityCardView } from "../../components/rules/abilityCardView";
import { CharacteristicGlyphText } from "../../components/CharacteristicGlyph";
import { DamageChip } from "../../components/DamageChip";
const TemplatesModal = lazy(() => import("../abilities/TemplatesModal").then(module => ({ default: module.TemplatesModal })));
import { makeId } from "../../data/templates";
import { Button, Chip, EmptyState, Field, NumberInput, Panel, Select } from "../../components/ui";
import { CardDetailModal } from "../../components/CardDetailModal";
import { RichText } from "../../components/RichText";
import { kindLabel } from "../../data/actions";
import { useApp } from "../../state/AppContext";
import { missingClassFeatureAbilities } from "../../lib/class-feature-abilities";
import { itemAbilityEntries } from "../../lib/item-abilities";
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

const AbilityRollPanel = lazy(() =>
  import("../abilities/RollModal").then((module) => ({ default: module.AbilityRollPanel })),
);

const AbilityEditor = lazy(() =>
  import("../abilities/AbilityEditor").then((module) => ({ default: module.AbilityEditor })),
);

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
  const { t } = useLocale();
  const action = compact ? t("Развернуть карточки", "Expand cards") : t("Свернуть карточки до заголовков", "Collapse cards to titles");
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
  const { t } = useLocale();
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
            aria-label={t(`${choice.label}: выберите способность`, `${choice.label}: choose ability`)}
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
            <option value="">{t("Не выбрана", "Not selected")}</option>
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
  const { t, locale } = useLocale();
  const catalog = useAbilityCatalog();
  const { character, update, notify, readOnly } = useApp();
  const [selected, setSelected] = useState<Ability | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  // Store explicitly opened groups: new action groups also start collapsed.
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [compactSections, setCompactSections] = useState(() => new Set(["favorites"]));
  const [filter, setFilter] = useState<AbilitySheetFilter>("all");
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{
    ability: Ability;
    isNew: boolean;
  } | null>(null);
  const abilities = character.abilities;
  const itemEntries = useMemo(() => itemAbilityEntries(character), [character]);
  const itemSource = (ability: Ability) => {
    const entry = itemEntries.find(entry => entry.ability.id === ability.id);
    return entry ? { label: "Предмет", value: entry.itemName, text: `Предмет · ${entry.itemName}` } : undefined;
  };
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
  const classGrants = useMemo(() => missingClassFeatureAbilities(character), [character]);
  const sheetAbilities = useMemo(
    () => [
      ...abilities,
      ...classGrants,
      ...ancestryEntries.map((entry) => entry.ability),
      ...itemEntries.map((entry) => entry.ability),
    ],
    [abilities, classGrants, ancestryEntries, itemEntries],
  );
  const favoriteIds = new Set(character.favoriteAbilityIds);
  const favorites = sheetAbilities.filter(ability => favoriteIds.has(ability.id));
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
  const layout = sheetAbilityLayout(
    sheetAbilities,
    activeFilter,
    query,
    subclassSources,
    ancestrySources,
  );
  const englishNeedle = query.trim().toLowerCase();
  const englishMatches = englishNeedle ? layout.groups.flatMap(group => group.items).filter(ability => findAbilityOriginal(ability, catalog)?.originalName?.toLowerCase().includes(englishNeedle)) : [];
  const matchedIds = new Set(englishMatches.map(ability => ability.id));
  const groups = layout.groups.map(group => ({ ...group, items: group.items.filter(ability => !matchedIds.has(ability.id)) })).filter(group => group.items.length);
  const topMatches = [...layout.topMatches, ...englishMatches];
  const visible = layout.visible;
  const hasFilter = filterOptions.length > 2;
  const hasQuery = query.trim().length > 0;
  const totalMatches = topMatches.length;
  const totalVisible = visible;

  function derivedNote(ability: Ability) {
    if (classGrants.some((grant) => grant.id === ability.id)) return t("Выдана особенностью класса", "Granted by a class feature");
    if (itemSource(ability)) return t("Доступна, пока предмет экипирован", "Available while the item is equipped");
    if (ancestryAbilitySource(ancestrySources, ability)) return t("Выдана происхождением", "Granted by ancestry");
  }

  const favoriteAction = (ability: Ability) => {
    if (readOnly) return undefined;
    const favorite = favoriteIds.has(ability.id);
    return <Button size="sm" variant="ghost" icon="bookmark" iconOnly
      className="sheet-ability-favorite" aria-pressed={favorite}
      onClick={() => update(current => {
        const ids = new Set(current.favoriteAbilityIds);
        if (!ids.delete(ability.id)) ids.add(ability.id);
        return { ...current, favoriteAbilityIds: [...ids] };
      })}>
      {`${favorite ? t("Убрать из избранного", "Remove from favorites") : t("Добавить в избранное", "Add to favorites")}: ${(locale === "en" ? mechanicAbilityName(ability, catalog) : ability.name) || t("Без названия", "Untitled")}`}
    </Button>;
  };

  const renderAbilityCard = (ability: Ability) => {
    const source = itemSource(ability);
    return <AbilityCard
      key={ability.id}
      ability={ability}
      character={character}
      origin={
        source ??
        subclassAbilitySource(subclassSources, ability) ??
        ancestryAbilitySource(ancestrySources, ability)
      }
      headerAction={favoriteAction(ability)}
      details={source && <p className="small muted">{source.text}</p>}
      onOpen={() => openAbility(ability)}
      openOnCardClick
    />
  };

  const toggleGroup = (key: string) =>
    setExpanded((current) => {
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
      addAbility(ability, t("Способность добавлена", "Ability added"));
    } else {
      update((c) => ({
        ...c,
        abilities: c.abilities.map((item) =>
          item.id === ability.id ? ability : item,
        ),
      }));
      notify(t("Способность сохранена", "Ability saved"), "success");
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
    notify(t("Копия создана", "Copy created"), "success");
  };
  const deleteAbility = (ability: Ability) => {
    update((c) => ({
      ...c,
      abilities: c.abilities.filter((item) => item.id !== ability.id),
      favoriteAbilityIds: c.favoriteAbilityIds?.filter(id => id !== ability.id),
    }));
    notify(t(`«${ability.name}» удалена`, `“${ability.name}” removed`), "info");
  };

  return (
    <>
      <Panel
        title={t("Способности", "Abilities")}
        icon="abilities"
        className="sheet-abilities-panel"
        actions={!readOnly && (
          <Button
            size="sm"
            variant="soft"
            icon="plus"
            iconOnly
            aria-label={t("Добавить способность", "Add ability")}
            title={t("Добавить способность", "Add ability")}
            onClick={() => setAddMode("catalog")}
          />
        )}
      >
        {readOnly ? (
          !!character.damageModifier && (
            <Chip>{t("Общий модификатор урона", "Damage modifier")}: {character.damageModifier}</Chip>
          )
        ) : (
          <div className="sheet-ability-damage-modifier">
            <Field label={t("Общий модификатор урона", "Damage modifier")}>
              <NumberInput
                integer
                value={character.damageModifier ?? 0}
                min={-9999}
                max={9999}
                label={t("Общий модификатор урона", "Damage modifier")}
                onChange={(value) => update((current) => ({ ...current, damageModifier: value }))}
              />
            </Field>
            <p>{t("Для эффектов, которые лист не считает сам. Добавляется один раз к каждому тиру с уроном, в том числе при выключенном авторасчёте.", "For effects not calculated by the sheet. Added once to each damaging tier, including when automatic calculation is off.")}</p>
            <Button
              size="sm"
              variant="ghost"
              disabled={!character.damageModifier}
              aria-label={t("Сбросить общий модификатор урона", "Reset damage modifier")}
              onClick={() => update((current) => ({ ...current, damageModifier: 0 }))}
            >{t("Сбросить", "Reset")}</Button>
          </div>
        )}
        {sheetAbilities.length === 0 && (readOnly || ancestryChoices.length === 0) ? (
          <EmptyState
            icon="abilities"
            title={t("Способностей пока нет", "No abilities yet")}
            text={readOnly ? undefined : t("Добавьте способности из каталога или создайте свою.", "Add abilities from the catalog or create your own.")}
            action={!readOnly && (
              <Button onClick={() => setAddMode("catalog")}>
                {t("Добавить способность", "Add ability")}
              </Button>
            )}
          />
        ) : (
          <div className="sheet-ability-sections">
            {!readOnly && <AncestryFeatureChoices />}
            {sheetAbilities.length > 0 && (
              <div className="sheet-ability-toolbar">
                <div className="sheet-ability-search">
                  <Icon name="search" size={15} />
                  <input
                    ref={searchInput}
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder={t("Поиск по названию, эффекту, триггеру…", "Search name, effect, or trigger…")}
                    aria-label={t("Поиск по способностям", "Search abilities")}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {hasQuery && (
                    <>
                      <span className="sheet-ability-search-count mono" aria-label={t(`Совпадений: ${totalMatches} из ${totalVisible}`, `Matches: ${totalMatches} of ${totalVisible}`)}>
                        {t(`${totalMatches} из ${totalVisible}`, `${totalMatches} of ${totalVisible}`)}
                      </span>
                      <button
                        type="button"
                        className="sheet-ability-search-clear"
                        aria-label={t("Очистить поиск", "Clear search")}
                        title={t("Очистить поиск", "Clear search")}
                        onClick={() => { setQuery(""); searchInput.current?.focus(); }}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </>
                  )}
                </div>
                {hasFilter && (
                  <Select
                    className="sheet-ability-filter"
                    aria-label={t("Фильтр способностей по виду", "Filter abilities by kind")}
                    value={activeFilter}
                    onChange={(event) => {
                      const option = filterOptions.find((item) => item.key === event.target.value);
                      if (option) setFilter(option.key);
                    }}
                  >
                    {filterOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.key === "all" ? t("Все способности", "All abilities") : t(option.label, ({ signature: "Signature", heroic: "Heroic", "free-strike": "Free strikes", other: "Other", basic: "Basic", subclass: "Subclass", ancestry: "Ancestry" } as Record<string, string>)[option.key] || option.label)} ({option.count})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            {hasQuery && totalMatches === 0 && (
              <p className="sheet-ability-search-empty" role="status">
                {t("Совпадений нет. Ниже — остальные способности. Попробуйте другое слово — поиск смотрит в название, эффект, триггер, тиры и заметки.", "No matches. Other abilities appear below. Try another term; search covers names, effects, triggers, tiers, and notes.")}
              </p>
            )}
            {hasQuery && topMatches.length > 0 && (
              <section
                className={`sheet-ability-section is-search-results${compactSections.has("search") ? " is-compact" : ""}`}
                data-action="search"
                aria-label={t("Совпадения поиска", "Search matches")}
              >
                <header className="sheet-ability-section-head">
                  <span className="sheet-ability-section-toggle is-static">
                    <Icon name="search" size={14} />
                    <h3>{t("Совпадения", "Matches")}</h3>
                    <span className="sheet-ability-count mono">
                      {topMatches.length}
                    </span>
                  </span>
                  <span className="sheet-ability-rule" />
                  <CardSummaryToggle label={t("Совпадения", "Matches")} compact={compactSections.has("search")} onToggle={() => toggleCardSummary("search")} />
                </header>
                <div className="sheet-ability-grid">
                  {topMatches.map(renderAbilityCard)}
                </div>
              </section>
            )}
            {hasQuery && groups.length > 0 && <h3 className="sheet-ability-remainder-title">{t("Остальные способности", "Other abilities")}</h3>}
            {!readOnly && !hasQuery && activeFilter === "all" && favorites.length > 0 &&
              <AbilityGroup action="favorites" label={t("Избранное", "Favorites")} count={favorites.length}
                compact={compactSections.has("favorites")}
                headerActions={<CardSummaryToggle label={t("Избранное", "Favorites")} compact={compactSections.has("favorites")}
                  onToggle={() => toggleCardSummary("favorites")} />}>
                {favorites.map(renderAbilityCard)}
              </AbilityGroup>}
            {groups.map(group => <AbilityGroup key={group.key}
              action={group.key} label={t(group.label, ({ main: "Main action", maneuver: "Maneuver", move: "Move action", trigger: "Triggered action", "free-trigger": "Free triggered action", "free-maneuver": "Free maneuver", none: "No action" } as const)[group.key])} count={group.items.length}
              collapsed={!expanded.has(group.key)} onToggle={() => toggleGroup(group.key)}
              compact={compactSections.has(group.key)}
              headerActions={<CardSummaryToggle label={t(group.label, ({ main: "Main action", maneuver: "Maneuver", move: "Move action", trigger: "Triggered action", "free-trigger": "Free triggered action", "free-maneuver": "Free maneuver", none: "No action" } as const)[group.key])} compact={compactSections.has(group.key)} onToggle={() => toggleCardSummary(group.key)} />}>
              {group.items.map(renderAbilityCard)}
            </AbilityGroup>)}
          </div>
        )}
      </Panel>

      {selected && (
        <AbilityDetailModal
          ability={selected}
          derivedNote={derivedNote(selected)}
          favoriteAction={favoriteAction(selected)}
          itemOrigin={itemSource(selected)}
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
            existing={sheetAbilities}
            character={character}
            onClose={() => setAddMode(null)}
            onAdd={(ability) =>
              addAbility(ability, t("Способность добавлена из каталога", "Ability added from catalog"))
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
        <Suspense fallback={null}><TemplatesModal
          existing={sheetAbilities}
          onClose={() => setAddMode(null)}
          onAdd={(ability) => addAbility(ability, t("Базовое действие добавлено", "Basic action added"))}
        /></Suspense>
      )}
      {editing && (
        <Suspense fallback={null}>
          <AbilityEditor
            key={editing.ability.id}
            initial={editing.ability}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
            onSave={saveAbility}
          />
        </Suspense>
      )}

    </>
  );
}

function AbilityDetailModal({
  ability,
  itemOrigin,
  derivedNote,
  favoriteAction,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  ability: Ability;
  itemOrigin?: { label: string; value: string; text: string };
  derivedNote?: string;
  favoriteAction?: ReactNode;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const articleLocale = useArticleLocale();
  const { character, readOnly } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const original = useAbilityOriginal(ability);
  const { language, setLanguage, available } = useRuleLanguage(ability.originalId || ability.id, original?.originalDescription);
  const subclassSources = useMemo(
    () => subclassAbilitySources(character),
    [character],
  );
  const ancestrySources = useMemo(
    () => ancestryAbilitySourcesFrom(ancestryAbilityEntries(character)),
    [character],
  );
  const origin =
    itemOrigin ??
    subclassAbilitySource(subclassSources, ability) ??
    ancestryAbilitySource(ancestrySources, ability);
  const view = useMemo(() => abilityCardView(ability, character), [ability, character]);
  const canEdit = !readOnly && !derivedNote;
  const hasCalculations = Boolean(view.rollCalculations?.length || view.tiers.some((tier) => tier.damage?.calculations?.length));

  const detailBody = (view: AbilitySheetView) => <>
    {view.flavor && (
      <p className="sheet-ability-detail-flavor"><CharacteristicGlyphText text={view.flavor} language={language} /></p>
    )}

    <AbilityFacts language={language} view={view} showCalculations={showCalculations} />

    {view.trigger && (
      <div className="sheet-ability-detail-block sheet-ability-detail-trigger">
        <span className="eyebrow">{language === "en" ? "Trigger" : "Триггер"}</span>
        <RichText characteristicGlyphs={language === "ru"} text={view.trigger} />
      </div>
    )}

    {view.beforeRollContent}
    {view.tiers.length > 0 && (
      <div className="sheet-ability-detail-tiers">
        {view.tiers.map((tier) => (
          <div className="sheet-ability-detail-tier" data-tier={tier.tier} key={tier.tier}>
            <div className="sheet-ability-detail-tier-head">
              <span className="sheet-ability-detail-range" title={tier.rangeTitle} aria-label={tier.range}>
                <span className={`sheet-ability-tier-glyph tier-${tier.tier}`} aria-hidden="true" />
              </span>
              {tier.damage && <DamageChip value={tier.damage.value} type={tier.damage.type} language={language} />}
            </div>
            {showCalculations && tier.damage?.calculations && (
              <CalculationInline language={language} calculations={tier.damage.calculations} />
            )}
            {tier.effectContent ?? (tier.effect && <RichText characteristicGlyphs={language === "ru"} text={tier.effect} />)}
          </div>
        ))}
      </div>
    )}

    {view.effect && (
      <div className="sheet-ability-detail-block">
        <span className="eyebrow">{language === "en" ? "Effect" : "Эффект"}</span>
        <RichText characteristicGlyphs={language === "ru"} text={view.effect} />
      </div>
    )}
    {view.forcedMovement && <p className="sheet-ability-forced">{view.forcedMovement}</p>}
  </>;

  return (
    <CardDetailModal
      open
      onClose={onClose}
      className={`sheet-ability-modal${ability.source === BASIC_ABILITY_SOURCE ? " is-basic" : ""}`}
      sidecar={!readOnly && (
        <Suspense fallback={null}>
          <AbilityRollPanel key={ability.id} ability={ability} character={character} showCalculations={showCalculations} language={language} printedAbilityId={original?.id} />
        </Suspense>
      )}
      headerActions={
        <>
          {available && !articleLocale && <ArticleLanguageSwitch language={language} setLanguage={setLanguage} />}
          {favoriteAction}
          {canEdit && (
            <>
              <Button
                variant="ghost"
                icon="copy"
                iconOnly
                aria-label={t("Создать копию", "Create copy")}
                title={t("Копия", "Copy")}
                onClick={onDuplicate}
              />
              <Button
                variant="ghost"
                icon="edit"
                iconOnly
                aria-label={t("Изменить", "Edit")}
                title={t("Изменить", "Edit")}
                onClick={onEdit}
              />
            </>
          )}
        </>
      }
      title={(language === "en" && original?.originalName) || ability.name || "Без названия"}
      meta={
        <Chip tone={ability.source === BASIC_ABILITY_SOURCE ? "default" : kindTone(ability.kind)}>
          {kindLabel(ability.kind, language)}
        </Chip>
      }
      footer={(hasCalculations || canEdit || derivedNote) && (
        <>
          {hasCalculations && (
            <CalculationToggle language={language} checked={showCalculations} onChange={setShowCalculations} />
          )}
          <span className="grow" />
          {canEdit && (
            <Button
              variant="ghost"
              onClick={() =>
                confirmDelete ? onDelete() : setConfirmDelete(true)
              }
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? t("Точно удалить?", "Confirm deletion?") : t("Удалить", "Delete")}
            </Button>
          )}
          {derivedNote && (
            <span className="sheet-ability-derived-note">
              {derivedNote}
            </span>
          )}
        </>
      )}
    >
      <div className="sheet-ability-detail" lang={language}>
        {(origin || ability.source === BASIC_ABILITY_SOURCE || ability.resourceCost > 0) && (
          <div className="hstack wrap">
            {origin && <Chip tone="accent">{origin.text}</Chip>}
            {ability.source === BASIC_ABILITY_SOURCE && <Chip>{language === "en" ? "Basic" : "Базовая"}</Chip>}
            {ability.resourceCost > 0 && <Chip tone="yellow">{language === "en" ? "Cost" : "Стоимость"}: {ability.resourceCost}</Chip>}
          </div>
        )}

        {language === "en" && original
          ? <EnglishHeroAbility original={original} base={view} full>{detailBody}</EnglishHeroAbility>
          : detailBody(view)}
        {ability.notes && (
          <div className="sheet-ability-detail-block sheet-ability-detail-notes">
            <span className="eyebrow">{t("Заметки", "Notes")}</span>
            <RichText characteristicGlyphs text={ability.notes} />
          </div>
        )}
      </div>
    </CardDetailModal>
  );
}
