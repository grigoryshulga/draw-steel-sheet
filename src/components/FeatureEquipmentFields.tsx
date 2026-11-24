import { useLocale } from "../i18n/locale";
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
  const { t } = useLocale();
  const flags = {
    lightArmor: value?.lightArmor ?? false,
    lightWeapon: value?.lightWeapon ?? false,
  };

  return (
    <fieldset className="feature-equipment-fields">
      <legend>{t("Условное снаряжение", "Conditional equipment")}</legend>
      <label>
        <input
          type="checkbox"
          checked={flags.lightArmor}
          onChange={(event) =>
            onChange({ ...flags, lightArmor: event.currentTarget.checked })
          }
        />
        <span>{t("Ношу лёгкую броню", "Wearing light armor")}</span>
      </label>
      <label>
        <input
          type="checkbox"
          checked={flags.lightWeapon}
          onChange={(event) =>
            onChange({ ...flags, lightWeapon: event.currentTarget.checked })
          }
        />
        <span>{t("Использую лёгкое оружие", "Using a light weapon")}</span>
      </label>
      <p className="feature-equipment-note">
        {t("Эти отметки описывают реальное снаряжение.", "These selections describe your actual equipment.")} {hasKit
          ? t("Сейчас выбран комплект: условные бонусы класса недоступны.", "A kit is selected: conditional class bonuses are unavailable.")
          : t("При наличии любого комплекта условные бонусы класса недоступны.", "Conditional class bonuses are unavailable while any kit is selected.")}
      </p>
      {!automationEnabled && (
        <p className="feature-equipment-note">
          {t("Отметки сохраняются, но авторасчёт выключен и не изменит числовые значения.", "Selections are saved, but automatic calculation is off and will not change numeric values.")}
        </p>
      )}
    </fieldset>
  );
}
