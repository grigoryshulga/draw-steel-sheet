import { useLocale } from "../../i18n/locale";
import { Icon } from "../../components/Icons";
import { EmptyState, Panel } from "../../components/ui";

/** Спутники и союзники героя: раздел пока пустой, но уже часть листа. */
export function CompanionsView() {
  const { t } = useLocale();
  return (
    <div className="companions-view">
      <Panel title={t("Спутники", "Companions")} icon="users">
        <EmptyState
          icon="users"
          title={t("Ведение спутников пока недоступно", "Companion tracking is not available yet")}
          text={t("Пока характеристики союзников можно посмотреть в справочнике помощников.", "You can find ally statistics in the retainers catalog.")}
        />
        <a href="#/catalog/retainers">{t("Открыть помощников", "Open retainers")} <Icon name="arrow-right" size={16} /></a>
      </Panel>
    </div>
  );
}
