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
  return (
    <section
      className="builder-reference"
    >
      <h3>{label}</h3>
      {id ? <RuleArticleReader articleId={id} /> : <RuleText text={text} />}
    </section>
  );
}
