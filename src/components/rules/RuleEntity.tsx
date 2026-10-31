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
 * Структурная проекция способности показывает то же оформление, что и лист,
 * но без героя: только напечатанные значения. Полный `markdown` источника
 * выводится ниже без сокращений — таблицы, ссылки, вложенные списки и заметки
 * остаются частью правила.
 */
export function RuleEntityView({ entity }: { entity: RuleEntity }) {
  const anchor = ruleEntityAnchor(entity);
  const ability = entity.ability ? referenceAbilityView(entity.ability) : null;
  const hasMarkdown = entity.markdown.trim().length > 0;

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
        {ability && <AbilityTags view={ability} />}
      </header>

      {ability && (
        <div
          className="rule-entity-ability"
          data-action={ability.actionType}
          role="group"
          aria-label="Кратко о способности"
        >
          <AbilityBody view={ability} full variant="summary" />
        </div>
      )}

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
