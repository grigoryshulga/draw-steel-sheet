import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import builder from "../src/data/builder.generated.json";
import kits from "../src/data/kits.generated.json";
import {
  ART_ASSETS,
  artFor,
  artForArticle,
  type ArtKind,
} from "../src/lib/art";

describe("Illustration catalog", () => {
  it("covers every selectable ancestry, class, career and kit without duplicate subjects", () => {
    const catalogs: [ArtKind, { name: string }[]][] = [
      ["class", builder.classes],
      ["ancestry", builder.ancestries],
      ["career", builder.careers],
      ["kit", kits],
    ];
    expect(ART_ASSETS).toHaveLength(
      catalogs.reduce((count, [, items]) => count + items.length, 0),
    );
    for (const [kind, items] of catalogs) {
      for (const item of items)
        expect(artFor(kind, item.name), `${kind}: ${item.name}`).toBeDefined();
    }
    expect(
      new Set(ART_ASSETS.map((art) => `${art.kind}:${art.name}`)).size,
    ).toBe(ART_ASSETS.length);
  });
  it("ships real PNG artwork and lightweight previews, with dimensions matching the manifest", () => {
    const readPng = (src: string) => {
      expect(src).toMatch(/^\/art\/[a-z0-9/-]+\.png$/);
      const data = readFileSync(path.join(process.cwd(), "public", src));
      expect(data.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(data[25]).toBe(6); // RGBA: the alpha channel survives delivery processing.
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    };
    for (const art of ART_ASSETS) {
      expect(readPng(art.src)).toEqual({
        width: art.width,
        height: art.height,
      });
      expect(art.thumbnailSrc).toBeDefined();
      const preview = readPng(art.thumbnailSrc!);
      expect(preview.width).toBeLessThanOrEqual(360);
      expect(preview.height).toBeLessThanOrEqual(480);
    }
  });
  it("links each illustration to its rule article and preserves attribution", () => {
    for (const art of ART_ASSETS) {
      expect(art.articleIds.length).toBeGreaterThan(0);
      for (const id of art.articleIds) expect(artForArticle(id)).toBe(art);
      expect(art.credit).not.toBe("");
      if (art.origin === "official")
        expect(art.sourceUrl).toMatch(/^https:\/\//);
    }
    expect(artForArticle("0841")).toBe(artFor("class", "Тактик"));
    expect(artFor("class", " ТАКТИК ")).toBe(artFor("class", "Тактик"));
    expect(artFor("kit", "Нет такого комплекта")).toBeUndefined();
    expect(artForArticle("not-an-article")).toBeUndefined();
  });
});
