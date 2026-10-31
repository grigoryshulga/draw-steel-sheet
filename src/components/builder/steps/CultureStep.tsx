import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { Reference } from "../Reference";
import { SkillPicker } from "../../SkillPicker";
import { Field, Select, TextInput } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function CultureStep() {
  const { draft, patch, skillSlots, ancestrySkills } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Три аспекта сообщества, в котором вы выросли. Каждый даёт один
        навык.
      </p>
      {(["environment", "organization", "upbringing"] as const).map(
        (key, i) => {
          const option = data.cultures[key].find(
            (o) => o.name === draft.culture[key],
          );
          return (
            <section className="builder-section" key={key}>
              <Field
                label={["Окружение", "Организация", "Воспитание"][i]}
              >
                <Select
                  value={draft.culture[key]}
                  onChange={(e) => {
                    const skills = [...draft.cultureSkills];
                    if (e.target.value !== draft.culture[key]) skills[i] = "";
                    patch({
                      culture: {
                        ...draft.culture,
                        [key]: e.target.value,
                      },
                      cultureSkills: skills,
                    });
                  }}
                >
                  <option value="">Выберите аспект</option>
                  {data.cultures[key].map((o) => (
                    <option key={o.name}>{o.name}</option>
                  ))}
                </Select>
              </Field>
              {option && (
                <Reference id={option.articleId} text={option.text} />
              )}
            </section>
          );
        },
      )}
      <SkillPicker
        label="Навыки культуры"
        slots={skillSlots.culture}
        values={draft.cultureSkills}
        prior={ancestrySkills}
        onChange={(cultureSkills) => patch({ cultureSkills })}
      />
      <Field label="Языки (через запятую)">
        <TextInput
          value={draft.languages}
          onChange={(e) => patch({ languages: e.target.value })}
          placeholder="Выберите вместе с Ведущим"
        />
      </Field>
      <a href="#/codex/0505" target="_blank" rel="noreferrer">
        Примеры языков ↗
      </a>
    </>
  );
}
