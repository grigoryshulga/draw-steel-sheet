import type { Character } from "../types";
import type { ActionPreview } from "./game-actions";
import {
  normalizeNullState,
  normalizeTalentState,
  previewNullTalent,
  transitionNullTalent,
  type NullState,
  type TalentState,
  type NullTalentAction,
} from "./class-mechanics/null-talent";
import {
  normalizeTroubadourState,
  normalizeElementalistState,
  previewRoutinesMagic,
  transitionRoutinesMagic,
  type TroubadourState,
  type ElementalistState,
  type RoutinesMagicAction,
} from "./class-mechanics/routines-magic";
import {
  normalizeCensorState,
  normalizeTacticianState,
  normalizeConduitState,
  previewTargetsPrayer,
  transitionTargetsPrayer,
  type CensorState,
  type TacticianState,
  type ConduitState,
  type TargetsPrayerAction,
} from "./class-mechanics/targets-prayer";

export interface ClassMechanicsState {
  null?: NullState;
  talent?: TalentState;
  troubadour?: TroubadourState;
  elementalist?: ElementalistState;
  censor?: CensorState;
  tactician?: TacticianState;
  conduit?: ConduitState;
}
export type ClassMechanicAction =
  NullTalentAction | RoutinesMagicAction | TargetsPrayerAction;
export type ClassMechanicsEvent =
  | "turn-start"
  | "turn-end"
  | "combat-start"
  | "combat-end"
  | "rest"
  | "resource-change";

export function normalizeClassMechanics(value: unknown): ClassMechanicsState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    ...(raw.null !== undefined ? { null: normalizeNullState(raw.null) } : {}),
    ...(raw.talent !== undefined
      ? { talent: normalizeTalentState(raw.talent) }
      : {}),
    ...(raw.troubadour !== undefined
      ? { troubadour: normalizeTroubadourState(raw.troubadour) }
      : {}),
    ...(raw.elementalist !== undefined
      ? { elementalist: normalizeElementalistState(raw.elementalist) }
      : {}),
    ...(raw.censor !== undefined
      ? { censor: normalizeCensorState(raw.censor) }
      : {}),
    ...(raw.tactician !== undefined
      ? { tactician: normalizeTacticianState(raw.tactician) }
      : {}),
    ...(raw.conduit !== undefined
      ? { conduit: normalizeConduitState(raw.conduit) }
      : {}),
  };
}
export function previewClassMechanic(
  character: Character,
  action: ClassMechanicAction,
): ActionPreview {
  if (action.kind.startsWith("null-") || action.kind.startsWith("talent-"))
    return previewNullTalent(character, action as NullTalentAction);
  if (
    action.kind.startsWith("troubadour-") ||
    action.kind.startsWith("elementalist-")
  )
    return previewRoutinesMagic(character, action as RoutinesMagicAction);
  return previewTargetsPrayer(character, action as TargetsPrayerAction);
}
export function transitionClassMechanics(
  character: Character,
  event: ClassMechanicsEvent,
): Character {
  return transitionTargetsPrayer(
    transitionRoutinesMagic(transitionNullTalent(character, event), event),
    event,
  );
}
