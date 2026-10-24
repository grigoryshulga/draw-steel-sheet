import { Panel } from "../../components/ui";
import { HelpTooltip } from "../../components/HelpTooltip";
import { useApp } from "../../state/AppContext";
import "./PotencyPanel.css";

/** Пороги потенциала способностей от высочайшей характеристики. */
export function PotencyPanel() {
  const { derived } = useApp();
  const { potency, highestCharacteristic } = derived;

  return (
    <Panel
      title="Потенциал"
      icon="spark"
      className="potency-panel"
      dense
      actions={
        <HelpTooltip label="Расчёт и применение потенциала">
          <strong>Потенциал</strong>
          <p>Наивысшая характеристика: {highestCharacteristic}.</p>
          <ul>
            <li>Слабый: {highestCharacteristic} − 2 = {potency.weak}.</li>
            <li>Средний: {highestCharacteristic} − 1 = {potency.average}.</li>
            <li>Сильный: {potency.strong}.</li>
          </ul>
          <p>
            Эффект с потенциалом применяется, только если характеристика цели
            строго ниже порога. Равенство не подходит. «М &lt; СЛАБЫЙ» означает,
            что Мощь цели ниже слабого порога.
          </p>
        </HelpTooltip>
      }
    >
      <dl className="potency-values" aria-label="Пороги потенциала">
        <div className="potency-tile">
          <dt>Слабый</dt>
          <dd>{potency.weak}</dd>
        </div>
        <div className="potency-tile">
          <dt>Средний</dt>
          <dd>{potency.average}</dd>
        </div>
        <div className="potency-tile potency-tile-strong">
          <dt>Сильный</dt>
          <dd>{potency.strong}</dd>
        </div>
      </dl>

    </Panel>
  );
}
