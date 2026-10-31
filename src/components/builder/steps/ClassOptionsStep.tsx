import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { classPreset } from "../../../data/classes";
import { classFeatureOptionAutomated } from "../../../lib/class-feature-view";
import { featureEquipmentRequirements } from "../../../lib/feature-equipment-requirements";
import { CharacteristicAllocator } from "../../CharacteristicAllocator";
import { ChoiceCard } from "../../ChoiceCard";
import { FeatureEquipmentFields } from "../../FeatureEquipmentFields";
import { RuleText } from "../../RuleText";
import { SkillPicker } from "../../SkillPicker";
import { Reference } from "../Reference";
import { Button, Field, Select, TextArea } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassOptionsStep() {
  const {
    draft,
    patch,
    go,
    hero,
    skillSlots,
    ancestrySkills,
    cultureSkills,
    careerSkills,
    openSubclass,
  } = useBuilderStep();
  const classData = data.classes.find((c) => c.name === draft.className);
  const preset = classPreset(draft.className);

  return (
    <>
      {preset ? (
        <>
          <div className="builder-selection-summary">
            <strong>{draft.className}</strong>
            <div className="builder-selection-actions">
              {classData?.articleId && (
                <a href={`#/codex/${classData.articleId}`} target="_blank" rel="noreferrer">
                  Класс в Кодексе ↗
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => go("class")}>Изменить класс</Button>
            </div>
          </div>
          {draft.className === "Проводник" ? (
            <div className="builder-skill-choices">
              {[0, 1].map((i) => (
                <Field key={i} label={`Домен ${i + 1}`}>
                  <Select
                    value={draft.subclass.split(", ")[i] || ""}
                    onChange={(e) => {
                      const values = draft.subclass.split(", ");
                      values[i] = e.target.value;
                      const subclass = values.join(", ");
                      const selectedDomains = subclass.split(",").map((name) => name.trim());
                      if (subclass !== draft.subclass) patch({
                        subclass,
                        classSkills: [],
                        conduitDomainFeature: selectedDomains.includes(draft.conduitDomainFeature)
                          ? draft.conduitDomainFeature
                          : "",
                      });
                    }}
                  >
                    <option value="">Выберите домен</option>
                    {classData?.subclasses
                      .filter(
                        (s) =>
                          s.name !== draft.subclass.split(", ")[1 - i],
                      )
                      .map((s) => (
                        <option key={s.name}>{s.name}</option>
                      ))}
                  </Select>
                </Field>
              ))}
            </div>
          ) : (
            <>
            <div className="builder-section-head">
              <h3>Подкласс</h3>
              <span className="muted small">
                {draft.subclass ? "Выбран" : "Выберите 1"}
              </span>
            </div>
            <div className="builder-subclass-grid">
              {(classData?.subclasses ?? []).map((subclass) => (
                <ChoiceCard
                  key={subclass.name}
                  eyebrow="Подкласс"
                  title={subclass.name}
                  summary={<RuleText text={subclass.text} />}
                  selected={draft.subclass === subclass.name}
                  onSelect={() =>
                    patch({
                      subclass: subclass.name,
                      classSkills: [],
                      kit: "",
                      secondaryKit: "",
                    })
                  }
                  onOpen={() =>
                    openSubclass({
                      title: subclass.name,
                      text: subclass.text,
                    })
                  }
                />
              ))}
            </div>
            </>
          )}
          {draft.className === "Цензор" && (
            <Field label="Домен цензора">
              <Select
                value={draft.domain}
                onChange={(e) =>
                  patch({ domain: e.target.value, classSkills: [] })
                }
              >
                <option value="">Выберите домен</option>
                {data.classes
                  .find((c) => c.name === "Проводник")
                  ?.subclasses.map((s) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
              </Select>
            </Field>
          )}
          <CharacteristicAllocator
            className={draft.className}
            value={draft.characteristics}
            onChange={(characteristics) => patch({ characteristics })}
          />
          <SkillPicker
            label="Навыки класса"
            slots={skillSlots.class}
            values={draft.classSkills}
            prior={[...ancestrySkills, ...cultureSkills, ...careerSkills]}
            onChange={(classSkills) => patch({ classSkills })}
          />
          {classData?.featureChoices.map((group) => {
            const chosenName = draft.featureChoices[group.name];
            const chosenOption = group.options.find(
              (option) => option.name === chosenName,
            );
            const equipmentRequirement = featureEquipmentRequirements(draft.className, {
              ...(draft.className === "Проводник" && group.name === "Молитва" ? { "conduit.prayer": chosenName } : {}),
              ...(draft.className === "Талант" && group.name === "Псионическая аугментация" ? { "talent.augmentation": chosenName } : {}),
              ...(draft.className === "Элементалист" && group.name === "Зачарование" ? { "elementalist.enchantment": chosenName } : {}),
            });
            return (
              <section className="builder-section" key={group.name}>
                <Field label={group.name}>
                  <Select
                    value={draft.featureChoices[group.name] || ""}
                    onChange={(e) =>
                      patch({
                        featureChoices: {
                          ...draft.featureChoices,
                          [group.name]: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Выберите особенность</option>
                    {group.options.map((o) => (
                      <option key={o.name}>{o.name}</option>
                    ))}
                  </Select>
                </Field>
                <Reference
                  text={group.text}
                  label="Как работает этот выбор"
                />
                {chosenOption && (
                  <>
                    <p className="muted small">
                      {classFeatureOptionAutomated(
                        draft.className,
                        chosenOption.name,
                      )
                        ? "Поддерживает авторасчёт"
                        : "По тексту правил"}
                    </p>
                    {(equipmentRequirement) && (
                      <FeatureEquipmentFields
                        value={draft.equipment}
                        hasKit={Boolean(hero.kit.trim() || hero.secondaryKit?.trim())}
                        automationEnabled={hero.automation?.enabled ?? false}
                        onChange={(equipment) => patch({ equipment })}
                      />
                    )}
                    <RuleText text={chosenOption.text} />
                  </>
                )}
              </section>
            );
          })}
          <Field label="Выбранные особенности класса">
            <TextArea
              rows={5}
              value={draft.features}
              onChange={(e) => patch({ features: e.target.value })}
              placeholder="Запишите домены, доктрину, традицию и другие выборы из текста класса"
            />
          </Field>
        </>
          ) : <p className="builder-notice">Сначала выберите класс.</p>}
    </>
  );
}
