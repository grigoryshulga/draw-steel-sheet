import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

// Precompress only build output; requests never spend CPU compressing rule packs.
export async function compressAssets(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await compressAssets(file);
    } else if (/\.(?:js|css|json|html|svg)$/.test(entry.name)) {
      const data = await fs.readFile(file);
      if (data.length < 1024) continue;
      for (const [suffix, compressed] of [
        ['br', await brotli(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })],
        ['gz', await gz(data, { level: 9 })],
      ]) {
        await fs.writeFile(`${file}.${suffix}`, compressed);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  await compressAssets(path.resolve('dist'));
}
