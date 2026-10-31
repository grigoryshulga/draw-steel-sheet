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
  for (const [, specifier] of source.matchAll(imports)) {
    const target = path.relative(root, path.resolve(path.dirname(file), specifier)).replaceAll(path.sep, '/');
    const reason =
      target.endsWith('/codex.generated.json') && name !== 'src/views/CodexView.tsx'
        ? 'Full rulebook belongs to CodexView; shared catalog uses library-articles.generated.json.'
        : /^src\/(lib|data)\//.test(name) && /^src\/(views|components|state)\//.test(target)
          ? 'Domain/data modules must not depend on UI or React context.'
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
