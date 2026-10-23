import { useRef, useState } from "react";
import { Button, Field, Modal, NumberInput, Select } from "../../components/ui";
import { makeId } from "../../data/templates";
import type { HealthOperation } from "../../lib/game-actions";
import { previewGameAction } from "../../lib/game-actions";
import { useApp } from "../../state/AppContext";
import "./HealthDialog.css";

const operationLabels: Record<HealthOperation, string> = {
  damage: "Урон",
  heal: "Исцеление",
  temporary: "Временная выносливость",
  recovery: "Передышка",
  rest: "Отдых",
  adjust: "Исправить значение",
};

export function HealthDialog({
  initialOperation,
  onClose,
}: {
  initialOperation?: HealthOperation;
  onClose: () => void;
}) {
  const { character, performGameAction } = useApp();
  const [kind, setKind] = useState<HealthOperation>(
    initialOperation ?? "damage",
  );
  const [amount, setAmount] = useState(
    initialOperation === "adjust" ? character.stamina.current : 0,
  );
  const operationId = useRef<string | null>(null);
  const action =
    kind === "rest" || kind === "recovery"
      ? ({ kind } as const)
      : ({ kind, amount } as const);
  const preview = previewGameAction(character, action);
  const amountLabel =
    kind === "damage"
      ? "Количество урона"
      : kind === "heal"
        ? "Количество исцеления"
        : kind === "temporary"
          ? "Количество временной выносливости"
          : "Текущее значение выносливости";
  const confirm = () => {
    if (!preview.ok) return;
    operationId.current ??= makeId();
    if (performGameAction(action, operationId.current)) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Изменить здоровье"
      className="health-dialog"
    >
      <div className="health-dialog-content">
        <label className="field">
          <span className="field-label">Действие</span>
          <Select
            value={kind}
            onChange={(event) => {
              const next = event.target.value as HealthOperation;
              setKind(next);
              setAmount(next === "adjust" ? character.stamina.current : 0);
            }}
          >
            {(Object.keys(operationLabels) as HealthOperation[]).map(
              (operation) => (
                <option key={operation} value={operation}>
                  {operationLabels[operation]}
                </option>
              ),
            )}
          </Select>
        </label>
        {kind !== "rest" && kind !== "recovery" && (
          <Field label={amountLabel}>
            <NumberInput
              value={amount}
              min={kind === "adjust" ? -9999 : 0}
              max={kind === "adjust" ? character.stamina.max : 9999}
              label={amountLabel}
              onChange={setAmount}
            />
          </Field>
        )}
        {kind === "temporary" && (
          <p className="health-dialog-hint">
            Временный запас заменяется большим значением и не складывается с
            текущим.
          </p>
        )}
        <section
          className={`health-preview ${preview.ok ? "is-valid" : amount ? "is-invalid" : ""}`}
          aria-live="polite"
        >
          <span className="eyebrow">Предпросмотр</span>
          <p>{preview.ok ? preview.detail : preview.reason}</p>
        </section>
        <div className="health-dialog-actions">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!preview.ok}>
            Подтвердить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
