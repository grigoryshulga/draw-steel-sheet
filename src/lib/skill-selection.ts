import { ALL_CREATION_SKILLS, type SkillSlot } from "../data/creation-rules";
import { SKILL_GROUPS } from "../data/skills";

/**
 * Matching engine for the hero-creation skill choices.
 *
 * The draft stores one assigned skill per slot (heterogeneous slots: fixed
 * mandatory skills, whole groups, mixed lists). The player actually picks a
 * SET of skills, so the canonical assignment must be recomputed as a maximum
 * bipartite matching instead of the old greedy per-slot fill. Greedy filling
 * either rejects legal sets or forces the player to pick in a specific order.
 */
export interface SkillRequirement {
  label: string;
  required: number;
  selected: number;
}

export interface SkillSelectionState {
  /** Canonical per-slot assignment: one skill per slot, unresolved slots are "". */
  values: string[];
  /** Manual flexible skills covered by the matching, in slot order. */
  selected: string[];
  /** Locked fixed-only skills granted automatically. */
  automatic: string[];
  /** Skills earned by earlier sources; they can never be picked twice. */
  known: string[];
  required: number;
  remaining: number;
  complete: boolean;
  /** Every eligible flexible option, excluding known and automatic skills. */
  available: string[];
  /** Candidates that keep a legal matching when added to the current selection. */
  selectable: string[];
  /** Raw values that were dropped because they cannot form a legal selection. */
  invalid: string[];
  requirements: SkillRequirement[];
}

/** Case and ё insensitive key for skill identity; catalog spelling is preserved. */
function skillKey(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function isSkillName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Human-readable marker for a malformed draft entry. Stored drafts come from
 * localStorage, so a hand-edited or corrupted value can be any JSON shape; it is
 * reported instead of throwing while the wizard renders.
 */
function describeRawValue(raw: unknown): string {
  try {
    if (typeof raw === "string") return raw;
    if (raw === undefined) return "undefined";
    if (raw === null) return "null";
    if (typeof raw === "object") return JSON.stringify(raw) ?? String(raw);
    return String(raw);
  } catch {
    return "неизвестное значение";
  }
}

function uniqueByKey<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function canonicalPool(options: readonly string[]): string[] {
  return uniqueByKey(
    options.filter((name) => typeof name === "string" && name.trim()),
    skillKey,
  );
}

const GROUP_LABEL_BY_SKILL_SET = new Map<string, string>();
for (const group of SKILL_GROUPS) {
  const signature = [...group.skills]
    .map(skillKey)
    .sort()
    .join("\u0000");
  GROUP_LABEL_BY_SKILL_SET.set(signature, group.label);
}

/**
 * Requirement label derived from the actual option list: whole skill groups
 * first, then the individually named leftovers. A generic slot label is only a
 * fallback, so two culture slots with different groups never look identical.
 */
function optionsLabel(options: readonly string[], fallback: string): string {
  const keys = new Set(options.map(skillKey));
  const groups = SKILL_GROUPS.filter((group) =>
    group.skills.every((skill) => keys.has(skillKey(skill))),
  );
  const covered = new Set(groups.flatMap((group) => group.skills.map(skillKey)));
  const remainder = options.filter((name) => !covered.has(skillKey(name)));
  if (!groups.length && !remainder.length) return fallback;
  if (groups.length === 1 && !remainder.length) return groups[0].label;
  const parts = [...groups.map((group) => group.label), ...remainder];
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts.join(" или ");
  if (parts.length <= 4) return parts.join(", ");
  if (!groups.length) return fallback || `${remainder.length} навыков`;
  return [
    ...groups.map((group) => group.label),
    `${remainder.length} отдельных навыков`,
  ].join(", ");
}

function slotDomain(slot: SkillSlot): { key: string; label: string } {
  const options = canonicalPool(slot.options ?? []);
  const signature = [...options.map(skillKey)].sort().join("\u0000");
  const groupLabel = GROUP_LABEL_BY_SKILL_SET.get(signature);
  const label = optionsLabel(options, slot.label || "Навык");
  if (groupLabel)
    return { key: `group:${skillKey(groupLabel)}`, label: groupLabel };
  return { key: `options:${signature}`, label };
}

interface AutomaticSlot {
  index: number;
  kind: "automatic";
  skill: string;
}

interface FlexibleSlot {
  index: number;
  kind: "flexible";
  label: string;
  /** Options after removing known and automatic skills. */
  pool: string[];
  poolKeys: Set<string>;
  domain: string;
  domainLabel: string;
}

type PreparedSlot = AutomaticSlot | FlexibleSlot;

interface PreparedSlots {
  prepared: PreparedSlot[];
  automatic: string[];
  known: string[];
}

function prepareSlots(
  slots: readonly SkillSlot[],
  prior: readonly string[],
): PreparedSlots {
  // Prior skills come from earlier draft arrays, so a malformed source must not
  // take the whole wizard down; unknown shapes simply contribute nothing.
  const known = uniqueByKey(
    (Array.isArray(prior) ? prior : []).filter(isSkillName),
    skillKey,
  );
  const knownKeys = new Set(known.map(skillKey));
  const automatic: string[] = [];
  const automaticKeys = new Set<string>();
  // Locked slots first, so every flexible pool can exclude all reserved
  // automatic skills no matter where the fixed slot sits in the group.
  const locked = slots.map((slot) => {
    if (!slot.fixed) return false;
    const key = skillKey(slot.fixed);
    if (knownKeys.has(key) || automaticKeys.has(key)) return false;
    automaticKeys.add(key);
    automatic.push(slot.fixed);
    return true;
  });
  const prepared = slots.map((slot, index): PreparedSlot => {
    if (locked[index])
      return { index, kind: "automatic", skill: slot.fixed! };
    const sourceOptions = canonicalPool(slot.options ?? []);
    // 0301: when every option of a non-fixed choice was already granted by an
    // earlier source, the grant is a duplicate and the player may pick another
    // skill from any group. Only a fully exhausted, non-empty source domain
    // counts — a partially known or empty placeholder slot stays as it is.
    const exhaustedByPrior =
      !slot.fixed &&
      sourceOptions.length > 0 &&
      sourceOptions.every((name) => knownKeys.has(skillKey(name)));
    const replacement = Boolean(slot.fixed) || exhaustedByPrior;
    const source = replacement ? ALL_CREATION_SKILLS : slot.options ?? [];
    const pool = canonicalPool(source).filter((name) => {
      const key = skillKey(name);
      return !knownKeys.has(key) && !automaticKeys.has(key);
    });
    const domain = replacement
      ? {
          key: `replacement:${index}`,
          label: slot.fixed
            ? `Замена: ${slot.label}`
            : `Замена: ${optionsLabel(sourceOptions, slot.label || "Навык")} (уже известны)`,
        }
      : slotDomain(slot);
    return {
      index,
      kind: "flexible",
      label: slot.label,
      pool,
      poolKeys: new Set(pool.map(skillKey)),
      domain: domain.key,
      domainLabel: domain.label,
    };
  });
  return { prepared, automatic, known };
}

interface Candidate {
  name: string;
  key: string;
}

interface Matching {
  slotToCandidate: number[];
  candidateToSlot: number[];
  size: number;
}

const NO_MATCH = -1;

/**
 * Deterministic Kuhn augmenting-path maximum bipartite matching.
 *
 * Slots are processed from the most restricted one (smallest option pool) to the
 * broadest, ties by original slot order. Any order still yields a maximum
 * matching, but the order decides WHICH maximum matching becomes canonical. With
 * a free replacement slot in play, filling the narrow quotas first keeps e.g. a
 * picked intrigue skill in the intrigue slot instead of parking it in the broad
 * «any skill» slot and reporting the intrigue quota as unmet.
 */
function matchSkills(
  slots: readonly FlexibleSlot[],
  candidates: readonly Candidate[],
): Matching {
  const candidateOrder = slots.map((slot) =>
    candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => slot.poolKeys.has(candidate.key))
      .map(({ index }) => index),
  );
  const slotToCandidate = new Array<number>(slots.length).fill(NO_MATCH);
  const candidateToSlot = new Array<number>(candidates.length).fill(NO_MATCH);

  const assign = (slotIndex: number, visited: boolean[]): boolean => {
    for (const candidateIndex of candidateOrder[slotIndex]) {
      if (visited[candidateIndex]) continue;
      visited[candidateIndex] = true;
      const owner = candidateToSlot[candidateIndex];
      if (owner === NO_MATCH || assign(owner, visited)) {
        candidateToSlot[candidateIndex] = slotIndex;
        slotToCandidate[slotIndex] = candidateIndex;
        return true;
      }
    }
    return false;
  };

  const fillOrder = slots
    .map((slot, position) => ({ position, poolSize: slot.poolKeys.size }))
    .sort(
      (left, right) =>
        left.poolSize - right.poolSize || left.position - right.position,
    )
    .map(({ position }) => position);

  let size = 0;
  for (const slotIndex of fillOrder) {
    if (assign(slotIndex, new Array<boolean>(candidates.length).fill(false)))
      size++;
  }
  return { slotToCandidate, candidateToSlot, size };
}

interface RawParse {
  candidates: Candidate[];
  invalid: string[];
}

function parseRawValues(
  values: unknown,
  prepared: readonly PreparedSlot[],
): RawParse {
  const flexible = prepared.filter(
    (slot): slot is FlexibleSlot => slot.kind === "flexible",
  );
  const poolByKey = new Map<string, string>();
  for (const slot of flexible)
    for (const name of slot.pool) {
      const key = skillKey(name);
      if (!poolByKey.has(key)) poolByKey.set(key, name);
    }
  const invalid: string[] = [];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  // A missing array is an empty draft; any other non-array shape is malformed
  // data that has to be reported and dropped rather than thrown on.
  if (values !== undefined && !Array.isArray(values))
    invalid.push(describeRawValue(values));
  const entries: readonly unknown[] = Array.isArray(values) ? values : [];
  for (let index = 0; index < entries.length; index++) {
    const rawValue = entries[index];
    if (typeof rawValue !== "string") {
      invalid.push(describeRawValue(rawValue));
      continue;
    }
    const raw = rawValue.trim();
    if (!raw) continue;
    const key = skillKey(raw);
    const slot = prepared[index];
    if (slot?.kind === "automatic") {
      // A locked fixed skill cannot be replaced by raw draft data.
      if (key !== skillKey(slot.skill)) invalid.push(raw);
      continue;
    }
    const canonical = poolByKey.get(key);
    if (!canonical) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(key)) {
      invalid.push(raw);
      continue;
    }
    seen.add(key);
    candidates.push({ name: canonical, key });
  }
  return { candidates, invalid };
}

function requirementsFor(
  slots: readonly FlexibleSlot[],
  matching: Matching,
): SkillRequirement[] {
  const byDomain = new Map<string, SkillRequirement>();
  for (const [position, slot] of slots.entries()) {
    const entry = byDomain.get(slot.domain) ?? {
      label: slot.domainLabel,
      required: 0,
      selected: 0,
    };
    entry.required += 1;
    if (matching.slotToCandidate[position] !== NO_MATCH) entry.selected += 1;
    byDomain.set(slot.domain, entry);
  }
  return [...byDomain.values()];
}

export function resolveSkillSelection(
  slots: readonly SkillSlot[],
  values: readonly string[],
  prior: readonly string[] = [],
): SkillSelectionState {
  const { prepared, automatic, known } = prepareSlots(slots, prior);
  const flexible = prepared.filter(
    (slot): slot is FlexibleSlot => slot.kind === "flexible",
  );
  const parsed = parseRawValues(values, prepared);
  const matching = matchSkills(flexible, parsed.candidates);
  const invalid = [
    ...parsed.invalid,
    ...parsed.candidates
      .filter((_, index) => matching.candidateToSlot[index] === NO_MATCH)
      .map((candidate) => candidate.name),
  ];

  const canonicalValues = new Array<string>(slots.length).fill("");
  for (const slot of prepared) {
    if (slot.kind === "automatic") canonicalValues[slot.index] = slot.skill;
  }
  const selected: string[] = [];
  for (const [position, slot] of flexible.entries()) {
    const candidateIndex = matching.slotToCandidate[position];
    if (candidateIndex === NO_MATCH) continue;
    const candidate = parsed.candidates[candidateIndex];
    canonicalValues[slot.index] = candidate.name;
    selected.push(candidate.name);
  }

  const available = canonicalPool(flexible.flatMap((slot) => slot.pool));
  const selectedKeys = new Set(selected.map(skillKey));
  const required = flexible.length;
  const selectable = available.filter((name) => {
    const key = skillKey(name);
    if (selectedKeys.has(key)) return false;
    if (selected.length >= required) return false;
    const trial: Candidate[] = [...parsed.candidates, { name, key }];
    return matchSkills(flexible, trial).size === trial.length;
  });

  return {
    values: canonicalValues,
    selected,
    automatic,
    known,
    required,
    remaining: required - selected.length,
    complete: invalid.length === 0 && selected.length === required,
    available,
    selectable,
    invalid,
    requirements: requirementsFor(flexible, matching),
  };
}

/**
 * Toggle one skill chip. Removing a selected skill always works; adding only
 * works when the chip can join the current set without dropping another
 * selected skill, and invalid toggles are a no-op on the raw draft values.
 */
export function toggleSkillSelection(
  slots: readonly SkillSlot[],
  values: readonly string[],
  prior: readonly string[],
  skill: string,
): string[] {
  const state = resolveSkillSelection(slots, values, prior);
  // Bad raw draft data must not break a toggle: a real change returns the
  // canonical assignment, which also repairs the stored array; a no-op keeps a
  // valid raw array untouched and otherwise falls back to canonical values.
  const noOp = () =>
    Array.isArray(values) ? [...values] : [...state.values];
  if (!isSkillName(skill)) return noOp();
  const key = skillKey(skill);
  const selectedIndex = state.selected.findIndex(
    (name) => skillKey(name) === key,
  );
  if (selectedIndex >= 0) {
    const removed = state.selected[selectedIndex];
    const nextValues = state.values.map((value) =>
      value && skillKey(value) === skillKey(removed) ? "" : value,
    );
    return resolveSkillSelection(slots, nextValues, prior).values;
  }
  if (
    state.known.some((name) => skillKey(name) === key) ||
    state.automatic.some((name) => skillKey(name) === key)
  )
    return noOp();
  const candidate = state.available.find((name) => skillKey(name) === key);
  if (
    !candidate ||
    state.remaining <= 0 ||
    !state.selectable.some((name) => skillKey(name) === key)
  )
    return noOp();
  return resolveSkillSelection(slots, [...state.values, candidate], prior).values;
}
