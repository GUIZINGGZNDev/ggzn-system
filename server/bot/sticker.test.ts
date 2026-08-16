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

  it("fails WebP conversion for invalid media before sending a sticker", async () => {
    downloadMediaMessage.mockResolvedValueOnce(Buffer.from("not-an-image"));
    await expect(handleIncomingMessage(socket, imageMessage("invalid-media"))).rejects.toBeTruthy();
    expect(socket.sendMessage).not.toHaveBeenCalled();
  });
});
