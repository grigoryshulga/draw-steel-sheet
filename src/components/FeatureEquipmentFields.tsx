import type { FeatureEquipmentFlags } from "../types";
import "./FeatureEquipmentFields.css";

export function FeatureEquipmentFields({
  value,
  onChange,
  hasKit,
  automationEnabled = true,
}: {
  value?: FeatureEquipmentFlags;
  onChange: (next: FeatureEquipmentFlags) => void;
  hasKit: boolean;
  automationEnabled?: boolean;
}) {
  const flags = {
    lightArmor: value?.lightArmor ?? false,
    lightWeapon: value?.lightWeapon ?? false,
  };

  return (
    <fieldset className="feature-equipment-fields">
      <legend>Условное снаряжение</legend>
      <label>
        <input
          type="checkbox"
          checked={flags.lightArmor}
          onChange={(event) =>
            onChange({ ...flags, lightArmor: event.currentTarget.checked })
          }
        />
        <span>Ношу лёгкую броню</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={flags.lightWeapon}
          onChange={(event) =>
            onChange({ ...flags, lightWeapon: event.currentTarget.checked })
          }
        />
        <span>Использую лёгкое оружие</span>
      </label>
      <p className="feature-equipment-note">
        Эти отметки описывают реальное снаряжение. {hasKit
          ? "Сейчас выбран комплект: условные бонусы класса недоступны."
          : "При наличии любого комплекта условные бонусы класса недоступны."}
      </p>
      {!automationEnabled && (
        <p className="feature-equipment-note">
          Отметки сохраняются, но авторасчёт выключен и не изменит числовые значения.
        </p>
      )}
    </fieldset>
  );
}
