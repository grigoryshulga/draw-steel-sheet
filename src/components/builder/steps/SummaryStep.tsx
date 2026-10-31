import { BUILDER_STEPS } from "../../../lib/builder-steps";
import { useBuilderStep } from "../BuilderStepContext";

const STEPS = BUILDER_STEPS;

export function SummaryStep() {
  const { issues, go } = useBuilderStep();

  return (
    <>
      <p className="builder-intro">
        Проверьте выборы. После создания все разделы листа можно
        редактировать.
      </p>
      <div className="builder-review">
        {STEPS.filter(({ id }) => id !== "summary").map(({ id, label }) => (
          <button type="button" onClick={() => go(id)} key={id}>
            <span>
              {issues[id] ? "○" : "✓"} {label}
            </span>
            <span className="muted small">
              {issues[id] || "Заполнено"} →
            </span>
          </button>
        ))}
      </div>
      <div className="builder-notice">
        <strong>Проверьте особенности своего класса</strong>
        <p>
          Подклассы, домены, эффекты нюансов и ситуационные черты
          сохраняются текстом. Их особые условия и бонусы нужно
          применять по книге. Постоянные поправки можно внести в лист —
          авторасчёт их запомнит.
        </p>
      </div>
      <p className="muted small">
        Автоматически: выносливость и восстановления класса, бонусы
        комплектов, числовые черты происхождения, урон оружия,
        дистанции, значение восстановления, потенциал и пороги тиров.
      </p>
    </>
  );
}
