import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadMediaMessage } = vi.hoisted(() => ({ downloadMediaMessage: vi.fn() }));
vi.mock("@whiskeysockets/baileys", () => ({
  downloadMediaMessage,
  getContentType: () => "imageMessage",
}));

import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { handleIncomingMessage, MEDIA_TIMEOUT_MS } from "./commands";

const socket = { sendMessage: vi.fn().mockResolvedValue(undefined) } as unknown as WASocket;
const imageMessage = (id: string) => ({ key: { remoteJid: "5511999999999@s.whatsapp.net", id }, message: { imageMessage: { caption: "!sticker" } } }) as unknown as WAMessage;

describe("GGZN sticker media flow", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("rejects a download that exceeds the media timeout", async () => {
    vi.useFakeTimers();
    downloadMediaMessage.mockReturnValueOnce(new Promise(() => undefined));
    const pending = handleIncomingMessage(socket, imageMessage("download-timeout"));
    const assertion = expect(pending).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(MEDIA_TIMEOUT_MS);
    await assertion;
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

  it("fails WebP conversion for invalid media before sending a sticker", async () => {
    downloadMediaMessage.mockResolvedValueOnce(Buffer.from("not-an-image"));
    await expect(handleIncomingMessage(socket, imageMessage("invalid-media"))).rejects.toBeTruthy();
    expect(socket.sendMessage).not.toHaveBeenCalled();
  });
});
