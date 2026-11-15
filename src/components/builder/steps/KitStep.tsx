import { availableKits, kitByName } from "../../../data/kits";
import { BuilderSelection } from "../BuilderSelection";
import { KitBonuses } from "../../KitBonuses";
import { validKitBonusPreferences } from "../../../lib/kit-bonuses";
import { useBuilderStep } from "../BuilderStepContext";

export function KitStep({ part }: { part: string }) {
  const { draft, patch } = useBuilderStep();
  if (part === "bonuses")
    return (
      <KitBonuses loadout={{ ...draft, automation: draft }} level={1} onChange={patch} />
    );
  const secondary = part === "secondary";
  const selected = secondary ? draft.secondaryKit : draft.kit;
  const otherKit = kitByName(secondary ? draft.kit : draft.secondaryKit);
  return (
    <>
      <BuilderSelection
        key={part}
        label={secondary ? "Второй комплект" : "Комплект"}
        kind="kit"
        options={availableKits(draft.className, draft.subclass).map((kit) => ({
          name: kit.name,
          description: [kit.summary, kit.equipment].join("\n\n"),
          disabled: kit.id === otherKit?.id,
          note:
            kit.id === otherKit?.id
              ? "Уже выбран"
              : undefined,
        }))}
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
