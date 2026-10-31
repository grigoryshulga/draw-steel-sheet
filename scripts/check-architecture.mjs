import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
for (const file of walk(path.join(root, 'src'))) {
  const name = path.relative(root, file).replaceAll(path.sep, '/');
  const source = readFileSync(file, 'utf8');
  // Check the project's static imports/re-exports and literal dynamic imports.
  // This is a boundary guard, not a replacement for the TypeScript compiler.
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g;
  for (const [, rawSpecifier] of source.matchAll(imports)) {
    // Vite query suffixes (?raw, ?url, ?inline…) do not change the target file.
    const specifier = rawSpecifier.replace(/\?[a-z]+$/, '');
    const target = path.relative(root, path.resolve(path.dirname(file), specifier)).replaceAll(path.sep, '/');
    const reason =
      target.endsWith('/codex.generated.json')
        ? 'Legacy full rulebook is import-only; Codex reads canonical rules through src/rules/repository.'
        : /^src\/(lib|data|rules)\//.test(name) && /^src\/(views|components|state)\//.test(target)
          ? 'Domain/data modules must not depend on UI or React context.'
          : target.startsWith('src/generated/rules/') && name !== 'src/rules/repository.ts'
            ? 'Generated rule delivery is private to the rules repository.'
          : target.startsWith('src/generated/consumers/') && !/^src\/rules\/consumer-[a-z-]+\.ts$/.test(name)
            ? 'Generated consumer projections are private to their consumer adapters.'
          : /\/data\/[a-z-]+\.generated\.json$/.test(target) && !/art\.generated\.json$/.test(target) && name.startsWith('src/')
            ? 'Legacy dataset snapshots are test-only parity fixtures; runtime reads canonical projections via src/rules/consumer-*.ts.'
          : name.startsWith('src/') && target.startsWith('content/')
            ? 'The canonical rules tree enters the app only through generated projections; never import content/ directly.'
          : target.startsWith('server/')
            ? 'Client code must access the server through the repository API.'
            : name.startsWith('src/components/ui/') && /^src\/(views|state|data)\//.test(target)
              ? 'UI primitives must not depend on application state, views or game data.'
              : '';
    if (reason) errors.push(`${name} -> ${specifier}: ${reason}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Architecture boundaries passed.');
