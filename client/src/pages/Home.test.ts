import { describe, expect, it } from "vitest";
import { getStatusPresentation, maskPhone } from "./Home";

describe("Home connection status helpers", () => {
  it.each([
    ["connected", "ATIVO"],
    ["connecting", "CONECTANDO"],
    ["needs_pairing", "AGUARDANDO VÍNCULO"],
    ["offline", "OFFLINE"],
  ])("maps %s to the visible label %s", (status, label) => {
    expect(getStatusPresentation(status).label).toBe(label);
  });

  it("falls back to offline for an unknown status", () => {
    expect(getStatusPresentation("unexpected").label).toBe("OFFLINE");
  });

  it("masks the WhatsApp number while preserving its country and ending digits", () => {
    expect(maskPhone("5534991286637")).toBe("5534 •••• 6637");
    expect(maskPhone()).toBe("5534 •••• 6637");
  });
});
