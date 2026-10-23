import { NAV_ITEMS, type Tab } from "../navigation";
import { Icon } from "./Icons";
import { SiteLogo } from "./SiteLogo";

/** Каталоги и глоссарий живут внутри «Кодекса» и подсвечивают его пункт. */
const LIBRARY_TABS: Tab[] = ["codex", "catalog", "glossary"];
/** Редактор героя открывается с листа и подсвечивает «Лист». */
const isActive = (tab: Tab, id: Tab) =>
  tab === id ||
  (id === "codex" && LIBRARY_TABS.includes(tab)) ||
  (id === "sheet" && tab === "hero");

/** Логотип и разделы — общий кусок шапки. */
export function RailNav({
  tab,
  onNavigate,
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <>
      <div className="brand" title="Достать листы!">
        <SiteLogo variant="mark" />
      </div>
      <nav className="rail-nav" aria-label="Разделы листа">
        {NAV_ITEMS.map((item) => {
          const active = isActive(tab, item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`rail-link ${active ? "is-active" : ""}`.trim()}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

/** Шапка без героя (экран приветствия, библиотека): только навигация. */
export function Sidebar(props: { tab: Tab; onNavigate: (tab: Tab) => void }) {
  return (
    <header className="rail">
      <RailNav {...props} />
    </header>
  );
}
