import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { RuleText } from "../../RuleText";
import { Button, Field, Select, TextArea, TextInput } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function DetailsStep() {
  const { draft, patch, createBlankCharacter, busy } = useBuilderStep();

  return (
    <>
      <Field label="Имя героя">
        <TextInput
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Как зовут вашего героя?"
        />
      </Field>
      <Field label="Замысел (необязательно)">
        <TextArea
          value={draft.concept}
          onChange={(e) => patch({ concept: e.target.value })}
          rows={3}
          placeholder="Кем вы хотите быть?"
        />
      </Field>
      <Field label="Нюанс (необязательно)">
        <Select
          value={draft.complication}
          onChange={(e) => patch({ complication: e.target.value })}
        >
          <option value="">Без нюанса</option>
          {data.complications.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </Select>
      </Field>
      {draft.complication && (
        <RuleText
          text={
            data.complications.find((c) => c.name === draft.complication)
              ?.text || ""
          }
        />
      )}
      <Field label="Языки культуры и карьеры (через запятую)">
        <TextInput
          value={draft.languages}
          onChange={(e) => patch({ languages: e.target.value })}
        />
      </Field>
      <Field label="Внешность, характер, цели">
        <TextArea
          value={draft.details}
          onChange={(e) => patch({ details: e.target.value })}
          rows={4}
        />
      </Field>
      <Field label="Заметки об особенностях (необязательно)">
        <TextArea
          value={draft.features}
          onChange={(e) => patch({ features: e.target.value })}
          rows={3}
          placeholder="Особые условия и решения по правилам"
        />
      </Field>
      <Field label="Связи с другими героями">
        <TextArea
          value={draft.connections}
          onChange={(e) => patch({ connections: e.target.value })}
          rows={3}
        />
      </Field>
      <section className="builder-reference">
        <h3>Заполнить лист вручную</h3>
        <p>Будет создан пустой лист с указанным именем.</p>
        <Button onClick={createBlankCharacter} disabled={busy}>
          Создать пустой лист
        </Button>
      </section>
    </>
  );
}
