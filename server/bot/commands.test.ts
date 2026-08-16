import { describe, expect, it } from "vitest";
import { applyPrefixAction, atLeast, calculate } from "./commands";

describe("GGZN command permissions", () => {
  it("respects the role hierarchy", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("admin", "moderator")).toBe(true);
    expect(atLeast("moderator", "admin")).toBe(false);
    expect(atLeast("member", "member")).toBe(true);
  });

  it("calculates basic expressions without accepting arbitrary code", () => {
    expect(calculate("2 + 3 * 4")).toBe("Resultado: 14");
    expect(calculate("process.exit()".replace(".", " "))).toContain("apenas números");
    expect(calculate("10 / 0")).toBe("Resultado: Infinity");
  });

  it("manages group prefixes deterministically", () => {
    expect(applyPrefixAction(["!", "/"], "!", "add", "#")).toEqual({ prefixes: ["!", "/", "#"], activePrefix: "!" });
    expect(applyPrefixAction(["!", "/"], "!", "set", ".")).toEqual({ prefixes: [".", "!", "/"], activePrefix: "." });
    expect(applyPrefixAction(["!", "/"], "!", "remove", "!")).toEqual({ prefixes: ["/"], activePrefix: "/" });
  });
});
