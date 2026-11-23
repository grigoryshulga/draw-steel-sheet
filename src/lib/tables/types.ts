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
  avatarUrl?: string;
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
export type MontageDifficulty = "easy" | "moderate" | "hard";
export type MontageResult = "success" | "partial" | "failure";
export type NegotiationTrait = { id: string; name: string; kind: "motivation" | "pitfall"; revealed: boolean; used?: boolean };
export type SceneChallenge =
  | { kind: "montage"; rounds: number; difficulty?: MontageDifficulty; acted?: string[];
      result?: MontageResult; hideLimits?: boolean; obstacles?: string; outcomes?: Partial<Record<MontageResult, string>> }
  | { kind: "negotiation"; npc?: string; impression?: number; traits: NegotiationTrait[];
      researched?: boolean; result?: "accepted" | "declined"; offers?: string[]; initialInterest?: number; initialPatience?: number };
export type CombatSide = "heroes" | "enemies";
export interface CombatHeroTurn {
  userId: string;
  heroId: string;
  round: number;
}
export interface TableCombat {
  id: string;
  sceneId: string;
  round: number;
  initiative: CombatSide;
  side: CombatSide | null;
  active: { id: string | null; side: CombatSide; heroId?: string } | null;
  heroTurns: CombatHeroTurn[];
  enemyTurns: string[];
}
export interface HeroTableCombat {
  tableId: string;
  userId: string;
  combat: TableCombat;
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
  challenge?: SceneChallenge;
  objective: string;
  layout?: SceneLayout;
}
export interface TableMaterial {
  id: string;
  title: string;
  text: string;
  public: boolean;
}
export interface BoardPoint {
  x: number;
  y: number;
}
export interface BoardGrid extends BoardPoint {
  enabled: boolean;
  size: number;
  color?: string;
  opacity?: number;
  thickness?: number;
}
export interface BoardItemSettings { width: number; height: number; snap: boolean; locked?: boolean }
export type BoardPlacement = BoardPoint & BoardItemSettings;
export interface BoardStroke {
  id: string;
  color: string;
  thickness: number;
  points: [x: number, y: number][];
}
export type BoardMaterial = BoardPoint & { id: string; title: string; settings?: BoardItemSettings } & (
  | { kind: "text"; text: string; markdown?: boolean }
  | { kind: "image"; assetId: string }
  | { kind: "counter"; value: number; max?: number }
);
export interface SceneLayout {
  tableId: string;
  background: string | null;
  grid: BoardGrid;
  materials: BoardMaterial[];
  strokes?: BoardStroke[];
}
export interface BoardCounter {
  id: string;
  name: string;
  value: number;
  max?: number;
  sceneId?: string;
  placement?: BoardPlacement;
}
export interface TableBoard {
  sceneId?: string;
  background: string | null;
  grid: BoardGrid;
  materials: BoardMaterial[];
  strokes?: BoardStroke[];
  counters: BoardCounter[];
  availableCounters?: BoardCounter[];
}
export interface BoardView extends BoardPoint {
  zoom: number;
}
export interface SharedBoardView extends BoardView {
  revision: number;
  control: string | null;
}
export type BoardViewCommand =
  | { type: "start"; control: string; expectedRevision: number; view: BoardView }
  | { type: "move"; control: string; sequence: number; view: BoardView }
  | { type: "stop"; control: string; view: BoardView };
export interface BoardRepository {
  readBoardView(id: string): Promise<SharedBoardView>;
  writeBoardView(id: string, command: BoardViewCommand): Promise<SharedBoardView>;
  subscribeBoardView(id: string, onChange: () => void): () => void;
  uploadBoardImage(id: string, assetId: string, image: Blob): Promise<void>;
  boardImageUrl(id: string, assetId: string): Promise<string>;
}
export interface TableEvent {
  id: string;
  at: string;
  actor: string;
  text: string;
  public: boolean;
  kind: string;
  editedAt?: string;
}
export interface TableCompanion {
  id: string;
  name: string;
  sourceId?: string;
  stamina: number;
  maxStamina: number;
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
  actorId?: string;
  archived: boolean;
  revision: number;
  memberCount: number;
  updatedAt: string;
}
export interface TableSnapshot extends TableSummary {
  combat?: TableCombat;
  board?: TableBoard;
  actorId: string;
  members: TableMember[];
  myHeroIds: string[];
  visibility: Record<string, HeroVisibility>;
  scenes: TableScene[];
  materials: TableMaterial[];
  events: TableEvent[];
  companions?: TableCompanion[];
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
  readHeroCombat(heroId: string): Promise<HeroTableCombat | null>;
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
