import { describe, expect, it } from "vitest";
import { issuePairingCode, pairingCodeIsActive, singleFlight, shouldRetryConnection } from "./manager";

describe("GGZN pairing lifecycle", () => {
  it("recognizes an active and expired code", () => {
    expect(pairingCodeIsActive(2000, 1000)).toBe(true);
    expect(pairingCodeIsActive(1000, 1000)).toBe(false);
  });

  it("replaces an expired code with a new issued code", () => {
    const oldCode = issuePairingCode("OLD11111", 1000);
    const newCode = issuePairingCode("NEW22222", 70000);
    expect(pairingCodeIsActive(oldCode.pairingExpiresAt, 70000)).toBe(false);
    expect(newCode.pairingCode).not.toBe(oldCode.pairingCode);
    expect(newCode.pairingExpiresAt).toBeGreaterThan(newCode.pairingIssuedAt);
  });

  it("limits reconnect attempts after a replaced connection", () => {
    expect(shouldRetryConnection(440, true, 0)).toBe(true);
    expect(shouldRetryConnection(440, true, 2)).toBe(true);
    expect(shouldRetryConnection(440, true, 3)).toBe(false);
    expect(shouldRetryConnection(440, false, 0)).toBe(false);
    expect(shouldRetryConnection(401, true, 0)).toBe(false);
  });

  it("shares one in-flight generation between concurrent callers", async () => {
    const holder: { pending?: Promise<string> } = {};
    let calls = 0;
    const task = () => new Promise<string>((resolve) => { calls += 1; setTimeout(() => resolve("NEWCODE1"), 5); });
    const [first, second] = await Promise.all([singleFlight(holder, task), singleFlight(holder, task)]);
    expect(first).toBe("NEWCODE1");
    expect(second).toBe("NEWCODE1");
    expect(calls).toBe(1);
  });
});
