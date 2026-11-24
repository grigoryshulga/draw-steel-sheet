import { describe, expect, it } from "vitest";
import { resolveLocale } from "../src/i18n/locale";

describe("site language", () => {
  it("uses Russian on the first visit and restores the reader’s preference", () => {
    expect(resolveLocale("", null)).toBe("ru");
    expect(resolveLocale("", "en")).toBe("en");
    expect(resolveLocale("?lang=unknown", "en")).toBe("en");
    expect(resolveLocale("", "unknown")).toBe("ru");
  });

  it("lets an explicit language link override the device preference", () => {
    expect(resolveLocale("?campaign=1&lang=en", "ru")).toBe("en");
    expect(resolveLocale("?lang=ru", "en")).toBe("ru");
  });
});
