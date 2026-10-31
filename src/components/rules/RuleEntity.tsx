import type { RuleEntity, RuleEntityKind } from "../../rules/schema";
import { Chip } from "../ui";
import {
  AbilityBody,
  AbilityTags,
  referenceAbilityView,
} from "./AbilitySheet";
import { RuleMarkdown } from "./RuleMarkdown";
import "./RuleEntity.css";

export const RULE_ENTITY_KIND_LABELS: Record<RuleEntityKind, string> = {
  ability: "Способность",
  feature: "Особенность",
  ancestry: "Происхождение",
  kit: "Комплект",
  perk: "Перк",
  item: "Предмет",
  project: "Проект",
  title: "Титул",
};

/** Стабильный якорь раздела: зависит от id, а не от перевода названия. */
export function ruleEntityAnchor(entity: Pick<RuleEntity, "id">): string {
  return `rule-entity-${entity.id.replace(/[^\p{L}\p{N}_.:-]+/gu, "-")}`;
}

/**
 * Чтение одной канонической сущности правил.
 *
 * Способность показывается ровно одной полной карточкой — той же разметкой,
 * что и на листе героя (`sheet-ability-card`), но с напечатанными в книге
 * значениями. Полный `markdown` источника больше не дублирует карточку: из
 * него берутся только «допблоки», которых в проекции нет (Поддержание,
 * Потратить, Особое, списки и проза). Остальные виды правил выводят полный
 * текст без сокращений — таблицы, ссылки, вложенные списки и заметки
 * остаются частью правила.
 */
export function RuleEntityView({ entity }: { entity: RuleEntity }) {
  const anchor = ruleEntityAnchor(entity);
  const ability = entity.ability ? referenceAbilityView(entity.ability) : null;
  const hasMarkdown = entity.markdown.trim().length > 0;

  if (ability)
    return (
      <section
        className={`rule-entity rule-entity-${entity.kind}`}
        data-rule-entity={entity.id}
        data-kind={entity.kind}
        aria-labelledby={anchor}
      >
        <article
          className="sheet-ability-card is-full"
          data-action={ability.actionType}
          data-kind={ability.kind}
        >
          <header className="rule-entity-head">
            <h2 className="rule-entity-name" id={anchor}>
              {entity.name}
            </h2>
            <AbilityTags view={ability} />
          </header>

          {ability.flavor && (
            <p className="rule-ability-flavor">{ability.flavor}</p>
          )}

          <AbilityBody view={ability} full />

          {ability.trigger && (
            <p className="rule-ability-trigger">
              <strong className="rule-ability-trigger-label">Триггер:</strong>{" "}
              {ability.trigger}
            </p>
          )}
        </article>

        <RuleMarkdown
          text={entity.markdown}
          articleId={entity.source.articleId}
          className="rule-text rule-entity-extras"
          abilityCardRemainder={{ shownText: entity.ability?.effect }}
        />
      </section>
    );

  return (
    <section
      className={`rule-entity rule-entity-${entity.kind}`}
      data-rule-entity={entity.id}
      data-kind={entity.kind}
      aria-labelledby={anchor}
    >
      <header className="rule-entity-head">
        <div className="rule-entity-title">
          <Chip className="rule-entity-kind">
            {RULE_ENTITY_KIND_LABELS[entity.kind] ?? entity.kind}
          </Chip>
          <h2 className="rule-entity-name" id={anchor}>
            {entity.name}
          </h2>
        </div>
      </header>

      {hasMarkdown ? (
        <RuleMarkdown
          text={entity.markdown}
          articleId={entity.source.articleId}
        />
      ) : (
        <p className="rule-entity-empty">
          В источнике нет описания этого правила.
        </p>
      )}
    </section>
  );
}
