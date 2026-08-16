import { describe, expect, it, vi } from "vitest";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { applyPrefixAction, atLeast, calculate, getMainMenu, getMenu, handleIncomingMessage, MENU_NUMBER_MAP, moderationEffect, requiredRoleForCommand, safeZoeiraResponse, withTimeout, MEDIA_TIMEOUT_MS } from "./commands";
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

  it("exposes separated menus with one described command per line", () => {
    const admMenu = getMenu("adm", "#");
    const memberMenu = getMenu("membros", "?");
    expect(admMenu).toContain("MENU ADM");
    expect(admMenu).toContain("#banir @membro — remove definitivamente um membro");
    expect(admMenu).toContain("Requisito: Moderador para silenciar/anunciar/limpar.");
    expect(admMenu.split("\\n").length).toBeGreaterThan(12);
    expect(memberMenu).toContain("?sticker — converte a imagem enviada em figurinha");
    expect(memberMenu).toContain("?clima cidade — consulta o clima");
    expect(getMenu("inexistente")).toBeUndefined();
  });

  it("covers the GGZN CORPORATION panel and categories with dynamic prefixes", () => {
    const main = getMainMenu("$");
    expect(main).toContain("│     GGZN CORPORATION     │");
    expect(main).toContain("$menu 1 / ADM");
    expect(main).toContain("$menu 7 / IA / AUTO RESPONDER");
    expect(main).toContain("Exemplo: $menu 1");
    expect(main.split("\\n").length).toBeGreaterThan(18);
    expect(getMenu("mod", "$")).toContain("$silenciar — fecha o grupo para membros");
    expect(getMenu("site", "$")).toContain("Site oficial:");
    expect(getMenu("textos", "$")).toContain("$stext frase — cria figurinha com texto");
    expect(getMenu("ia", "$")).toContain("$traduzir pt texto — traduz texto para português");
  });

  it("supports the seven GGZN CORPORATION numeric menu options", () => {
    const main = getMainMenu("!");
    expect(main).toContain("!menu 4 / MODERAÇÃO / MOD");
    expect(main).toContain("!menu 5 / SITE OFC");
    expect(MENU_NUMBER_MAP["1"]).toBe("adm");
    expect(MENU_NUMBER_MAP["2"]).toBe("zoeira");
    expect(MENU_NUMBER_MAP["7"]).toBe("ia");
    expect(getMenu("adm", "!")).toContain("MENU ADM");
    expect(getMenu("zoeira", "!")).toContain("MENU ZOEIRA");
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

  it("bounds media processing with an explicit timeout", async () => {
    expect(MEDIA_TIMEOUT_MS).toBe(7000);
    await expect(withTimeout(new Promise((resolve) => setTimeout(resolve, 25)), 5)).rejects.toThrow("timeout");
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

  it("processes a burst of simple commands without serializing replies", async () => {
    const socket = mockSocket();
    const startedAt = performance.now();
    await Promise.all(Array.from({ length: 20 }, (_, index) => handleIncomingMessage(socket, ownerMessage(`!piada ${index}`))));
    expect(socket.sendMessage).toHaveBeenCalledTimes(20);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it("compares local and external command telemetry explicitly", async () => {
    const socket = mockSocket();
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => "São Paulo: 20°C" });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
    try {
      await handleIncomingMessage(socket, ownerMessage("!piada"));
      await handleIncomingMessage(socket, ownerMessage("!clima São Paulo"));
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[GGZN][message][sent]"));
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[GGZN][external][clima]"));
      expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("São Paulo") }));
    } finally {
      infoSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("sends explicit safe responses for spam, trava-zap and fake", async () => {
    for (const command of ["spam", "trava-zap", "fake"]) {
      const socket = mockSocket();
      await handleIncomingMessage(socket, ownerMessage(`!${command}`));
      expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.any(String) }));
    }
  });
});
