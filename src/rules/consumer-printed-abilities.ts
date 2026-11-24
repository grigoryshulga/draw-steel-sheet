import cards from "../generated/consumers/ability-cards-en.json";
import type { PrintedAbility } from "./printed-ability";

export const printedAbilities: Readonly<Record<string, PrintedAbility>> = cards as Record<string, PrintedAbility>;
