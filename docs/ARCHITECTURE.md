# Architecture and parallel development

## Module responsibilities

| Area | Responsibility | Integration contract |
| --- | --- | --- |
| `src/types.ts` | Persisted character model | Keep old documents readable through normalization in `lib/defaults.ts` |
| `src/data`, `src/lib` | Rules, calculations, transformations | No dependency on views, components or React context |
| `src/lib/persistence` | HTTP and Supabase storage adapters | Implement `CharacterRepository`; reject failed writes |
| `src/lib/api.ts` | Select storage adapter | Preserve the public API consumed by the app |
| `src/lib/autosave.ts` | Serialize writes and track unsaved changes | A failed save must remain retryable; flush before changing heroes |
| `src/state`, `src/App.tsx` | Application orchestration and context | Own navigation, active hero and transitions |
| `src/views` | User workflows | Call domain functions instead of duplicating rules |
| `src/components/ui` | Generic controls and dialogs | No game data or context dependencies; `components/ui.tsx` is the stable public entry point |
| `server/api.mjs` | HTTP API | Existing character routes and response shapes |
| `server/store.mjs` | Filesystem persistence | Atomic replacement and ordered mutations per character |
| `server/static.mjs` | Production files and SPA fallback | Constrain paths to dist; missing assets must return 404 |

The existing rule modules in `data` and `lib` refer to one another. They are one domain layer, not a claim of a strict two-layer dependency hierarchy. `check:architecture` guards the higher-level boundaries for relative static imports and literal dynamic imports; it does not detect every possible dependency or cycle.

## Assigning work to agents

Use bounded feature tasks with exclusive file ownership. A practical split is rules and their tests, persistence and its tests, and a UI workflow with colocated CSS. One integrator owns shared types, dependencies and the application shell. Agree on exported types and function signatures before editing a shared interface. Each handoff includes changed files, behavior, checks actually run, and unresolved concerns.

For another class, extend its mechanics modules and focused rule tests; avoid adding class-specific branches to generic controls. For another storage backend, implement the repository contract and test failures as well as success. For a new view, use existing UI primitives and navigation metadata.

## Generated data

`codex.generated.json` is the complete book. Only the Codex view imports it directly in application code. Shared catalog/tooltips consume `library-articles.generated.json`, containing the glossary and chapters 16, 18, 19. `build-codex.mjs` refreshes this subset automatically; `npm run data:library` refreshes it independently. A parity test prevents stale or missing articles.

English originals live in `scripts/originals/` (SteelCompendium reference data and
old-to-new id maps). `build-originals.mjs` is the last data step: it adds
`originalId`, `originalName` and `originalDescription`, replaces transliterated
ids with English scc-ids, and writes `legacy-ids.generated.json` so saved
characters still resolve perks, ancestry traits and abilities by their old ids.
It runs after the generators in `npm run data` and `npm run data:library`, and
can be rerun alone with `npm run data:originals`.

## Quality gate

`npm run check` runs import-boundary checks, all Vitest tests, then TypeScript and the production build. GitHub Actions runs the same command. API tests start an isolated server and use temporary storage, leaving user characters untouched.

Browser layout, keyboard interaction and live Supabase policies require separate validation. Passing unit tests does not establish those results.

## Remaining architectural work

- The filesystem store serializes mutations within one server process. Multiple processes or simultaneous editors still use last-write-wins semantics; distributed deployment needs revision checks or transactional storage.

- `NewCharacterDialog.tsx` and `App.tsx` still coordinate large workflows. Extract builder steps and hero lifecycle transitions in separate, behavior-preserving tasks.
- The full Codex and ability datasets still produce large chunks. The catalog subset removes an eager dependency but does not implement chapter-by-chapter loading or a search worker.
- Several historical tests inspect source text. Prefer behavioral tests for future changes; do not count string assertions as browser coverage.
- Preserve historical design/audit documents as context. Their test counts and file references describe prior iterations, not the current inventory.
