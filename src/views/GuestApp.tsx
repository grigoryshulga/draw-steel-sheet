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
const CatalogView = lazy(() =>
  import("./CatalogView").then((module) => ({ default: module.CatalogView })),
);
const GlossaryView = lazy(() =>
  import("./GlossaryView").then((module) => ({ default: module.GlossaryView })),
);

/** Разделы, которые можно смотреть без входа: справочные, без данных героя. */
export const GUEST_TABS = ["codex", "catalog", "glossary"];

/** Режим «только чтение»: библиотека правил без аккаунта. */
export function GuestApp({
  tab,
  onSignIn,
}: {
  tab: string;
  onSignIn: () => void;
}) {
  useEffect(() => {
    const theme = resolveTheme(THEMES, readThemeChoice());
    if (theme) applyTheme(theme);
  }, []);

  return (
    <div className="app">
      <header className="rail">
        <div className="brand" title="Достать листы!">
          <SiteLogo variant="mark" />
        </div>
        <nav className="rail-nav" aria-label="Разделы">
          <button
            type="button"
            className="rail-link is-active"
            aria-current="page"
          >
            <Icon name="library" />
            <span>Кодекс</span>
          </button>
        </nav>
        <div className="topbar-right">
          <Button variant="soft" size="sm" icon="sheet" onClick={onSignIn}>
            Войти
          </Button>
        </div>
      </header>
      <div className="main">
        <main className="content" id="main-content" tabIndex={-1}>
          <Suspense fallback={<LoadingScreen label="Загрузка библиотеки" />}>
            {tab === "catalog" ? (
              <CatalogView />
            ) : tab === "glossary" ? (
              <GlossaryView />
            ) : (
              <CodexView />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
