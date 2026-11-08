import type { Character, InventoryItem } from "../../types";

/** Network contracts. Public snapshots must omit secrets, not merely hide them. */
export type TableSection =
  "hero" | "development" | "inventory" | "journal" | "companions";
export interface HeroVisibility {
  sections: TableSection[];
  notes: string[];
}
export interface SharedHero {
  id: string;
  name: string;
  ancestry: string;
  className: string;
  level: number;
  stamina: Character["stamina"];
  resources: {
    heroicResource: Character["heroicResource"];
    surges: number;
    heroTokens: number;
    recoveries: Character["recoveries"];
    additional: Record<string, number>;
  };
  conditions: Character["conditions"];
  updatedAt: string;
  sections: Partial<Record<TableSection, unknown>>;
  notes: Record<string, string>;
}
export interface TableMember {
  userId: string;
  name: string;
  role: "director" | "player";
  hero: SharedHero | null;
}
export interface SceneCondition {
  id: string;
  name: string;
  public: boolean;
  ends: string;
}
export interface SceneCombatant {
  id: string;
  sourceId?: string;
  name: string;
  group: string;
  organization: string;
  captainId?: string;
  faction: "enemy" | "ally";
  revealed: boolean;
  turn: "ready" | "active" | "done";
  reactionUsed: boolean;
  conditions: SceneCondition[];
  health: "healthy" | "hurt" | "winded" | "defeated";
  /** Director only: these properties must be absent in player responses. */
  stamina?: number;
  maxStamina?: number;
  temporaryStamina?: number;
  count?: number;
  encounterValue?: number;
  notes?: string;
}
export interface SceneCounter {
  id: string;
  name: string;
  value: number;
  max?: number;
  public: boolean;
}
export interface TableScene {
  id: string;
  name: string;
  kind: "encounter" | "negotiation" | "montage";
  status: "prepared" | "active" | "finished";
  published: boolean;
  description: string;
  directorNotes?: string;
  round: number;
  initiative: "heroes" | "enemies";
  malice?: number;
  combatants: SceneCombatant[];
  counters: SceneCounter[];
  objective: string;
}
export interface TableMaterial {
  id: string;
  title: string;
  text: string;
  public: boolean;
}
export interface TableEvent {
  id: string;
  at: string;
  actor: string;
  text: string;
  public: boolean;
  kind: string;
}
export interface ItemOffer {
  id: string;
  fromUserId: string;
  heroId: string;
  toUserId: string;
  item: InventoryItem;
  status: "pending" | "accepted" | "declined" | "revoked";
  templateId?: string;
  version: number;
}
export interface ItemTrade {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromHeroId: string;
  toHeroId: string;
  offered: { itemId: string; qty: number; item?: InventoryItem }[];
  requested: { itemId: string; qty: number; item?: InventoryItem }[];
  confirmations: string[];
  status: "pending" | "accepted" | "cancelled";
}
export interface TableSummary {
  id: string;
  name: string;
  ownerId: string;
  archived: boolean;
  revision: number;
  memberCount: number;
  updatedAt: string;
}
export interface TableSnapshot extends TableSummary {
  actorId: string;
  members: TableMember[];
  myHeroIds: string[];
  visibility: Record<string, HeroVisibility>;
  scenes: TableScene[];
  materials: TableMaterial[];
  events: TableEvent[];
  offers: ItemOffer[];
  trades: ItemTrade[];
  inviteCode?: string;
  transferTo?: string;
}
export interface DirectorTemplate {
  id: string;
  name: string;
  kind: "scene" | "item";
  scene?: TableScene;
  item?: InventoryItem;
  version: number;
}
export interface TableCommand {
  type: string;
  payload: Record<string, unknown>;
  operationId: string;
  expectedRevision?: number;
}
export interface TableRepository {
  list(): Promise<TableSummary[]>;
  read(id: string): Promise<TableSnapshot>;
  command(
    id: string | null,
    command: TableCommand,
  ): Promise<TableSnapshot | null>;
  templates(): Promise<DirectorTemplate[]>;
  saveTemplate(template: DirectorTemplate): Promise<DirectorTemplate>;
  deleteTemplate(id: string): Promise<void>;
  subscribe(
    id: string,
    onChange: () => void,
    onStatus?: (connected: boolean) => void,
  ): () => void;
}
