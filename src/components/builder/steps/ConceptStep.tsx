import { Button, Field, TextArea, TextInput } from "../../ui";
import { Reference } from "../Reference";
import { useBuilderStep } from "../BuilderStepContext";

export function ConceptStep() {
  const { draft, patch, createBlankCharacter, busy } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Начните с идеи. Каждый выбор добавит новую часть в лист справа.
      </p>
      <Field label="Имя героя">
        <TextInput
          autoFocus
          placeholder="Как зовут вашего героя?"
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <Field label="Кем вы хотите быть?">
        <TextArea
          placeholder="Как вы сражаетесь? Что умеете вне боя? Почему стали героем?"
          rows={5}
          value={draft.concept}
          onChange={(e) => patch({ concept: e.target.value })}
        />
      </Field>
      <Reference
        id="0301"
        label="О создании героя"
        text="Порядок шагов — предложение из книги. Можно переходить между этапами и возвращаться к прежним решениям. Свободные удары и базовые действия добавляются автоматически."
      />
      <Button
        variant="ghost"
        onClick={createBlankCharacter}
        disabled={busy}
      >
        Создать пустой лист для ручного заполнения
      </Button>
    </>
  );
}
