import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const sources = ["classes", "ancestries", "kits", "careers"].flatMap(
  (category) => {
    const directory = path.join("public/art", category);
    return fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((file) => file.endsWith(".png"))
          .map((file) => ({
            source: path.join(directory, file),
            output: path.join("public/art/previews", category, file),
          }))
      : [];
  },
);
let bytes = 0;
for (let start = 0; start < sources.length; start += 4) {
  await Promise.all(
    sources.slice(start, start + 4).map(async ({ source, output }) => {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      if (
        !fs.existsSync(output) ||
        fs.statSync(output).mtimeMs < fs.statSync(source).mtimeMs
      ) {
        // Delivery thumbnails only; the full-size artwork and downloaded originals stay untouched.
        await run("magick", [
          source,
          "-resize",
          "360x480>",
          "-strip",
          `PNG32:${output}`,
        ]);
      }
      bytes += fs.statSync(output).size;
    }),
  );
}
console.log(
  `${sources.length} PNG previews, ${(bytes / 1024 / 1024).toFixed(1)} MiB total.`,
);
