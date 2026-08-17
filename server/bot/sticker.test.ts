import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadMediaMessage } = vi.hoisted(() => ({ downloadMediaMessage: vi.fn() }));
vi.mock("@whiskeysockets/baileys", () => ({
  downloadMediaMessage,
  getContentType: (content: Record<string, unknown>) => Object.keys(content)[0],
}));

import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { handleIncomingMessage, MEDIA_TIMEOUT_MS } from "./commands";

const socket = { sendMessage: vi.fn().mockResolvedValue(undefined) } as unknown as WASocket;
const imageMessage = (id: string, command = "!sticker") => ({ key: { remoteJid: "5511999999999@s.whatsapp.net", id }, message: { imageMessage: { caption: command } } }) as unknown as WAMessage;
const quotedImageMessage = (id: string, command = "!s") => ({ key: { remoteJid: "5511999999999@s.whatsapp.net", id }, message: { extendedTextMessage: { text: command, contextInfo: { quotedMessage: { imageMessage: { caption: "imagem original" } } } } } }) as unknown as WAMessage;

describe("GGZN sticker media flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a clear response when a download exceeds the media timeout", async () => {
    vi.useFakeTimers();
    downloadMediaMessage.mockReturnValueOnce(new Promise(() => undefined));
    const pending = handleIncomingMessage(socket, imageMessage("download-timeout"));
    await vi.advanceTimersByTimeAsync(MEDIA_TIMEOUT_MS);
    await pending;
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ text: expect.stringContaining("Não consegui gerar a figurinha") }));
    vi.useRealTimers();
  });

  it("logs download, conversion and send stages for a valid sticker", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    downloadMediaMessage.mockResolvedValueOnce(Buffer.from('<svg width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>'));
    await handleIncomingMessage(socket, imageMessage("valid-media"));
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ sticker: expect.any(Buffer) }));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[GGZN][external][sticker-download]"));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("[GGZN][external][sticker-conversion]"));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("type=sticker"));
    infoSpy.mockRestore();
  });

  it("accepts the !s alias when citing an image", async () => {
    downloadMediaMessage.mockResolvedValueOnce(Buffer.from('<svg width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>'));
    await handleIncomingMessage(socket, quotedImageMessage("quoted-alias"));
    expect(downloadMediaMessage).toHaveBeenCalled();
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ sticker: expect.any(Buffer) }));
  });

  it("avoids duplicate sticker work while a group is processing", async () => {
    let resolveMedia!: (value: Buffer) => void;
    downloadMediaMessage.mockReturnValueOnce(new Promise<Buffer>((resolve) => { resolveMedia = resolve; }));
    const first = handleIncomingMessage(socket, imageMessage("busy-first"));
    const second = handleIncomingMessage(socket, imageMessage("busy-second"));
    await Promise.resolve();
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ text: expect.stringContaining("Já estou processando") }));
    resolveMedia(Buffer.from('<svg width="32" height="32"><rect width="32" height="32" fill="lime"/></svg>'));
    await first;
    await second;
  });

  it("returns a clear response when sticker has no image", async () => {
    const noMediaMessage = { key: { remoteJid: "5511999999999@s.whatsapp.net", id: "no-media" }, message: { conversation: "!s" } } as unknown as WAMessage;
    await handleIncomingMessage(socket, noMediaMessage);
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ text: expect.stringContaining("Envie ou cite uma imagem") }));
  });

  it("returns a clear response when WebP conversion fails", async () => {
    downloadMediaMessage.mockResolvedValueOnce(Buffer.from("not-an-image"));
    await handleIncomingMessage(socket, imageMessage("invalid-media"));
    expect(socket.sendMessage).toHaveBeenCalledWith("5511999999999@s.whatsapp.net", expect.objectContaining({ text: expect.stringContaining("Não consegui gerar a figurinha") }));
  });
});
