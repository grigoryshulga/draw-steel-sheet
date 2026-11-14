import { useApp } from "../../state/AppContext";
import { NullPanels, TalentPanel } from "./class-mechanics/NullTalentPanels";
import {
  TroubadourPanel,
  ElementalistPanel,
} from "./class-mechanics/RoutinesMagicPanels";
import {
  CensorPanel,
  TacticianPanel,
  ConduitPanel,
} from "./class-mechanics/TargetsPrayerPanels";
import "./ClassMechanicsPanel.css";

/** Состояние класса следует за всем блоком ресурсов, а не вложено в счётчик. */
export function ClassMechanicsPanel() {
  const { character } = useApp();
  switch (character.className) {
    case "Нуль":
      return <NullPanels />;
    case "Талант":
      return <TalentPanel />;
    case "Трубадур":
      return <TroubadourPanel />;
    case "Элементалист":
      return <ElementalistPanel />;
    case "Цензор":
      return <CensorPanel />;
    case "Тактик":
      return <TacticianPanel />;
    case "Проводник":
      return <ConduitPanel />;
    default:
      return null;
  }
}
