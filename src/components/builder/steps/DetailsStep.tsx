import { useLocale } from "../../../i18n/locale";
import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { RuleText } from "../../RuleText";
import { Button, Field, Select, TextArea, TextInput } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function DetailsStep() {
  const { locale, t } = useLocale();
  const { draft, patch, createBlankCharacter, busy } = useBuilderStep();

  return (
    <>
      <Field label={t("Имя героя", "Hero name")}>
        <TextInput
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder={t("Как зовут вашего героя?", "What is your hero’s name?")}
        />
      </Field>
      <Field label={t("Замысел (необязательно)", "Concept (optional)")}>
        <TextArea
          value={draft.concept}
          onChange={(e) => patch({ concept: e.target.value })}
          rows={3}
          placeholder={t("Кем вы хотите быть?", "Who do you want to be?")}
        />
      </Field>
      <Field label={t("Нюанс (необязательно)", "Complication (optional)")}>
        <Select
          value={draft.complication}
          onChange={(e) => patch({ complication: e.target.value })}
        >
          <option value="">{t("Без нюанса", "No complication")}</option>
          {data.complications.map((c) => (
            <option key={c.name} value={c.name}>{locale === "en" && c.originalName ? c.originalName : c.name}</option>
          ))}
        </Select>
      </Field>
      {draft.complication && (
        <RuleText
          text={
            data.complications.find((c) => c.name === draft.complication)
              ?.[locale === "en" ? "originalDescription" : "text"] || data.complications.find((c) => c.name === draft.complication)?.text || ""
          }
        />
      )}
      <Field label={t("Языки культуры и карьеры (через запятую)", "Culture and career languages (comma separated)")}>
        <TextInput
          value={draft.languages}
          onChange={(e) => patch({ languages: e.target.value })}
        />
      </Field>
      <Field label={t("Внешность, характер, цели", "Appearance, personality, goals")}>
        <TextArea
          value={draft.details}
          onChange={(e) => patch({ details: e.target.value })}
          rows={4}
        />
      </Field>
      <Field label={t("Заметки об особенностях (необязательно)", "Feature notes (optional)")}>
        <TextArea
          value={draft.features}
          onChange={(e) => patch({ features: e.target.value })}
          rows={3}
          placeholder={t("Особые условия и решения по правилам", "Special conditions and rules decisions")}
        />
      </Field>
      <Field label={t("Связи с другими героями", "Connections to other heroes")}>
        <TextArea
          value={draft.connections}
          onChange={(e) => patch({ connections: e.target.value })}
          rows={3}
        />
      </Field>
      <section className="builder-reference">
        <h3>{t("Заполнить лист вручную", "Fill in the sheet manually")}</h3>
        <p>{t("Будет создан пустой лист с указанным именем.", "A blank sheet will be created with the name entered above.")}</p>
        <Button onClick={createBlankCharacter} disabled={busy}>
          {t("Создать пустой лист", "Create blank sheet")}
        </Button>
      </section>
    </>
  );
}
