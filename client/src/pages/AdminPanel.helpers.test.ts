import { describe, expect, it } from "vitest";
import { removeAutoReply, replaceRule, toggleAutoReply, toggleRule } from "./AdminPanel.helpers";

describe("Admin panel configuration helpers", () => {
  it("edits a rule without mutating other rules", () => {
    const rules = [{ id: "1", text: "Regra antiga", enabled: true }, { id: "2", text: "Outra", enabled: true }];
    expect(replaceRule(rules, "1", "Regra nova")).toEqual([{ id: "1", text: "Regra nova", enabled: true }, { id: "2", text: "Outra", enabled: true }]);
    expect(rules[0].text).toBe("Regra antiga");
  });

  it("toggles one rule independently", () => {
    const rules = [{ id: "1", text: "Regra", enabled: true }, { id: "2", text: "Outra", enabled: false }];
    expect(toggleRule(rules, "1")).toEqual([{ id: "1", text: "Regra", enabled: false }, { id: "2", text: "Outra", enabled: false }]);
  });

  it("toggles one auto reply and preserves the others", async () => {
    const replies = [{ trigger: "oi", response: "Olá", enabled: true }, { trigger: "tchau", response: "Até", enabled: false }];
    expect(toggleAutoReply(replies, "oi")[0].enabled).toBe(false);
    expect(toggleAutoReply(replies, "oi")[1].enabled).toBe(false);
  });

  it("removes only the selected auto reply", () => {
    const replies = [{ trigger: "oi", response: "Olá", enabled: true }, { trigger: "tchau", response: "Até", enabled: true }];
    expect(removeAutoReply(replies, "oi")).toEqual([{ trigger: "tchau", response: "Até", enabled: true }]);
  });
});
