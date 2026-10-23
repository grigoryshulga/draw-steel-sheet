import { NAV_ITEMS, type Tab } from "../navigation";
import { Icon } from "./Icons";

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
  return (
    <aside className="rail">
      <div className="brand" title="Стальной лист">
        <Icon name="sword" size={25} />
      </div>

      <nav className="rail-nav" aria-label="Разделы листа">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail-link ${tab === item.id ? "is-active" : ""}`.trim()}
            onClick={() => onNavigate(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            title={item.label}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
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

      <div className="rail-spacer" />

    </aside>
  );
}
