import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const builder = readJson("src/data/builder.generated.json");
const kits = readJson("src/data/kits.generated.json");
const codex = readJson("src/data/codex-index.generated.json");
const catalogs = {
  class: builder.classes,
  ancestry: builder.ancestries,
  career: builder.careers,
  kit: kits,
};
const normalized = (name) =>
  name.trim().toLocaleLowerCase("ru").replace(/ё/g, "е");
const manifests = ["classes", "ancestries", "kits", "careers"].map(
  (name) => `docs/art/${name}-manifest.json`,
);
const entries = manifests
  .filter((file) => fs.existsSync(file))
  .flatMap(readJson);
const seen = new Set();
const result = entries.map((entry) => {
  const { kind, name, src, origin, sourceUrl } = entry;
  const match = catalogs[kind]?.find(
    (item) => normalized(item.name) === normalized(name),
  );
  if (!match) throw new Error(`Unknown art subject: ${kind}: ${name}`);
  const key = `${kind}:${normalized(name)}`;
  if (seen.has(key)) throw new Error(`Duplicate art subject: ${key}`);
  seen.add(key);
  if (!/^\/art\/[a-z0-9/-]+\.png$/.test(src))
    throw new Error(`Invalid local PNG path: ${src}`);
  if (!["official", "generated"].includes(origin))
    throw new Error(`Missing art origin: ${key}`);
  if (origin === "official" && !sourceUrl?.startsWith("https://"))
    throw new Error(`Missing official source: ${key}`);
  const data = fs.readFileSync(path.join(root, "public", src));
  if (
    !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error(`Not a PNG: ${src}`);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const thumbnailSrc = src.replace("/art/", "/art/previews/");
  if (!width || !height || ![4, 6].includes(data[25]))
    throw new Error(`PNG must have alpha: ${src}`);
  const articleIds =
    kind === "kit"
      ? codex
          .filter(
            (a) =>
              a.chapter.startsWith("09.") &&
              normalized(a.title) === normalized(name),
          )
          .map((a) => a.id)
      : [match.articleId];
  if (articleIds.some((id) => !id) || !articleIds.length)
    throw new Error(`Missing Codex article: ${key}`);
  return {
    kind,
    name: match.name,
    src,
    ...(fs.existsSync(path.join(root, "public", thumbnailSrc))
      ? { thumbnailSrc }
      : {}),
    width,
    height,
    origin,
    ...(sourceUrl ? { sourceUrl } : {}),
    credit:
      entry.credit ??
      (origin === "official"
        ? "© MCDM Productions, LLC · адаптация с AI"
        : "Создано для Стального листа с AI"),
    articleIds,
  };
});

const missing = Object.entries(catalogs).flatMap(([kind, items]) =>
  items
    .filter((item) => !seen.has(`${kind}:${normalized(item.name)}`))
    .map((item) => `${kind}: ${item.name}`),
);
if (process.argv.includes("--check") && missing.length)
  throw new Error(
    `Missing artwork (${missing.length}):\n${missing.join("\n")}`,
  );
fs.writeFileSync(
  path.join(root, "src/data/art.generated.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `Art manifest: ${result.length} PNG assets; missing ${missing.length}.`,
);
