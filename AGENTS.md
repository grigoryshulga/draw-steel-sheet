# Working in this repository

Before changing architecture or assigning parallel work, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for ownership boundaries and integration contracts.

- Keep player-facing copy in Russian. For visual changes, read `docs/design-system.md`, `docs/typography.md`, and `docs/brand.md`.
- Game rules live in `src/lib` and `src/data`; preserve saved-character compatibility and add behavioral tests when changing calculations or persistence.
- Generated JSON is committed build output. Change its generator and regenerate it; `npm run data` requires the external rules checkout described in README. `npm run data:library` works from the committed Codex data.
- Assign each agent disjoint files and a concrete acceptance check. Keep shared entry points (`App.tsx`, `types.ts`, `package.json`, generated data) under one integration owner. Subagent provider/model preferences from the user apply to every delegation.
- Finish integration with `npm run check` and `git diff --check`. Report any unavailable browser or live cloud validation separately from passing unit tests.
