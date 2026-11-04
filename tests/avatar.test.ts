import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_HEIGHT,
  AVATAR_MAX_SOURCE_BYTES,
  AVATAR_MAX_WIDTH,
  fitAvatarDimensions,
  validateAvatarFile,
} from "../src/lib/avatar";
import { createCharacter, normalizeCharacter } from "../src/lib/defaults";

describe("avatar upload rules", () => {
  it("accepts PNG, JPEG and WebP up to 512 KB", () => {
    expect(validateAvatarFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_SOURCE_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: "image/webp", size: 2048 })).toBeNull();
  });

  it("rejects other formats, empty and oversized files", () => {
    expect(validateAvatarFile({ type: "image/gif", size: 1024 })).toMatch(/PNG, JPEG или WebP/);
    expect(validateAvatarFile({ type: "image/png", size: 0 })).toMatch(/пуст/);
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_SOURCE_BYTES + 1 }))
      .toMatch(/512 КБ/);
  });

  it("downscales wide images to 600 px and keeps proportions", () => {
    expect(fitAvatarDimensions(1800, 1200)).toEqual({ width: 600, height: 400 });
    expect(fitAvatarDimensions(1200, 1200)).toEqual({ width: 600, height: 600 });
  });

  it("does not upscale small images", () => {
    expect(fitAvatarDimensions(320, 240)).toEqual({ width: 320, height: 240 });
  });

  it("caps very tall images by height as well", () => {
    const size = fitAvatarDimensions(400, 4000);
    expect(size.width).toBeLessThanOrEqual(AVATAR_MAX_WIDTH);
    expect(size.height).toBe(AVATAR_MAX_HEIGHT);
    expect(size.width / size.height).toBeCloseTo(400 / 4000, 1);
  });

  it("rejects unknown dimensions instead of producing a zero-sized canvas", () => {
    expect(() => fitAvatarDimensions(0, 100)).toThrow(/размер/);
  });

  it("keeps a valid saved avatar and drops malformed links", () => {
    const character = createCharacter({ name: "Герой" });
    expect(normalizeCharacter({
      ...character,
      avatar: { url: "  https://cdn.example.test/a.webp  ", updatedAt: "2026-01-01T00:00:00Z" },
    }).avatar).toEqual({
      url: "https://cdn.example.test/a.webp",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(normalizeCharacter({
      ...character,
      avatar: { url: "", updatedAt: "2026-01-01T00:00:00Z" },
    }).avatar).toBeUndefined();
    expect(normalizeCharacter({
      ...character,
      avatar: "https://cdn.example.test/a.webp" as never,
    }).avatar).toBeUndefined();
  });
});
