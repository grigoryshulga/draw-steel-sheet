import { Panel } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import {
  classFeatureChoicesForSheet,
  classFeatureGroupsForSheet,
} from "../../lib/class-feature-view";
import {
  ClassFeatureMechanicsPanel,
  RoundEncounterControls,
} from "../sheet/ClassFeaturesPanel";

/**
 * Раздел «Особенности класса»: новый реестр — единственный источник правил и
 * чисел. Старый реестр выбора удалён; сохранённые значения читаются механиками.
 */
export function ClassFeaturesPanel() {
  const { character } = useApp();
  const hasMechanics =
    classFeatureGroupsForSheet(character).some((group) =>
      group.features.some((item) => !item.passive),
    ) || classFeatureChoicesForSheet(character).length > 0;

  if (!hasMechanics) return null;

  return (
    <Panel
      title="Особенности класса"
      icon="spark"
      dense
      actions={<RoundEncounterControls />}
    >
      <ClassFeatureMechanicsPanel />
    </Panel>
  );
}
