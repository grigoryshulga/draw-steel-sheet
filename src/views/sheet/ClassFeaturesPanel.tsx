import { useLocalizedData } from "../../i18n/use-localized-data";
import { loadBuilderOptions } from "../../rules/consumer-english-reference";
import { useLocale } from "../../i18n/locale";
import { Fragment, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Select } from "../../components/ui";
import { Icon } from "../../components/Icons";
import {
  classFeatureChoicesForSheet,
  featureSheetChoiceState,
  conduitLegacyDomainChoicesForSheet,
  confirmConduitLegacyRewardsReviewed,
  setBloomingSaintImmunityChoice,
  withClassFeatureSelection,
  classFeatureGroupsForSheet,
  featureBadgeState,
  featureCategoryGroups,
  triggerBadgeCounts,
  type FeatureSheetCategory,
  type FeatureSheetCategoryGroup,
  type FeatureSheetItem,
} from "../../lib/class-feature-view";
import { currentRuntime } from "../../lib/runtime";
import { useApp } from "../../state/AppContext";
import "./ClassFeaturesPanel.css";

/** Подпись кнопки отметки: «раз за схватку» получают, остальные — используют. */
function markLabel(item: FeatureSheetItem, english: boolean): string {
  if (english) {
    if (!item.trigger) return "Mark";
    if (item.trigger.used) return "Clear";
    return item.trigger.frequency === "encounter" ? "gained" : "used";
  }
  if (!item.trigger) return "Отметить";
  if (item.trigger.used) return "Снять";
  return item.trigger.frequency === "encounter" ? "получено" : "использовано";
}

/**
 * Кнопки «Новый раунд» и «Новая схватка» для шапки панели особенностей.
 * Действия идут через журнал игры, поэтому их можно отменить в истории.
 */
export function RoundEncounterControls({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const { character, performGameAction } = useApp();
  const runtime = currentRuntime(character);
  return (
    <div className={`cf-turn ${className}`.trim()}>
      <Button
        size="sm"
        variant="soft"
        onClick={() => performGameAction({ kind: "round" })}
        title={t("Новый раунд: номер растёт, отметки триггеров раунда снимаются", "Start the next round and reset round triggers")}
      >
        {t("Новый раунд", "New round")} · {runtime.round}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => performGameAction({ kind: "encounter" })}
        title={t("Новая схватка: номер растёт, все отметки триггеров снимаются", "Start the next encounter and reset all triggers")}
      >
        {t("Новая схватка", "New encounter")} · {runtime.encounter}
      </Button>
    </div>
  );
}

/** Бейджи записи: срабатывание, порог, иммунитет, выбор, выдача. */
function Badges({ item }: { item: FeatureSheetItem }) {
  if (item.badges.length === 0) return null;
  return (
    <ul className="cf-badges">
      {item.badges.map((badge, index) => {
        const state = featureBadgeState(badge);
        return (
          <Fragment key={`${badge.kind}-${badge.label}`}>
            {index > 0 && (
              <li className="cf-badge-sep" aria-hidden="true">
                ·
              </li>
            )}
            <li
              className={`cf-badge is-${badge.kind}${badge.active ? "" : " is-off"}`}
              title={state ? `${badge.label} — ${state}` : badge.label}
            >
              <span className="cf-badge-text">{badge.label}</span>
              {state && <span className="cf-badge-state">{state}</span>}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

export function FeatureTriggerButton({ item }: { item: FeatureSheetItem }) {
  const { t, locale } = useLocale();
  const { performGameAction } = useApp();
  const trigger = item.trigger;
  if (!trigger) return null;
  return (
    <Button
      size="sm"
      variant={trigger.used ? "ghost" : "soft"}
      aria-pressed={trigger.used}
      aria-label={`${trigger.used ? t("Снять отметку", "Clear mark") : t("Отметить срабатывание", "Mark trigger")}: ${trigger.label}`}
      onClick={() =>
        performGameAction({
          kind: "trigger",
          featureId: item.id,
          used: !trigger.used,
        })
      }
      title={trigger.label}
    >
      {markLabel(item, locale === "en")}
    </Button>
  );
}

/** Одна особенность: название, числа механики, бейджи и отметка триггера. */
function FeatureRow({ item }: { item: FeatureSheetItem }) {
  const { t, locale } = useLocale();
  const trigger = item.trigger;
  return (
    <article
      className={`cf-item${trigger?.used ? " is-used" : ""}`}
      data-category={item.category}
    >
      <div className="cf-item-head">
        <div className="cf-item-title">
          <strong className="cf-item-name">{locale === "en" ? item.originalName || item.name : item.name}</strong>
          <span className="cf-item-level mono">{t(`${item.level} ур.`, `level ${item.level}`)}</span>
        </div>
        {trigger && <FeatureTriggerButton item={item} />}
      </div>
      {item.summary && !item.summaryFromDescription && <p className="cf-item-summary">{item.summary}</p>}
      {trigger && (
        <p className="cf-item-trigger-detail">
          <span className="cf-item-note-label">{t("Условие:", "Condition:")}</span> {trigger.detail}
        </p>
      )}
      {item.notes && (
        <section className="cf-item-notes">
          <h3>{t("Примечание", "Note")}</h3>
          <p>{item.notes}</p>
        </section>
      )}
      {item.detail && (
        <section className="cf-item-detail">
          <h3>{t("Текст особенности", "Feature text")}</h3>
          <div className="cf-item-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {locale === "en" ? item.originalDescription || item.detail : item.detail}
            </ReactMarkdown>
          </div>
        </section>
      )}
      <Badges item={item} />
      {trigger?.used && trigger.count > 1 && (
        <span className="cf-item-note">
          {trigger.frequency === "encounter"
            ? t(`отмечено в этой схватке: ${trigger.count}`, `Marked this encounter: ${trigger.count}`)
            : t(`отмечено в этом раунде: ${trigger.count}`, `Marked this round: ${trigger.count}`)}
        </span>
      )}
    </article>
  );
}

/** Секция категории: карточки одной смысловой группы, свёрнута по клику. */
function CategoryGroup({
  group,
  open,
  onToggle,
}: {
  group: FeatureSheetCategoryGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const triggers = group.features.filter((item) => item.trigger && !item.trigger.used)
    .length;
  return (
    <section
      className={`cf-group${open ? "" : " is-collapsed"}`}
      data-category={group.key}
    >
      <button
        type="button"
        className="cf-group-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
        <span className="cf-group-title">{t(group.title, { ancestry: "Signature trait", class: "Class", subclass: "Subclass", resource: "Resource", choice: "Choice", trigger: "Trigger" }[group.key])}</span>
        <span className="cf-group-count mono">{group.features.length}</span>
        {triggers > 0 && (
          <span className="cf-group-triggers" title={t("Доступные срабатывания", "Available triggers")}>
            {triggers}
          </span>
        )}
        <span className="cf-group-rule" aria-hidden="true" />
      </button>
      {open && (
        <div className="cf-items">
          {group.features.map((item) => (
            <FeatureRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Выборы особенностей класса: аспект, традиция, молитва, домены. */
export function ClassFeatureChoices() {
  const { locale, t } = useLocale();
  const { character, update } = useApp();
  const options = useLocalizedData(locale, loadBuilderOptions)?.[character.className ?? ""];
  const label = (value: string) => locale === "en" ? options?.[value]?.name ?? choiceLabels[value] ?? value : value;
  // Домен Цензора и пару доменов Проводника редактируем в шапке героя,
  // чтобы не дублировать один и тот же выбор в двух местах.
  const choices = classFeatureChoicesForSheet(character).filter(
    (choice) =>
      choice.group !== "censor.domain" && choice.group !== "conduit.domain",
  );
  const conduitState = conduitLegacyDomainChoicesForSheet(character);

  const selectChoice = (group: string, value: string) => {
    update((current) => {
      if (group === "conduit.blooming-saint-immunity") return setBloomingSaintImmunityChoice(current, value);
      // Аспект Неистового, орден Цензора и традиция Таланта живут ещё и в
      // `subclass`: без синхронизации выбор из панели не открывал бы
      // повышение уровня.
      return withClassFeatureSelection(current, group, value);
    });
  };

  if (choices.length === 0 && !conduitState.message && !conduitState.legacyWarning) {
    return null;
  }

  return (
    <>
      {choices.length > 0 && (
        <div className="cf-choices">
          {choices.map((choice) => {
            const state = featureSheetChoiceState(choice);
            return (
              <label className="cf-choice" key={choice.group}>
                <span className="cf-choice-label">{label(choice.label)}</span>
                <Select
                  value={state.selectedOption}
                  aria-label={t(`${choice.label}: выберите вариант`, `Choose an option for ${label(choice.label)}`)}
                  onChange={(event) => selectChoice(choice.group, event.target.value)}
                >
                  <option value="">{t("Не выбран", "Not selected")}</option>
                  {choice.options.map((option) => (
                    <option key={option} value={option}>
                      {label(choice.optionLabels?.[option] ?? groupOptionLabel(choice.group, option))}
                    </option>
                  ))}
                </Select>
                {state.warning && <span className="cf-item-note">{state.warning}</span>}
              </label>
            );
          })}
        </div>
      )}
      {conduitState.message && (
        <div className="cf-choices">
          <p className="cf-item-note">{conduitState.message}</p>
        </div>
      )}
      {conduitState.legacyWarning && (
        <div className="cf-choices">
          <p className="cf-item-note">{conduitState.legacyWarning}</p>
          <Button size="sm" variant="soft" onClick={() => update((current) => confirmConduitLegacyRewardsReviewed(current))}>
            {t("Я проверил награды", "I reviewed the rewards")}
          </Button>
        </div>
      )}
    </>
  );
}

/** Номер раунда и схватки, доступные срабатывания. */
export function ClassFeatureRuntimeStatus() {
  const { t } = useLocale();
  const { character } = useApp();
  const groups = classFeatureGroupsForSheet(character);
  const triggers = triggerBadgeCounts(character);
  const hasTriggers = groups.some((group) =>
    group.features.some((item) => item.trigger),
  );
  const runtime = currentRuntime(character);
  return (
    <div className="cf-status">
      <span>
        {t(`Раунд ${runtime.round} · схватка ${runtime.encounter}`, `Round ${runtime.round} · encounter ${runtime.encounter}`)}
      </span>
      {hasTriggers && (
        <span className={triggers > 0 ? "cf-status-triggers is-live" : "cf-status-triggers"}>
          {triggers > 0 ? t(`Доступно срабатываний: ${triggers}`, `Available triggers: ${triggers}`) : t("Все срабатывания отмечены", "All triggers marked")}
        </span>
      )}
    </div>
  );
}

/**
 * Панель активных особенностей класса: выборы, состояние раунда и карточки
 * по категориям. На листе её место занимает вкладка «Развитие», поэтому
 * панель оставлена как самостоятельная сборка тех же частей.
 */
export function ClassFeatureMechanicsPanel() {
  const { t } = useLocale();
  const { character } = useApp();
  const groups = classFeatureGroupsForSheet(character);
  // Уровни больше не делят панель: карточки идут секциями по категориям.
  // Свёрнутость хранится по категории и переживает правки героя.
  // Пассивные эффекты уходят в панель способностей: здесь остаются только
  // выборы, ресурсы и срабатывания.
  const categoryGroups = featureCategoryGroups(groups)
    .map((group) => ({
      ...group,
      features: group.features.filter((item) => !item.passive),
    }))
    .filter((group) => group.features.length > 0);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<FeatureSheetCategory>
  >(new Set());

  const toggleCategory = (key: FeatureSheetCategory) =>
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  if (categoryGroups.length === 0) return null;

  return (
    <section className="cf-sheet" aria-label={t("Особенности класса по категориям", "Class features by category")}>
      <ClassFeatureChoices />
      <ClassFeatureRuntimeStatus />
      <div className="cf-groups">
        {categoryGroups.map((group) => (
          <CategoryGroup
            key={group.key}
            group={group}
            open={!collapsedCategories.has(group.key)}
            onToggle={() => toggleCategory(group.key)}
          />
        ))}
      </div>
    </section>
  );
}

const choiceLabels: Record<string, string> = {
  "Аспект": "Aspect", "Орден": "Order", "Домен": "Domain", "Традиция": "Tradition",
  "Доктрина": "Doctrine", "Коллегия": "College", "Труппа": "Troupe", "Специализация": "Specialization",
  "Иммунитет Расцветающего святого": "Blooming Saint immunity", "Порча 10": "Corruption 10", "Святой 10": "Holy 10",
};

function groupOptionLabel(group: string, option: string): string {
  if (group === "conduit.prayer" || group === "conduit.sanctuary") {
    const labels: Record<string, string> = {
      "conduit.prayer.destruction": "Молитва о разрушении",
      "conduit.prayer.distance": "Молитва о дистанции",
      "conduit.prayer.soldier": "Молитва о мастерстве солдата",
      "conduit.prayer.speed": "Молитва о скорости",
      "conduit.prayer.steel": "Молитва о стали",
      "conduit.sanctuary.bastion": "Оберег бастиона",
      "conduit.sanctuary.reaction": "Оберег реакции",
      "conduit.sanctuary.refuge": "Оберег святилища",
      "conduit.sanctuary.spirits": "Оберег духов",
    };
    return labels[option] ?? option;
  }
  if (group !== "conduit.blooming-saint-immunity") return option;
  return option === "corruption" ? "Порча 10" : option === "holy" ? "Святой 10" : "Не выбран";
}
