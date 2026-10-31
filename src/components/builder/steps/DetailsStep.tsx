import { BUILDER_DATA as data } from "../../../lib/character-builder";
import { RuleText } from "../../RuleText";
import { Field, Select, TextArea, TextInput } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function DetailsStep() {
  const { draft, patch } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Добавьте характер, связи и, если хотите, нюанс. Эти решения
        делают героя вашим.
      </p>
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
            data.complications.find(
              (c) => c.name === draft.complication,
            )?.text || ""
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
      <Field label="Связи с другими героями">
        <TextArea
          value={draft.connections}
          onChange={(e) => patch({ connections: e.target.value })}
          rows={3}
        />
      </Field>
    </>
  );
}
