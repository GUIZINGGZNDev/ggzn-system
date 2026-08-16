import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const req = {} as never;
const res = { clearCookie: () => undefined } as never;

const user = (role: "admin" | "user") => ({
  id: 1,
  openId: `${role}-test`,
  name: role,
  email: null,
  loginMethod: null,
  role,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
});

describe("private bot admin router", () => {
  it("rejects anonymous access", async () => {
    const caller = appRouter.createCaller({ req, res, user: null });
    await expect(caller.botAdmin.listGroups()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects regular users", async () => {
    const caller = appRouter.createCaller({ req, res, user: user("user") });
    await expect(caller.botAdmin.listGroups()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows administrators to read group configuration", async () => {
    const caller = appRouter.createCaller({ req, res, user: user("admin") });
    await expect(caller.botAdmin.listGroups()).resolves.toBeInstanceOf(Array);
  });
});
