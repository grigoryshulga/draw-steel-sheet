import { useLocalizedData } from "../../../i18n/use-localized-data";
import { loadBuilderOptions } from "../../../rules/consumer-english-reference";
import { useLocale } from "../../../i18n/locale";
import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { featureEquipmentRequirements } from "../../../lib/feature-equipment-requirements";
import { CharacteristicAllocator } from "../../CharacteristicAllocator";
import { FeatureEquipmentFields } from "../../FeatureEquipmentFields";
import { SkillPicker } from "../../SkillPicker";
import { Field, Select } from "../../ui";
import { BuilderSelection } from "../BuilderSelection";
import { Reference } from "../Reference";
import { useBuilderStep } from "../BuilderStepContext";

export function ClassOptionsStep({ part }: { part: string }) {
  const { locale, t: tr } = useLocale();
  const {
    draft,
    pendingChanges,
    patch,
    hero,
    skillSlots,
    ancestrySkills,
    cultureSkills,
    careerSkills,
  } = useBuilderStep();
  const classData = data.classes.find((c) => c.name === draft.className);
  const optionsByClass = useLocalizedData(locale, loadBuilderOptions);
  const originals = optionsByClass?.[draft.className];
  if (!classData) return <p>{tr("Сначала выберите класс.", "Choose a class first.")}</p>;
  const domains = draft.subclass.split(", ").filter(Boolean);
  if (part === "subclass") {
    if (draft.className === "Проводник")
      return (
        <>
          <p className="builder-intro">
            {tr("Выберите два разных домена. На следующем шаге выберите, какой из них даст особенность 1-го уровня.", "Choose two different domains. On the next step, choose which grants your level 1 feature.")}
          </p>
          {[0, 1].map((i) => (
            <section key={i}>
              <Field label={tr(`Домен ${i + 1}`, `Domain ${i + 1}`)}>
                <Select
                  value={draft.subclass.split(", ")[i] || ""}
                  onChange={(event) => {
                    const values = draft.subclass.split(", ");
                    values[i] = event.target.value;
                    patch({
                      subclass: values.join(", "),
                      classSkills: [],
                      conduitDomainFeature: values.includes(
                        draft.conduitDomainFeature,
                      )
                        ? draft.conduitDomainFeature
                        : "",
                    });
                  }}
                >
                  <option value="">{tr("Выберите домен", "Choose a domain")}</option>
                  {classData.subclasses
                    .filter((s) => s.name !== draft.subclass.split(", ")[1 - i])
                    .map((s) => (
                      <option key={s.name} value={s.name}>{locale === "en" && s.originalName ? s.originalName : s.name}</option>
                    ))}
                </Select>
              </Field>
              <Reference
                label={tr("Правила домена", "Domain rules")}
                text={
                  originals?.[draft.subclass.split(", ")[i]]?.text || classData.subclasses.find(
                    (s) => s.name === draft.subclass.split(", ")[i],
                  )?.text || ""
                }
              />
            </section>
          ))}
        </>
      );
    return (
      <BuilderSelection
        key={draft.className}
        label={tr("Подкласс", "Subclass")}
        layout="tiles"
        options={classData.subclasses.map((s) => ({
          name: s.name,
          originalName: s.originalName, originalDescription: originals?.[s.name]?.text,
          description: s.text,
        }))}
        selected={draft.subclass ? { name: draft.subclass } : null}
        changesFor={(subclass) => ({
          subclass,
          classSkills: [],
          kit: "",
          secondaryKit: "",
          meleeDamageKit: "",
          rangedDamageKit: "",
          kitBonusSelections: {},
        })}
      />
    );
  }
  if (part === "domain") {
    const options =
      data.classes
        .find((c) => c.name === "Проводник")
        ?.subclasses.filter(
          (s) => draft.className !== "Проводник" || domains.includes(s.name),
        ) ?? [];
    const name =
      draft.className === "Проводник"
        ? draft.conduitDomainFeature
        : draft.domain;
    return (
      <BuilderSelection
        label={tr("Домен", "Domain")}
        options={options.map((s) => ({ name: s.name, originalName: s.originalName, originalDescription: originals?.[s.name]?.text, description: s.text }))}
        selected={name ? { name } : null}
        changesFor={(name) => ({
          ...(draft.className === "Проводник"
            ? { conduitDomainFeature: name }
            : { domain: name }),
          classSkills: [],
        })}
      />
    );
  }
  if (part === "characteristics")
    return (
      <CharacteristicAllocator
        className={draft.className}
        value={draft.characteristics}
        onChange={(characteristics) => patch({ characteristics })}
      />
    );
  if (part === "skills")
    return (
      <SkillPicker
        hideTitle
        label={tr("Навыки класса", "Class skills")}
        slots={skillSlots.class}
        values={draft.classSkills}
        prior={[...ancestrySkills, ...cultureSkills, ...careerSkills]}
        onChange={(classSkills) => patch({ classSkills })}
      />
    );
  const group = classData.featureChoices.find(
    (g) => part === `feature:${g.name}`,
  );
  if (!group) return null;
  const chosenName = draft.featureChoices[group.name];
  const previewName = pendingChanges?.featureChoices?.[group.name] ?? chosenName;
  const equipmentRequirement = featureEquipmentRequirements(draft.className, {
    ...(draft.className === "Проводник" && group.name === "Молитва"
      ? { "conduit.prayer": previewName }
      : {}),
    ...(draft.className === "Талант" &&
    group.name === "Псионическая аугментация"
      ? { "talent.augmentation": previewName }
      : {}),
    ...(draft.className === "Элементалист" && group.name === "Зачарование"
      ? { "elementalist.enchantment": previewName }
      : {}),
  });
  return (
    <>
      <Reference text={originals?.[group.name]?.text || group.text} label={tr("Как работает этот выбор", "How this choice works")} />
      <BuilderSelection
        key={group.name}
        label={originals?.[group.name]?.name || group.name}
        options={group.options.map((o) => ({
          name: o.name,
          originalName: originals?.[o.name]?.name,
          originalDescription: originals?.[o.name]?.text,
          description: o.text,
        }))}
        selected={chosenName ? { name: chosenName } : null}
        changesFor={(name) => ({
          featureChoices: { ...draft.featureChoices, [group.name]: name },
        })}
      />
      {equipmentRequirement && (
        <FeatureEquipmentFields
          value={draft.equipment}
          hasKit={Boolean(hero.kit.trim() || hero.secondaryKit?.trim())}
          automationEnabled={hero.automation?.enabled ?? false}
          onChange={(equipment) => patch({ equipment })}
        />
      )}
    </>
  );
}
