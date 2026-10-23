import { Icon } from "./Icons";
import "./LibraryHeader.css";

const SECTIONS = [
  { id: "codex", label: "Кодекс", href: "#/codex/" },
  { id: "catalog", label: "Каталоги", href: "#/catalog/treasure" },
  { id: "glossary", label: "Глоссарий", href: "#/glossary/" },
] as const;

export type LibrarySection = (typeof SECTIONS)[number]["id"];

/** Общая шапка Кодекса, Каталогов и Глоссария: заголовок, описание и слайдер-переключатель разделов. */
export function LibraryHeader({
  current,
  description,
}: {
  current: LibrarySection;
  description: string;
}) {
  const index = SECTIONS.findIndex((section) => section.id === current);
  return (
    <header className="library-head">
      <div className="library-head-text">
        <h1 className="page-title">
          <Icon name="book" size={26} />
          Библиотека
        </h1>
        <p className="muted">{description}</p>
      </div>
      <nav
        className="library-switch"
        aria-label="Раздел библиотеки"
        style={{ "--index": index } as React.CSSProperties}
      >
        <span className="library-switch-thumb" aria-hidden="true" />
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={section.href}
            aria-current={section.id === current ? "page" : undefined}
          >
            {section.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
