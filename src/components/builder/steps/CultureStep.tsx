import { useLocale } from "../../../i18n/locale";
import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { SkillPicker } from "../../SkillPicker";
import { BuilderSelection } from "../BuilderSelection";
import { useBuilderStep } from "../BuilderStepContext";

export function CultureStep({ part }: { part: string }) {
  const { locale, t: tr } = useLocale();
  const { draft, patch, skillSlots, ancestrySkills } = useBuilderStep();
  if (part === "skills")
    return (
      <SkillPicker
        hideTitle
        label={tr("Навыки культуры", "Culture skills")}
        slots={skillSlots.culture}
        values={draft.cultureSkills}
        prior={ancestrySkills}
        onChange={(cultureSkills) => patch({ cultureSkills })}
      />
    );
  const keys = ["environment", "organization", "upbringing"] as const;
  const key = keys.find((key) => key === part) ?? "environment";
  const i = keys.indexOf(key);
  return (
    <>
      <BuilderSelection
        key={key}
        label={locale === "en" ? ["Environment", "Organization", "Upbringing"][i] : ["Окружение", "Организация", "Воспитание"][i]}
        options={data.cultures[key].map((o) => ({
          name: o.name,
          articleId: o.articleId,
          description: o.text,
        }))}
        selected={draft.culture[key] ? { name: draft.culture[key] } : null}
        changesFor={(name) => {
          const skills = [...draft.cultureSkills];
          skills[i] = "";
          return {
            culture: { ...draft.culture, [key]: name },
            cultureSkills: skills,
          };
        }}
      />
    </>
  );
}
