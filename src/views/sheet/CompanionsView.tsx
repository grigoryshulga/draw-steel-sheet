import { Icon } from "../../components/Icons";
import { EmptyState, Panel } from "../../components/ui";

/** Спутники и союзники героя: раздел пока пустой, но уже часть листа. */
export function CompanionsView() {
  return (
    <div className="companions-view">
      <Panel title="Спутники" icon="users">
        <EmptyState
          icon="users"
          title="Ведение спутников пока недоступно"
          text="Пока характеристики союзников можно посмотреть в справочнике помощников."
        />
        <a href="#/catalog/retainers">Открыть помощников <Icon name="arrow-right" size={16} /></a>
      </Panel>
    </div>
  );
}
