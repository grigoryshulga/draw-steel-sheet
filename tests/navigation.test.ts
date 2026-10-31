import { describe, expect, it } from "vitest";
import {
  HERO_TABS,
  LIBRARY_TABS,
  TABS,
  TAB_LABELS,
  isHeroTab,
  isLibraryTab,
} from "../src/navigation";

describe("navigation metadata", () => {
  it("labels every route exactly once", () => {
    expect(Object.keys(TAB_LABELS).sort()).toEqual([...TABS].sort());
    for (const tab of TABS) expect(TAB_LABELS[tab]).toBeTruthy();
  });

  it("classifies hero, library and secondary routes", () => {
    for (const tab of HERO_TABS) {
      expect(isHeroTab(tab)).toBe(true);
      expect(isLibraryTab(tab)).toBe(false);
    }
    for (const tab of LIBRARY_TABS) {
      expect(isLibraryTab(tab)).toBe(true);
      expect(isHeroTab(tab)).toBe(false);
    }
    expect(isHeroTab("settings")).toBe(false);
    expect(isLibraryTab("settings")).toBe(false);
    expect(isHeroTab("create")).toBe(false);
    expect(isLibraryTab("create")).toBe(false);
  });
});
