import "./LibraryNav.css";
import { useLocale } from "../i18n/locale";
export function LibraryNav({
  current,
}: {
  current: "codex" | "catalog" | "glossary";
}) {
  const { t } = useLocale();
  return (
    <nav className="library-nav" aria-label={t("Библиотека", "Library")}>
      <a
        href="#/codex/"
        aria-current={current === "codex" ? "page" : undefined}
      >
        {t("Кодекс", "Codex")}
      </a>
      <a
        href="#/catalog/treasure"
        aria-current={current === "catalog" ? "page" : undefined}
      >
        {t("Каталоги", "Catalogs")}
      </a>
      <a
        href="#/glossary/"
        aria-current={current === "glossary" ? "page" : undefined}
      >
        {t("Глоссарий", "Glossary")}
      </a>
    </nav>
  );
}
