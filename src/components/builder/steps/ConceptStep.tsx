import { useLocale } from "../../../i18n/locale";
import { Button, Field, TextArea, TextInput } from "../../ui";
import { Reference } from "../Reference";
import { useBuilderStep } from "../BuilderStepContext";

export function ConceptStep() {
  const { t } = useLocale();
  const { draft, patch, createBlankCharacter, busy } = useBuilderStep();

  return (
    <>
      <Field label={t("Имя героя", "Hero name")}>
        <TextInput
          autoFocus
          placeholder={t("Как зовут вашего героя?", "What is your hero’s name?")}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <Field label={t("Кем вы хотите быть?", "Who do you want to be?")}>
        <TextArea
          placeholder={t("Как вы сражаетесь? Что умеете вне боя? Почему стали героем?", "How do you fight? What do you do outside combat? Why did you become a hero?")}
          rows={5}
          value={draft.concept}
          onChange={(e) => patch({ concept: e.target.value })}
        />
      </Field>
      <Reference
        id="0301"
        label={t("О создании героя", "About hero creation")}
        text={t("Порядок шагов — предложение из книги. Можно переходить между этапами и возвращаться к прежним решениям. Свободные удары и базовые действия добавляются автоматически.", "The book suggests this order. You can move between steps and revise your choices. Free strikes and basic actions are added automatically.")}
      />
      <Button
        variant="ghost"
        onClick={createBlankCharacter}
        disabled={busy}
      >
        {t("Создать пустой лист для ручного заполнения", "Create a blank sheet to fill in yourself")}
      </Button>
    </>
  );
}
