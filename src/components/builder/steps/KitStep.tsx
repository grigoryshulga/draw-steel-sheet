import { availableKits } from "../../../data/kits";
import { BuilderSelection } from "../BuilderSelection";
import { Field, Select } from "../../ui";
import { useBuilderStep } from "../BuilderStepContext";

export function KitStep({ part }: { part: string }) {
  const { draft, patch } = useBuilderStep();
  if (part === "bonuses")
    return (
      <>
        {(["meleeDamageKit", "rangedDamageKit"] as const).map((key, i) => (
          <Field
            key={key}
            label={`Бонус к урону ${i === 0 ? "ближнего" : "дальнего"} боя`}
          >
            <Select
              value={draft[key] || draft.kit}
              onChange={(e) => patch({ [key]: e.target.value })}
            >
              {[draft.kit, draft.secondaryKit].filter(Boolean).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </Field>
        ))}
      </>
    );
  const secondary = part === "secondary";
  const selected = secondary ? draft.secondaryKit : draft.kit;
  return (
    <>
      <BuilderSelection
        key={part}
        label={secondary ? "Второй комплект" : "Комплект"}
        kind="kit"
        options={availableKits(draft.className, draft.subclass).map((kit) => ({
          name: kit.name,
          description: [kit.summary, kit.equipment].join("\n\n"),
          disabled: kit.name === (secondary ? draft.kit : draft.secondaryKit),
          note:
            kit.name === (secondary ? draft.kit : draft.secondaryKit)
              ? "Уже выбран"
              : undefined,
        }))}
        selected={selected ? { name: selected } : null}
        changesFor={(name) => ({
          ...(secondary ? { secondaryKit: name } : { kit: name }),
          meleeDamageKit: "",
          rangedDamageKit: "",
        })}
      />
    </>
  );
}
