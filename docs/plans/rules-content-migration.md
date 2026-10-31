# Rules content migration — integration contract

## Objective

Canonical entities shared by Codex, builder and character sheet. Articles contain ordered Markdown blocks and entity references, with no lost rules, tables, links or headings. Small authoring files and lazy delivery packs are separate concerns. Preserve character documents and existing route IDs.

## Frozen first-pass contract

Data agent owns `src/rules/schema.ts`, exporting:

```ts
import type { CompendiumAbility } from '../types';
export type RuleEntityKind = 'ability' | 'feature' | 'ancestry' | 'kit' | 'perk' | 'item' | 'project' | 'title';
export interface RuleEntity {
  id: string; // namespaced stable identity; not derived anew from translated names
  kind: RuleEntityKind;
  name: string;
  markdown: string; // complete original rule block; never the lossy ability summary
  source: { articleId: string; path: string };
  legacyIds: string[];
  ability?: CompendiumAbility; // structured projection when reliably mapped
}
export type RuleBlock = { type: 'markdown'; text: string } | { type: 'entity'; ref: string };
export interface RuleArticle {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  blocks: RuleBlock[];
}
export interface RulePack {
  schemaVersion: 1;
  articles: RuleArticle[];
  entities: RuleEntity[];
}
export interface RuleIndexEntry {
  id: string;
  title: string;
  chapter: string;
  group: string;
  path: string;
  packId: string;
  headings: { id: string; title: string; level: number }[];
  searchText: string; // normalized searchable text including referenced entities
}
export interface RuleManifest {
  schemaVersion: 1;
  articles: RuleIndexEntry[];
  entities: Record<string, { packId: string; kind: RuleEntityKind }>;
}
```

Generated delivery paths: `src/generated/rules/manifest.json`, `src/generated/rules/packs/<packId>.json`. Pack IDs use safe ASCII filenames. Canonical authoring paths: `content/rules/entities/<kind>/<group>/<id>.json`, `content/rules/articles/<chapter>/<id>.json`. Physical filenames may sanitize IDs but must not redefine identity.

Import from committed legacy datasets is an explicit migration command, not an automatic step on every build. Build reads the canonical content tree. Preserve original datasets until consumers migrate and parity is proven; document remaining consumers. Existing serialized ability IDs are not rewritten. Exact matching only; ambiguous extraction stays in article prose with an explicit migration report rather than guessing or dropping text. Do not claim unmapped text migrated.

Runtime agent owns `src/rules/repository.ts` and exports:
- `ruleIndex: readonly RuleIndexEntry[]`
- `loadRuleArticle(id: string): Promise<{ article: RuleArticle; entities: Record<string, RuleEntity> }>`
- `loadRuleEntity(id: string): Promise<RuleEntity>`

Unknown IDs reject with useful errors; failed loads are retryable. Load packs using literal/glob Vite lazy imports, cache and deduplicate concurrent loads. UI handles errors and stale async navigation. Manifest may be eager, rule packs must remain lazy.

Presentation agent owns `src/components/rules/RuleEntity.tsx`, exports `RuleEntityView({entity}: {entity: RuleEntity})`, and `src/components/rules/RuleArticle.tsx`, exports `RuleArticleContent({article, entities}: {article: RuleArticle; entities: Record<string, RuleEntity>})`. Use existing design tokens and preserve full rules and anchors. No runtime repository dependency in these presentation components. Runtime agent imports RuleArticleContent in CodexView.

## Exclusive ownership

1. Content agent: `content/rules/**`, `scripts/content/**`, `src/rules/schema.ts`, `src/generated/rules/**`, `tests/rules-content*.test.ts`. Does not edit existing generators or package scripts.
2. Runtime agent: `src/rules/repository.ts` and its helpers other than schema; `src/views/CodexView.tsx`, `src/views/CodexView.css`, `tests/rules-repository*.test.ts`, `tests/codex-layout.test.ts` if necessary. No generated file edits.
3. Presentation agent: `src/components/rules/**`, `src/components/AbilityCard.tsx`, `src/components/AbilityCard.css`, `src/components/RuleText.tsx` if necessary, `tests/rule-entity*.test.ts`. Does not edit CodexView, schema, or generated data.
4. Parent integrator: `package.json`, lockfile, architecture guard, existing generation commands, shared App/types, architecture and handoff docs, final integration fixes.

No agents spawn children, make commits, discard other edits, or change player data. Work in the shared checkout only within assigned paths. Agents may read all files and this contract. Do not create competing schema/repository placeholders; use the agreed contract and report integration dependencies.

## Acceptance

- Deterministic build from canonical inputs, unique IDs and resolved references.
- Lossless article reconstruction, with behavioral parity tests covering special blocks.
- Codex retains full-text search, bookmarks, chapter navigation and existing URLs.
- Reading a rule does not require a character; sheet interactions and calculations remain unchanged.
- No destructive migration of player documents or automatic rule updates to custom abilities.
- Parent runs `npm run check` and `git diff --check` after all three handoffs.
