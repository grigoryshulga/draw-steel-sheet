import { useLocalizedData } from "../../../i18n/use-localized-data";
import { loadAncestrySignatures } from "../../../rules/consumer-english-reference";
import { useLocale } from "../../../i18n/locale";
import { BUILDER_DATA as data } from "../../../lib/character-builder";
import {
  ancestryTraitAbilities,
  ancestryTraitChoice,
} from "../../../lib/ancestry-features";
import { AbilityCardContent } from "../../AbilityCard";
import { normalizeFeatureText } from "../../../lib/utils";
import { ChoiceCard } from "../../ChoiceCard";
import { RuleText } from "../../RuleText";
import { SkillPicker } from "../../SkillPicker";
import { Button, Field, Select, TextArea } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function AncestryOptionsStep() {
  const { locale, t: tr } = useLocale();
  const signatures = useLocalizedData(locale, loadAncestrySignatures);
  const { draft, patch, go, hero, skillSlots, ancestrySkills, openTrait } =
    useBuilderStep();
  const ancestry = data.ancestries.find((a) => a.name === draft.ancestry);
  const traitsSpent =
    ancestry?.traits
      .filter((t) => draft.traits.includes(t.name))
      .reduce((sum, t) => sum + t.cost, 0) ?? 0;

  return (
    <>
      {ancestry ? (
        <>
          <div className="builder-selection-summary">
            <strong>{locale === "en" && ancestry.originalName ? ancestry.originalName : ancestry.name}</strong>
            <Button variant="ghost" size="sm" onClick={() => go("ancestry")}>
              {tr("Изменить происхождение", "Change ancestry ").trim()}
            </Button>
          </div>
          <section
            className="builder-signature"
            aria-label={tr("Знаковая черта происхождения", "Ancestry signature trait")}
          >
            <h3>{tr("Знаковая черта", "Signature trait")}</h3>
            {locale === "en" && signatures && !signatures.signatures[ancestry.articleId] && <span className="muted small">Russian</span>}
            <RuleText sourceLocale={locale} text={signatures?.signatures[ancestry.articleId] || ancestry.signature} />
            {ancestry.articleId && (
              <a
                href={`#/codex/${ancestry.articleId}`}
                target="_blank"
                rel="noreferrer"
              >
                {tr("Открыть происхождение в Кодексе ↗", "Open ancestry in the Codex ↗")}
              </a>
            )}
          </section>
          <div className="builder-section-head">
            <h3>{tr("Черты за очки", "Traits")}</h3>
            <div className="builder-budget">
              <strong className="mono">{ancestry.budget - traitsSpent}</strong>
              <span>{tr(`из ${ancestry.budget} очков свободно`, `of ${ancestry.budget} points remaining`)}</span>
            </div>
          </div>
          <div className="builder-choice-grid">
            {ancestry.traits.map((t) => {
              const englishText = t.originalDescription || signatures?.translatedTraits[t.id ?? ""];
              const traitText = locale === "en" && englishText ? englishText : t.text;
              const chosen = draft.traits.includes(t.name);
              const blocked = !chosen && traitsSpent + t.cost > ancestry.budget;
              const abilities = ancestryTraitAbilities(ancestry.name, t.name);
              const choice = ancestryTraitChoice(ancestry.name, t.name);
              const selectedChoice = choice
                ? (draft.ancestryChoices?.[choice.group] ?? "")
                : "";
              const selectedAbility = choice?.options.find(
                (option) => option.id === selectedChoice,
              )?.ability;
              return (
                <ChoiceCard
                  key={t.name}
                  eyebrow={tr("Черта происхождения", "Ancestry trait")}
                  title={locale === "en" && t.originalName ? t.originalName : t.name}
                  meta={tr(`${t.cost} очк.`, `${t.cost} points`)}
                  selected={chosen}
                  disabled={blocked}
                  onSelect={() =>
                    patch({
                      traits: chosen
                        ? draft.traits.filter((n) => n !== t.name)
                        : [...draft.traits, t.name],
                    })
                  }
                  onOpen={() => openTrait({ name: locale === "en" && t.originalName ? t.originalName : t.name, text: traitText })}
                >
                  {abilities.map((ability) => (
                    <AbilityCardContent
                      key={ability.id}
                      ability={ability}
                      character={hero}
                      showName={normalizeFeatureText(ability.name) !== normalizeFeatureText(t.name)}
                    />
                  ))}
                  {choice && (
                    <div
                      className="builder-trait-choice"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {chosen ? (
                        <>
                          <label className="builder-trait-choice-label">
                            <span className="eyebrow">
                              {tr("Выберите способность", "Choose an ability")}
                            </span>
                            <Select
                              value={selectedChoice}
                              aria-label={tr(`${t.name}: выберите способность`, `${t.originalName || t.name}: choose an ability`)}
                              onChange={(event) =>
                                patch({
                                  ancestryChoices: {
                                    ...(draft.ancestryChoices ?? {}),
                                    [choice.group]: event.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">{tr("Не выбрана", "Not selected")}</option>
                              {choice.options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {locale === "en" ? option.ability.originalName || option.label : option.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                          {selectedAbility && (
                            <AbilityCardContent
                              ability={selectedAbility}
                              character={hero}
                            />
                          )}
                        </>
                      ) : (
                        <p className="choice-card-summary">
                          {tr("Выберите черту, чтобы получить одну из трёх знаковых способностей на выбор.", "Choose this trait to select one of three signature abilities.")}
                        </p>
                      )}
                    </div>
                  )}
                  {!choice && abilities.length === 0 && (
                    <>{locale === "en" && !englishText && <span className="muted small">Russian</span>}<RuleText sourceLocale={englishText ? locale : "ru"} text={traitText} /></>
                  )}
                </ChoiceCard>
              );
            })}
          </div>
          {ancestry.name === "Ревенант" && (
            <Field label={tr("Предыдущая жизнь: прошлое происхождение и эффекты", "Previous life: former ancestry and effects")}>
              <TextArea
                value={draft.features}
                onChange={(e) => patch({ features: e.target.value })}
                rows={3}
              />
            </Field>
          )}
          {skillSlots.ancestry.length > 0 && (
            <SkillPicker
              label={tr("Навыки происхождения", "Ancestry skills")}
              slots={skillSlots.ancestry}
              values={ancestrySkills}
              onChange={(ancestrySkills) => patch({ ancestrySkills })}
            />
          )}
        </>
      ) : (
        <p className="builder-notice">{tr("Сначала выберите происхождение.", "Choose an ancestry first.")}</p>
      )}
    </>
  );
}
