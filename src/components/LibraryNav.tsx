import "./LibraryNav.css";
export function LibraryNav({
  current,
}: {
  current: "codex" | "catalog" | "glossary";
}) {
  return (
    <nav className="library-nav" aria-label="Библиотека">
      <a
        href="#/codex/"
        aria-current={current === "codex" ? "page" : undefined}
      >
        Кодекс
      </a>
      <a
        href="#/catalog/treasure"
        aria-current={current === "catalog" ? "page" : undefined}
      >
        Каталоги
      </a>
      <a
        href="#/glossary/"
        aria-current={current === "glossary" ? "page" : undefined}
      >
        Глоссарий
      </a>
    </nav>
  );
}
