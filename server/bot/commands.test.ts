import { describe, expect, it, vi } from "vitest";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { applyPrefixAction, atLeast, calculate, formatJoinMessage, getMainMenu, getMenu, handleGroupParticipantsUpdate, handleIncomingMessage, MENU_NUMBER_MAP, moderationEffect, parseReminderDelay, requiredRoleForCommand, safeZoeiraResponse, withTimeout, MEDIA_TIMEOUT_MS } from "./commands";
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
    sendPresenceUpdate: vi.fn().mockResolvedValue(undefined),
  } as unknown as WASocket & { sendMessage: ReturnType<typeof vi.fn>; groupSettingUpdate: ReturnType<typeof vi.fn>; sendPresenceUpdate: ReturnType<typeof vi.fn> };
}

describe("GGZN command permissions", () => {
  it("parses safe reminder durations", () => {
    expect(parseReminderDelay("10m")).toBe(600000);
    expect(parseReminderDelay("2h")).toBe(7200000);
    expect(parseReminderDelay("20s")).toBeUndefined();
    expect(parseReminderDelay("10d")).toBeUndefined();
  });

  it("renders safe placeholders for join messages", () => {
    expect(formatJoinMessage("Olá {nome}, bem-vindo ao {grupo}! {mention} {numero}", "5534999999999@s.whatsapp.net", "GGZN TESTE")).toBe("Olá @5534999999999, bem-vindo ao GGZN TESTE! @5534999999999 5534999999999");
  });

  it("sends a grouped welcome event with real mentions", async () => {
    const socket = mockSocket();
    await handleGroupParticipantsUpdate(socket, { id: "test-welcome@g.us", action: "add", participants: ["5534999999999@s.whatsapp.net"] });
    expect(socket.sendMessage).toHaveBeenCalledWith("test-welcome@g.us", expect.objectContaining({ mentions: ["5534999999999@s.whatsapp.net"], text: expect.stringContaining("BEM-VINDO") }));
  });
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
    expect(admMenu).toContain("#banir @membro");
    expect(admMenu).toContain("Requisito: Moderador para silenciar/anunciar/limpar.");
    expect(admMenu.split("\n").length).toBeGreaterThan(12);
    expect(memberMenu).toContain("?sticker");
    expect(memberMenu).toContain("?clima cidade");
    expect(getMenu("inexistente")).toBeUndefined();
  });

  it("matches the professional GGZN CORPORATION menu without explanations", () => {
    const expected = [
      "╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮",
      "┃       GGZN CORPORATION       ┃",
      "┃         MENU PRINCIPAL       ┃",
      "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
      "          PREFIXO: $",
      "",
      "┌─ CATEGORIAS ─────────────────┐",
      "│ 01 • ADM                     │",
      "│ 02 • ZOEIRA                  │",
      "│ 03 • INFO                    │",
      "│ 04 • MODERAÇÃO               │",
      "│ 05 • SITE OFICIAL            │",
      "│ 06 • TEXTOS                  │",
      "│ 07 • IA / AUTO-RESPONDER     │",
      "└──────────────────────────────┘",
      "",
      "┌─ ACESSOS ────────────────────┐",
      "│ $menu 1  •  $menu adm  │",
      "│ $menu 2  •  $menu zoeira │",
      "│ $menu 3  •  $menu info  │",
      "│ $menu 4  •  $menu mod   │",
      "│ $menu 5  •  $menu site  │",
      "│ $menu 6  •  $menu textos│",
      "│ $menu 7  •  $menu ia    │",
      "└──────────────────────────────┘",
    ].join("\n");
    expect(getMainMenu("$")).toBe(expected);
    expect(getMenu("mod", "$")).toContain("$silenciar");
    expect(getMenu("site", "$")).toContain("Site oficial:");
    expect(getMenu("textos", "$")).toContain("$stext frase");
    expect(getMenu("ia", "$")).toContain("$traduzir pt texto");
    expect(getMainMenu("$")).not.toContain("\\n");
    expect(getMenu("adm", "$")).not.toContain("\\n");
    expect(getMenu("adm1", "$")).not.toContain("\\n");
    expect(getMenu("mod1", "$")).not.toContain("\\n");
  });

  it("supports the seven GGZN CORPORATION numeric menu options", () => {
    const main = getMainMenu("!");
    expect(main).toContain("│ 04 • MODERAÇÃO               │");
    expect(main).toContain("│ !menu 5  •  !menu site  │");
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
  it("responds to a direct @bot mention without typing presence and with a bounded reply", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("@bot oi"));
    expect(socket.sendPresenceUpdate).not.toHaveBeenCalled();
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("GGZN SYSTEM online") }));
  });

  it("answers the new operational version command", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!versao"));
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("GGZN SYSTEM v1.0") }));
  });

  it("allows admins to toggle @bot mention replies without sending duplicate responses", async () => {
    const offSocket = mockSocket();
    await handleIncomingMessage(offSocket, ownerMessage("!auto menção off"));
    expect(offSocket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("desativada") }));
    const mutedSocket = mockSocket();
    await handleIncomingMessage(mutedSocket, ownerMessage("@bot oi"));
    expect(mutedSocket.sendMessage).not.toHaveBeenCalled();
    const onSocket = mockSocket();
    await handleIncomingMessage(onSocket, ownerMessage("!auto menção on"));
    expect(onSocket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("ativada") }));
  });
  it("supports the expanded utility and system command set", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!dado 1d6"));
    await handleIncomingMessage(socket, ownerMessage("!quiz"));
    await handleIncomingMessage(socket, ownerMessage("!uptime"));
    await handleIncomingMessage(socket, ownerMessage("!latencia"));
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringMatching(/DADO|Qual comando|Uptime|Latência/) }));
  });

  it("supports administrative feature configuration commands", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!antiflood on"));
    await handleIncomingMessage(socket, ownerMessage("!lock links"));
    await handleIncomingMessage(socket, ownerMessage("!slowmode 5"));
    expect(socket.sendMessage).toHaveBeenCalledWith("test-handler@g.us", expect.objectContaining({ text: expect.stringContaining("Slowmode") }));
  });

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

  it("normalizes ordinary handler replies to real line breaks", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!menu"));
    const sentText = socket.sendMessage.mock.calls[1]?.[1]?.text as string;
    expect(sentText).toContain("\n");
    expect(sentText).not.toContain("\\n");
  });

  it("sends static menu photos without typing presence and keeps full text", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!menu"));
    await handleIncomingMessage(socket, ownerMessage("!menu ia"));
    await handleIncomingMessage(socket, ownerMessage("!menu voltar"));
    expect(socket.sendPresenceUpdate).not.toHaveBeenCalled();
    expect(socket.sendMessage.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ image: expect.objectContaining({ url: expect.stringContaining("ggzn-menu-") }) }));
    expect(socket.sendMessage.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ text: expect.stringContaining("GGZN CORPORATION") }));
  });

  it("opens the internal admin and moderation submenus", async () => {
    for (const command of ["!menu adm 1", "!menu mod 1"]) {
      const socket = mockSocket();
      await handleIncomingMessage(socket, ownerMessage(command));
      const text = socket.sendMessage.mock.calls[1]?.[1]?.text as string;
      expect(text).toContain("MENU");
      expect(text).toContain("menu voltar");
    }
  });

  it("returns to the principal menu with menu voltar", async () => {
    const socket = mockSocket();
    await handleIncomingMessage(socket, ownerMessage("!menu voltar"));
    const text = socket.sendMessage.mock.calls[1]?.[1]?.text as string;
    expect(text).toContain("GGZN CORPORATION");
    expect(text).toContain("MENU PRINCIPAL");
  });

  it("persists custom rules and auto replies for the group owner", async () => {
    const addRule = mockSocket();
    await handleIncomingMessage(addRule, ownerMessage("!regras add Respeite o grupo"));
    expect(addRule.sendMessage.mock.calls[0]?.[1]?.text).toContain("Regra adicionada");

    const addAuto = mockSocket();
    await handleIncomingMessage(addAuto, ownerMessage("!auto add bom dia => Bom dia, GGZN!"));
    expect(addAuto.sendMessage.mock.calls[0]?.[1]?.text).toContain("Auto-resposta adicionada");

    const listAuto = mockSocket();
    await handleIncomingMessage(listAuto, ownerMessage("!auto listar"));
    expect(listAuto.sendMessage.mock.calls[0]?.[1]?.text).toContain("bom dia");
  });

  it("supports operational utility commands", async () => {
    for (const command of ["ping", "hora", "data", "id", "regras", "grupo", "status"]) {
      const socket = mockSocket();
      await handleIncomingMessage(socket, ownerMessage(`!${command}`));
      const text = socket.sendMessage.mock.calls[0]?.[1]?.text as string;
      expect(text).toBeTruthy();
      expect(text).not.toContain("\\n");
      if (command === "status") {
        expect(text).toContain("Status:");
        expect(text).toContain("Número:");
      }
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
