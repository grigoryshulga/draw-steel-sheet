# Architecture and parallel development

## Module responsibilities

| Area | Responsibility | Integration contract |
| --- | --- | --- |
| `content/rules` | Canonical articles and rule entities | Stable IDs, full source text and explicit entity references |
| `src/rules` | Typed rule access and lazy pack loading | UI reads through the repository; no UI dependencies |
| `src/components/rules` | Shared reference and sheet presentation | Reference reading requires no character |
| `src/types.ts` | Persisted character model | Keep old documents readable through normalization in `lib/defaults.ts` |
| `src/data`, `src/lib` | Rules, calculations, transformations | No dependency on views, components or React context |
| `src/lib/persistence` | HTTP and Supabase storage adapters | Implement `CharacterRepository`; reject failed writes |
| `src/lib/api.ts` | Select storage adapter | Preserve the public API consumed by the app |
| `src/lib/autosave.ts` | Serialize writes and track unsaved changes | A failed save must remain retryable; flush before changing heroes |
| `src/state`, `src/App.tsx`, `src/WorkspaceApp.tsx` | Application orchestration and context | Own navigation, active hero and transitions |
| `src/views` | User workflows | Call domain functions instead of duplicating rules |
| `src/components/ui` | Generic controls and dialogs | No game data or context dependencies; `components/ui.tsx` is the stable public entry point |
| `server/api.mjs` | HTTP API | Existing character routes and response shapes |
| `server/store.mjs` | Filesystem persistence | Atomic replacement and ordered mutations per character |
| `server/static.mjs` | Production files and SPA fallback | Constrain paths to dist; missing assets must return 404 |

The existing rule modules in `data` and `lib` refer to one another. They are one domain layer, not a claim of a strict two-layer dependency hierarchy. `check:architecture` guards the higher-level boundaries for relative static imports and literal dynamic imports; it does not detect every possible dependency or cycle.

## Assigning work to agents

Use bounded feature tasks with exclusive file ownership. A practical split is rules and their tests, persistence and its tests, and a UI workflow with colocated CSS. One integrator owns shared types, dependencies and the application shell. Agree on exported types and function signatures before editing a shared interface. Each handoff includes changed files, behavior, checks actually run, and unresolved concerns.

For another class, extend its mechanics modules and focused rule tests; avoid adding class-specific branches to generic controls. For another storage backend, implement the repository contract and test failures as well as success. For a new view, use existing UI primitives and navigation metadata.

## Rules content and generated data

Canonical editing inputs live in `content/rules/articles` and `content/rules/entities`. Articles contain ordered Markdown blocks and entity references. Entity Markdown retains complete source rules; structured ability fields are a projection, not a replacement for that text. Keep IDs stable when editing names or moving files. Runtime mechanics and player snapshots retain their existing formats.

`npm run content:build` validates and builds `src/generated/rules/manifest.json` (navigation only), its compact runtime projection `navigation.json`, the lazy full-text corpus `src/generated/rules/search.json`, self-contained article JSON in `src/generated/rules/articles/`, and lazy packs by chapter/class or monster group for entity lookup; it then regenerates consumer projections in `src/generated/consumers/` (ability cards, catalog/glossary, kits, perks, features, level-up rules and builder options) from the canonical tree alone. Production build includes this step. `npm run content:check` checks committed delivery files without writing them; CI runs it before tests. UI consumers use `src/rules/repository.ts`, not direct pack imports; only `src/rules/consumer-*.ts` adapters may import the generated consumer projections.

The compact navigation projection omits reproducible heading IDs; `repository.ts` restores them with the shared `headingId` contract. A parity test compares the restored index to the full manifest. Article URL and pack-loader directories (`article-assets.ts`, `pack-assets.ts`) load dynamically on first use, separately from navigation. Full source prose stays out of the initial bundle; existing route size budgets also apply after adding books.

### Monsters content

`content/monsters/source.json` is a pinned authoring/audit snapshot, not a runtime or normal-build input. `glossary.json` and [the lexicon](monsters-lexicon.md) align Monsters with the existing Russian Heroes terms. The canonical translations live in article chapters 22–25 and entity kinds `monster`, `retainer`, `terrain`, `monster-feature`, `monster-lore`, `monster-rule`. Original SCC IDs and English text are preserved alongside stable local IDs; translating a name must never change identity. Beastheart and Summoner books/classes are outside this import.

`scripts/content/lib/director-content.mjs` resolves every `scc.v1` link during delivery, failing the build on an unresolved target. It adds related lore/rules links and inlines each retainer's own and role advancement into its article payload. Canonical source translations remain independently addressable. The supplemental advancement table is explicitly editorial and links to the chapter it summarizes.

Director filter metadata is projected into navigation; source paths/revisions and originals stay in lazy articles. Keyword spellings come from the shared glossary. Terrain sizes and encounter values come from the translated stat list; ranges compare the price of the described area without inventing an encounter-wide total. Russian copy uses «Боевая ценность» or «БЦ»; the English originals retain EV. `director-catalog.ts` handles combined filters; the same articles are reachable from the Codex and Reference.

Safe Markdown transforms render creature mini-sheets and ability cards without enabling arbitrary source HTML. `remark-director-abilities.ts` retains rich source text, links and nested rules, mapping printed facts and power-roll tiers to `AbilityCardFrame`, `AbilityFacts` and `AbilityTiers`, also used by hero cards. Adjacent cards are grouped by action in the shared `AbilityGroup` disclosure/grid; headings and prose remain boundaries so retainer levels and special instructions keep their context. It does not construct a hero ability or import character calculations. `remark-director-blocks.ts` exposes printed stat fields to `DirectorStatBlock`; `RuleEntityView` supplies the name and English subtitle so the identity, unit type and values share one compact header. Corpus tests cover every named block and stat sheet. The importer, update procedure, coverage and source exceptions are documented in [content/monsters/README.md](../content/monsters/README.md).

`npm run content:import -- --dry-run` previews the one-time legacy import. A normal import refuses conflicting canonical files. `--replace` explicitly overwrites curated content and is reserved for a deliberate migration, never routine build or CI. Migration coverage and unresolved mappings are recorded in `content/rules/migration-report.json`; preserved prose is not evidence that every block became an entity.

Legacy rules snapshots `src/data/*.generated.json` no longer have runtime consumers: every `src/` module reads canonical projections through `src/rules/consumer-*.ts` (architecture guard enforces it). The one exception is `src/data/art.generated.json`: an image manifest (not rules data), regenerated by `scripts/build-art-manifest.mjs` from the canonical projections and `src/generated/rules/manifest.json`. The legacy snapshots remain as parity fixtures for migration tests and can still be regenerated from external rules via `npm run data`; that pipeline does not overwrite canonical content. A rule change propagates to the site via `npm run content:build`; the legacy pipeline exists only to keep parity tests honest.

Accepted canon↔legacy divergences (intentional, all pinned by tests): «Большой!»/«Маленький!» lost the trailing «!» in canonical names; `perks.description` is the canonical `summary` (the full perk text lives in its Codex article); the five «Буревестник» kit ability cards exist as entities and are inlined into the kit article prose (`stageTwo.inlinedAbilityBlocks` in `content/rules/migration-report.json`); the 10 class aggregates are not referenced from article prose and are reachable only via `loadRuleEntity`.

Projections are decorated with English SteelCompendium originals by `scripts/content/lib/originals.mjs`: each record keeps `originalId`, `originalName`, `originalDescription`, exposes an English `id`, and stores the legacy transliterated id in `legacyId` for saved characters. The canonical `content/rules` tree keeps its internal legacy ids; only the app-facing projections change identity.

The compendium, catalog, glossary, kits, perks, features, level-up rules and builder options are projections of canonical content. `src/data/*` modules and `src/lib/character-builder.ts` keep their public contracts but read through `src/rules/consumer-*.ts`; serialized player IDs are preserved by `scripts/content/lib/consumer-identity.json`. Editing a canonical entity or article propagates via `npm run content:build`. Codex navigation uses the manifest (`src/rules/codex-navigation.ts`); full-text search loads `search.json` lazily on the first search, separate from the manifest. Hand-written mechanics stay in `src/data/*/mechanics/` and `src/data/class-features/legacy-rows.ts` (synthetic table rows the canonical tree intentionally does not model). See [the migration contract](plans/rules-content-migration.md), [stage two](plans/rules-content-stage-two.md) and [stage three](plans/rules-content-stage-three.md) for module ownership.

## Quality gate

`npm run check` runs import-boundary checks, generated-content freshness checks, all Vitest tests, then TypeScript, the production build and static JavaScript size budgets (`perf:check`). GitHub Actions runs the same command. API tests start an isolated server and use temporary storage, leaving user characters untouched.

Browser layout, keyboard interaction and live Supabase policies require separate validation. Passing unit tests does not establish those results.

## Remaining architectural work

- The filesystem store serializes mutations within one server process. Multiple processes or simultaneous editors still use last-write-wins semantics; distributed deployment needs revision checks or transactional storage.

- `NewCharacterDialog.tsx` orchestrates the seven-stage creation flow from `lib/builder-flow.ts`. Individual decisions keep the legacy draft and step contracts; the v3 position key restores older v1/v2 positions. `BuilderSelection` stages list choices for the current decision; `advanceBuilderFlow` applies and validates them on Next before resolving the next dynamic step. Back and sidebar navigation discard uncommitted choices. `ReferenceList` and its card styles are shared with `CatalogView`; canonical entries are passed through without creating builder entities. The desktop builder keeps stages on the left and the character summary on the right. `RuleArticleReader` is shared by the catalog and builder; class previews reuse `ClassLandingView` with all levels available. `WorkspaceApp.tsx` still owns hero lifecycle transitions.
- Codex fetches one self-contained article JSON at a time (including every referenced entity, even from another chapter); chapter/class packs remain available for direct entity lookup. Its full-text corpus loads only on first search. Content migration is complete: every runtime consumer reads canonical projections (see `content/rules/migration-report.json`); legacy snapshots are parity fixtures only. Transliterated historical paths/IDs are deliberately preserved until the deferred rename.
- The application shell loads `WorkspaceApp` lazily, so guest reading and sign-in do not import hero calculations. `consumer-features` reads precomputed trait prices instead of importing the builder. Sheet development, inventory, notes and companions are separate lazy views. The sheet still needs large shared mechanics and rule projections; further class-specific splitting needs explicit async domain contracts. See [the performance audit](performance-audit.md).
- Reading links/tooltips use `consumer-reading`, reference list/search previews use `consumer-reference-preview`, and sheet grant attribution uses `consumer-level-up-grants`. These are compact generated projections: full consumer records, original prose and saved IDs remain intact. `library-utils` must not import full datasets. The XP counter uses `level-up-progress`; the full level-up plan loads only when its shortcut is shown or development is opened. Public reading can render while Supabase session validation is pending; private routes retain their auth gate.
- Production builds create Brotli/gzip sidecars. The Node static handler negotiates them, streams files, revalidates HTML with ETags and caches hashed assets for one year. Other hosting providers must supply equivalent compression/cache headers themselves.
- Several historical tests inspect source text. Prefer behavioral tests for future changes; do not count string assertions as browser coverage.
- Preserve historical design/audit documents as context. Their test counts and file references describe prior iterations, not the current inventory.
