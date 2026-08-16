import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: any, res: any) => Promise<void> | void;

type ResponseMock = { code: number; body?: unknown; status: (code: number) => ResponseMock; json: (body: unknown) => void };

function responseMock(): ResponseMock {
  const response = {
    code: 200,
    body: undefined as unknown,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; },
  };
  return response;
}

describe("GGZN transport route contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BOT_PAIRING_MAINTENANCE = "false";
    process.env.JWT_SECRET = "test-owner-token";
    vi.doMock("./manager", () => ({
      getBotState: () => ({ phone: "5534991286637", status: "needs_pairing", qrDataUrl: "data:image/png;base64,TESTQR" }),
      getPhone: () => "5534991286637",
      startBot: vi.fn(async () => undefined),
    }));
  });

  afterEach(() => {
    vi.doUnmock("./manager");
    delete process.env.BOT_PAIRING_MAINTENANCE;
  });

  it("returns no QR from the disabled numeric endpoint", async () => {
    const { registerBotRoutes } = await import("./routes");
    const handlers = new Map<string, Handler>();
    registerBotRoutes({ get: (path: string, handler: Handler) => handlers.set(path, handler), post: () => undefined } as any);
    const response = responseMock();
    await handlers.get("/api/bot/pairing")?.({}, response);
    expect(response.code).toBe(410);
    expect(JSON.stringify(response.body)).not.toContain("qrDataUrl");
  });

  it("returns QR only from the authorized QR endpoint", async () => {
    const { registerBotRoutes } = await import("./routes");
    const handlers = new Map<string, Handler>();
    registerBotRoutes({ get: (path: string, handler: Handler) => handlers.set(path, handler), post: () => undefined } as any);
    const response = responseMock();
    await handlers.get("/api/bot/qr")?.({ headers: { "x-ggzn-owner-token": "test-owner-token" } }, response);
    expect(response.code).toBe(200);
    expect((response.body as { qrDataUrl?: string }).qrDataUrl).toBe("data:image/png;base64,TESTQR");
  });
});
