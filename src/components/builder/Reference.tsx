import { RuleText } from "../RuleText";

export function Reference({
  id,
  text,
  label = "Текст из книги",
}: {
  id?: string;
  text: string;
  label?: string;
}) {
  return (
    <details className="builder-reference">
      <summary>{label}</summary>
      <RuleText text={text} />
      {id && (
        <a href={`#/codex/${id}`} target="_blank" rel="noreferrer">
          Открыть в Кодексе ↗
        </a>
      )}
    </details>
  );
}
