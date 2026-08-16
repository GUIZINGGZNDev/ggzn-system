import { afterEach, describe, expect, it } from "vitest";
import { isPairingMaintenance, publicPairingPayload, registerBotRoutes } from "./routes";

describe("GGZN pairing maintenance", () => {
  const previous = process.env.BOT_PAIRING_MAINTENANCE;

  afterEach(() => {
    if (previous === undefined) delete process.env.BOT_PAIRING_MAINTENANCE;
    else process.env.BOT_PAIRING_MAINTENANCE = previous;
  });

  it("blocks pairing by default", () => {
    delete process.env.BOT_PAIRING_MAINTENANCE;
    expect(isPairingMaintenance()).toBe(true);
  });

  it("allows explicit reactivation for a controlled migration test", () => {
    process.env.BOT_PAIRING_MAINTENANCE = "false";
    expect(isPairingMaintenance()).toBe(false);
  });

  it("never includes QR data in the numeric pairing payload", () => {
    const payload = publicPairingPayload("ABC12345", { phone: "5534991286637", status: "needs_pairing" });
    expect(payload.pairingCode).toBe("ABC12345");
    expect("qrDataUrl" in payload).toBe(false);
  });

  it("disables the numeric route and protects the QR route", async () => {
    process.env.BOT_PAIRING_MAINTENANCE = "false";
    const handlers = new Map<string, (req: any, res: any) => Promise<void> | void>();
    registerBotRoutes({ get: (path: string, handler: (req: any, res: any) => Promise<void> | void) => handlers.set(path, handler), post: () => undefined } as any);
    const response = { code: 200, body: undefined as unknown, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; } };
    await handlers.get("/api/bot/pairing")?.({}, response);
    expect(response.code).toBe(410);
    expect(JSON.stringify(response.body)).not.toContain("qrDataUrl");
    const qrResponse = { code: 200, body: undefined as unknown, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; } };
    await handlers.get("/api/bot/qr")?.({ headers: {} }, qrResponse);
    expect(qrResponse.code).toBe(403);
  });
});
