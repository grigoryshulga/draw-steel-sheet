import { useLocale } from "../../../i18n/locale";
import { kitSlotSelection } from "../../../data/kits";
import { BuilderSelection } from "../BuilderSelection";
import { KitBonuses } from "../../KitBonuses";
import { validKitBonusPreferences } from "../../../lib/kit-bonuses";
import { useBuilderStep } from "../BuilderStepContext";

export function KitStep({ part }: { part: string }) {
  const { t: tr } = useLocale();
  const { draft, patch } = useBuilderStep();
  if (part === "bonuses")
    return (
      <KitBonuses loadout={{ ...draft, automation: draft }} level={1} onChange={patch} />
    );
  const secondary = part === "secondary";
  const selected = secondary ? draft.secondaryKit : draft.kit;
  const { kits, issue } = kitSlotSelection(draft, secondary);
  return (
    <>
      <BuilderSelection
        key={part}
        label={secondary ? tr("Второй комплект", "Second kit") : tr("Комплект", "Kit")}
        kind="kit"
        options={kits.map((kit) => {
          const disabled = Boolean(issue(kit));
          return {
            name: kit.name,
            originalName: kit.originalName,
            description: [kit.summary, kit.equipment].join("\n\n"),
            disabled,
            note: disabled ? tr("Уже выбран", "Already selected") : undefined,
          };
        })}
        selected={selected ? { name: selected } : null}
        changesFor={(name) => {
          const changes = secondary ? { secondaryKit: name } : { kit: name };
          return {
            ...changes,
            ...validKitBonusPreferences({ ...draft, ...changes, automation: draft }),
          };
        }}
      />
    </>
  );
}
