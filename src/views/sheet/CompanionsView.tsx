import { EmptyState, Panel } from "../../components/ui";

/** Спутники и союзники героя: раздел пока пустой, но уже часть листа. */
export function CompanionsView() {
  return (
    <div className="companions-view">
      <Panel title="Спутники" icon="users">
        <EmptyState
          icon="users"
          title="Спутников пока нет"
          text="Здесь появятся союзники, питомцы и наёмники героя."
        />
      </Panel>
    </div>
  );
}
