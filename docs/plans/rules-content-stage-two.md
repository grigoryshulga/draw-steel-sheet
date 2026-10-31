# Rules content migration — stage two

This plan supersedes stage-one ownership for the next three tasks. Read `docs/ARCHITECTURE.md` first. User explicitly deferred renaming: preserve existing paths, pack IDs, entity IDs and legacy IDs. New technical names must be meaningful English, never transliteration; UI text stays Russian.

## Shared requirements

Work in the shared checkout, preserve other changes, no commits or child agents. Preserve character snapshots and custom ability edits. No silent guessing of entity identity, no lossy replacement of full Markdown. Do not delete legacy datasets while callers/tests still use them. Generated artifacts must have deterministic generators and freshness checks. Parent owns package scripts, architecture guard, shared App/types, docs and final integration.

## 1. Remaining entity kinds

Exclusive ownership: `content/rules/**`, `scripts/content/import-legacy.mjs`, a new `scripts/content/migrate-entities.mjs` and its private extraction helpers; `tests/rules-content-entities.test.ts`.

Migrate kits, items/treasures, projects, titles and ancestry species into canonical entities wherever exact extraction is possible. Keep existing article/entity identities and references. Work from the current canonical tree, using old datasets only for explicit migration metadata. Add an incremental safe migration; do not rerun blanket import with --replace. Existing curated content must survive. Already embedded ability/feature references cannot be flattened or duplicated to pretend a whole chapter is one entity. The current entity schema remains unchanged: if an extraction needs nested entity blocks, report it as deferred instead of introducing a private incompatible schema. Do not edit schema/build-rules/repository/UI or generated delivery packs. You may build into a temporary output directory to verify.

Acceptance: new kind coverage recorded precisely, lossless article reconstruction and links, no missing/duplicated legacy refs, rerun safety, existing content edits preserved, no new transliterated technical names. Preserve original source text and source paths (historical source metadata is not a new technical name).

## 2. Canonical consumers

Exclusive ownership: new `scripts/content/build-consumer-data.mjs` and private helpers; `src/generated/consumers/**`; new `src/rules/consumer-data.ts` and consumer-specific helpers; `src/data/compendium.ts`, `src/data/library.ts`; `tests/rules-consumers*.test.ts`.

Actually switch the ability compendium used by builder/sheet and catalog/glossary data to projections from the canonical content tree. Do not just add an unused adapter. Preserve public exports and serialized IDs so callers need no player-data migration. The 512 canonical ability entities already carry structured `ability` projections. Catalog/glossary projections must reconstruct canonical article Markdown through refs, not read the old book or library snapshots. Keep full content; game calculation mechanics stay unchanged. Build may use only canonical inputs; old JSON may be referenced by parity tests, not runtime/fallback or normal generation. Separate ability and library generated files so importing one does not force the other dataset into the bundle. No eager import of all rule packs. Preserve existing catalogue item IDs (including old name-derived IDs) through an explicit persisted identity mapping if needed, not re-deriving identity on every translated-name edit. Coordinate mapping under your owned files rather than modifying peers' canonical entities.

Generator CLI: `node scripts/content/build-consumer-data.mjs` and `--check`; parent wires it after primary content build/check. Generated outputs under `src/generated/consumers/` are private to `src/rules/consumer-data.ts`. No schema/primary-generator/package edits. Prove an edit to canonical ability fields propagates to compendium and an edit to canonical article/entity text propagates to catalog/glossary. Test old IDs, counts, custom character data unchanged, and failures on missing or ambiguous mappings. Explicitly report builder/class-feature/level-up consumers that remain legacy-backed.

## 3. Lazy full-text search

Exclusive ownership: `scripts/content/build-rules.mjs` (not import-legacy/shared common helpers); `src/rules/schema.ts`, repository.ts, repository-core.ts and new search modules (NOT consumer-data.ts); `src/generated/rules/**`; `src/views/CodexView.tsx/.css`; existing `tests/rules-content.test.ts`, `tests/rules-repository*.test.ts` and new `tests/rules-search*.test.ts`.

Remove full rule prose from the eagerly loaded manifest. Generate a separate search artifact under `src/generated/rules/`; lazy load it only when the user searches, with deduplication, retry and stale-query protection. Initial browsing/article opening must not fetch the entire search corpus. Keep manifest article metadata, headings and entity-to-pack mapping. Adjust schema, build, repository and existing tests together. Other tasks depend on RuleEntity/RuleArticle unchanged; only index/search types may change. Preserve full-text search over referenced entities, Russian normalization, relevance, bookmarks and old routes. Preserve original casing in excerpts. Document public search interface in handoff. Avoid preloading all packs or an eager barrel that defeats lazy search. Do not add workers/dependencies unless needed. Fix inaccurate comments calling the old 3 MB index small. Test loader boundaries and query/error/race behavior, inspect production import graph and report actual bundle evidence. No numeric chart artifact required for internal measurements.

## Parent integration

Register consumer generation/check after rule generation/check. Extend import guard only for the explicit consumer adapter. Update architecture and remaining-legacy inventory. Build final artifacts after all producers finish, then run `npm run check` and `git diff --check`. Do not claim complete consumer migration or browser validation from passing unit tests.
