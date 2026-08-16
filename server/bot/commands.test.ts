import { describe, expect, it, vi } from "vitest";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { applyPrefixAction, atLeast, calculate, getMenu, handleIncomingMessage, moderationEffect, requiredRoleForCommand, safeZoeiraResponse } from "./commands";
import { getOrCreateGroup } from "../db";

function ownerMessage(text: string, quoted = false) {
  return {
    key: { remoteJid: "test-handler@g.us", participant: "5534991286637@s.whatsapp.net", fromMe: false, id: "msg-1" },
    message: quoted ? { extendedTextMessage: { text, contextInfo: { stanzaId: "quoted-1", participant: "5511999999999@s.whatsapp.net" } } } : { conversation: text },
  } as unknown as WAMessage;
}
function mockSocket() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    groupSettingUpdate: vi.fn().mockResolvedValue(undefined),
    groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
  } as unknown as WASocket & { sendMessage: ReturnType<typeof vi.fn>; groupSettingUpdate: ReturnType<typeof vi.fn> };
}

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

  it("exposes the separated menus", () => {
    expect(getMenu("adm")).toContain("MENU ADM");
    expect(getMenu("membros")).toContain("MENU MEMBROS");
    expect(getMenu("inexistente")).toBeUndefined();
  });

  it("assigns safe permission levels and effects to moderation commands", () => {
    expect(requiredRoleForCommand("silenciar")).toBe("moderator");
    expect(requiredRoleForCommand("limpar")).toBe("moderator");
    expect(requiredRoleForCommand("banir")).toBe("admin");
    expect(requiredRoleForCommand("piada")).toBe("member");
    expect(moderationEffect("silenciar")).toBe("announcement");
    expect(moderationEffect("limpar")).toBe("delete-quoted");
  });

  it("blocks destructive zoeira commands explicitly", () => {
    expect(safeZoeiraResponse("spam")).toContain("bloqueado");
    expect(safeZoeiraResponse("trava-zap")).toContain("bloqueado");
    expect(safeZoeiraResponse("fake")).toContain("sem atribuição real");
  });

  it("returns safe defaults when database is not configured", async () => {
    const config = await getOrCreateGroup("123@g.us", "Grupo teste");
    expect(config.activePrefix).toBe("!");
    expect(config.prefixes).toEqual(["!", "/", "#", "."]);
    expect(config.disabledCommands).toEqual([]);
  });
});

describe("GGZN message handler", () => {
  it("silences the group through announcement mode", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!silenciar"));
    expect(socket.groupSettingUpdate).toHaveBeenCalledWith("test-handler@g.us", "announcement");
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("Grupo silenciado") }));
  });

  it("deletes a quoted message for limpar", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!limpar", true));
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ delete: expect.objectContaining({ id: "quoted-1" }) }));
  });

  it("sends explicit safe responses for spam, trava-zap and fake", async () => {
    for (const command of ["spam", "trava-zap", "fake"]) {
      const socket = mockSocket();
      await handleIncomingMessage(socket, ownerMessage(`!${command}`));
      expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.any(String) }));
    }
  });
});
