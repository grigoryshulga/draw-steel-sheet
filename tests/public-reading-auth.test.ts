import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthGate } from "../src/views/AuthGate";

vi.mock("../src/lib/supabase", () => ({ supabaseEnabled: true, supabase: {} }));
vi.mock("../src/views/GuestApp", () => ({
  GUEST_TABS: ["codex", "reference", "catalog", "glossary"],
  GuestApp: () => "Public reader",
}));
afterEach(() => vi.unstubAllGlobals());

describe("reading while session validation is pending", () => {
  it.each(["codex/0801", "reference", "catalog/perks", "glossary"]) ("opens %s without waiting for auth", (route) => {
    vi.stubGlobal("window", { location: { hash: `#/${route}` } });
    const html = renderToStaticMarkup(createElement(AuthGate, { children: "Private workspace" }));
    expect(html).toContain("Public reader");
    expect(html).not.toContain("Private workspace");
    expect(html).not.toContain("Проверяем вход");
  });

  it("keeps the private sheet behind session validation", () => {
    vi.stubGlobal("window", { location: { hash: "#/sheet" } });
    const html = renderToStaticMarkup(createElement(AuthGate, { children: "Private workspace" }));
    expect(html).toContain("Проверяем вход");
    expect(html).not.toContain("Private workspace");
    expect(html).not.toContain("Public reader");
  });
});
