import { useLocale } from "../../i18n/locale";
import { useRef, useState, type ReactNode } from "react";
import { RuleText } from "../../components/RuleText";
import { Button, TextArea, TextInput } from "../../components/ui";

function HeroProfileBlock({
  title,
  children,
}: {
  title: string;
  children: (editing: boolean) => ReactNode;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const finish = () => {
    setEditing(false);
    heading.current?.querySelector("button")?.focus();
  };

  return (
    <section
      className={`hero-profile-block${editing ? " is-editing" : ""}`}
      onKeyDown={(event) => {
        if (editing && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          finish();
        }
      }}
    >
      <header className="hero-profile-heading" ref={heading}>
        <h4>{title}</h4>
        <Button
          size="sm"
          variant={editing ? "soft" : "ghost"}
          icon={editing ? "check" : "edit"}
          iconOnly
          className="hero-profile-edit"
          onClick={editing ? finish : () => setEditing(true)}
        >
          {editing ? t(`Завершить редактирование: ${title}`, `Finish editing: ${title}`) : t(`Редактировать: ${title}`, `Edit: ${title}`)}
        </Button>
      </header>
      {children(editing)}
    </section>
  );
}

export function HeroProfileText({
  title,
  value,
  placeholder,
  multiline = false,
  onChange,
}: {
  title: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <HeroProfileBlock title={title}>
      {(editing) => {
        if (!editing) {
          if (!value.trim()) return <p className="hero-profile-value muted">{t("Не указано", "Not specified")}</p>;
          return multiline ? <RuleText text={value} /> : <p className="hero-profile-value">{value}</p>;
        }

        const input = {
          value,
          placeholder,
          autoFocus: true,
          "aria-label": title,
        };
        return multiline ? (
          <TextArea {...input} rows={4} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <TextInput {...input} onChange={(event) => onChange(event.target.value)} />
        );
      }}
    </HeroProfileBlock>
  );
}
