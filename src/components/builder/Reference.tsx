import { useState } from "react";
import { RuleText } from "../RuleText";
import { RuleArticleReader } from "../rules/RuleArticleReader";

export function Reference({
  id,
  text,
  label = "Текст из книги",
}: {
  id?: string;
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="builder-reference"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{label}</summary>
      {open &&
        (id ? <RuleArticleReader articleId={id} /> : <RuleText text={text} />)}
    </details>
  );
}
