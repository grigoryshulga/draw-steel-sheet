import { SiteLanguageSwitch } from "../components/LanguageSwitch";
import { useLocale } from "../i18n/locale";
import { lazy, Suspense, useEffect } from "react";
import { Icon } from "../components/Icons";
import { SiteLogo } from "../components/SiteLogo";
import { Button } from "../components/ui";
import {
  applyTheme,
  readThemeChoice,
  resolveTheme,
  THEMES,
} from "../lib/theme";
import { LoadingScreen } from "../components/Topbar";

const CodexView = lazy(() =>
  import("./CodexView").then((module) => ({ default: module.CodexView })),
);
const ReferenceView = lazy(() =>
  import("./ReferenceView").then((module) => ({
    default: module.ReferenceView,
  })),
);

/** Разделы, которые можно смотреть без входа: справочные, без данных героя. */
export const GUEST_TABS = ["codex", "reference", "catalog", "glossary"];

/** Режим «только чтение»: библиотека правил без аккаунта. */
export function GuestApp({
  tab,
  onSignIn,
}: {
  tab: string;
  onSignIn: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    const theme = resolveTheme(THEMES, readThemeChoice());
    if (theme) applyTheme(theme);
  }, []);

  return (
    <div className="app">
      <header className="rail">
        <div className="brand" title={t("Достать листы!", "Dostat Listy!")}>
          <SiteLogo variant="mark" />
        </div>
        <nav className="rail-nav" aria-label={t("Разделы", "Sections")}>
          <button
            type="button"
            className="rail-link is-active"
            aria-current="page"
          >
            <Icon name="library" />
            <span>{t("Кодекс", "Codex")}</span>
          </button>
        </nav>
        <div className="topbar-right">
          <SiteLanguageSwitch />
          <Button variant="soft" size="sm" icon="sheet" onClick={onSignIn}>
            {t("Войти", "Sign in")}
          </Button>
        </div>
      </header>
      <div className="main">
        <main className="content" id="main-content" tabIndex={-1}>
          <Suspense fallback={<LoadingScreen label={t("Загрузка библиотеки", "Loading the library")} />}>
            {tab === "codex" ? <CodexView /> : <ReferenceView />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
