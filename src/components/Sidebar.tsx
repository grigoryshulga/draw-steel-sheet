import { useState } from "react";
import { NAV_ITEMS, type Tab } from "../navigation";
import { Icon } from "./Icons";
import { SiteLogo } from "./SiteLogo";
import { Modal } from "./ui";
import "./Sidebar.css";

const MOBILE_TABS: Tab[] = ["sheet", "abilities", "codex"];
const MORE_TABS: Tab[] = ["hero", "inventory", "notes", "settings"];

export function Sidebar({
  tab,
  onNavigate,
  onOpenRoll,
  rollDisabled = false,
}: {
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  onOpenRoll: () => void;
  rollDisabled?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const hiddenTabIsActive = MORE_TABS.includes(tab);

  const navigateFromMore = (nextTab: Tab) => {
    onNavigate(nextTab);
    setMoreOpen(false);
  };

  return (
    <aside className="rail">
      <div className="brand" title="Достать листы!">
        <SiteLogo variant="mark" />
      </div>

      <nav className="rail-nav rail-nav-desktop" aria-label="Разделы листа">
        {NAV_ITEMS.map((item) => {
          const label = item.id === "settings" ? "Настройки" : item.label;
          return (
            <button
              key={item.id}
              type="button"
              className={`rail-link ${tab === item.id ? "is-active" : ""}`.trim()}
              onClick={() => onNavigate(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              title={label}
            >
              <Icon name={item.icon} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="rail-link rail-roll"
          onClick={onOpenRoll}
          disabled={rollDisabled}
          title={rollDisabled ? "Сначала создайте героя" : "Бросок силы"}
        >
          <Icon name="dice" />
          <span>Бросок</span>
        </button>
      </nav>

      <nav className="rail-nav rail-nav-mobile" aria-label="Основные разделы">
        {MOBILE_TABS.map((id) => {
          const item = NAV_ITEMS.find((navItem) => navItem.id === id)!;
          const visibleLabel = id === "abilities" ? "Способн." : item.label;
          return (
            <button
              key={id}
              type="button"
              className={`rail-link ${tab === id ? "is-active" : ""}`.trim()}
              onClick={() => onNavigate(id)}
              aria-current={tab === id ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span aria-hidden="true">{visibleLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="rail-link rail-roll"
          onClick={onOpenRoll}
          disabled={rollDisabled}
          title={rollDisabled ? "Сначала создайте героя" : "Бросок силы"}
          aria-label="Бросок"
        >
          <Icon name="dice" />
          <span aria-hidden="true">Бросок</span>
        </button>
        <button
          type="button"
          className={`rail-link rail-more ${hiddenTabIsActive ? "is-active" : ""}`.trim()}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-label="Ещё разделы"
          title="Ещё"
        >
          <Icon name="settings" />
          <span aria-hidden="true">Ещё</span>
        </button>
      </nav>

      <div className="rail-spacer" />

      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Ещё"
        className="sidebar-more-modal"
      >
        <nav className="sidebar-more-list" aria-label="Дополнительные разделы">
          {MORE_TABS.map((id) => {
            const item = NAV_ITEMS.find((navItem) => navItem.id === id)!;
            return (
              <button
                key={id}
                type="button"
                className={`sidebar-more-item ${tab === id ? "is-active" : ""}`.trim()}
                onClick={() => navigateFromMore(id)}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.id === "settings" ? "Настройки" : item.label}</span>
              </button>
            );
          })}
        </nav>
      </Modal>
    </aside>
  );
}
