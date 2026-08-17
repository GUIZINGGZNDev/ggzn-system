import { describe, expect, it, vi } from "vitest";
import { cloneWhatsAppGroup } from "./groupClone";

function makeSocket() {
  return {
    user: { id: "999@s.whatsapp.net" },
    groupMetadata: vi.fn().mockResolvedValue({
      id: "source@g.us",
      subject: "Grupo Original",
      desc: "Descrição original",
      participants: [
        { id: "111@s.whatsapp.net", admin: "admin" },
        { id: "222@s.whatsapp.net", admin: null },
        { id: "999@s.whatsapp.net", admin: "admin" },
      ],
      announce: true,
      restrict: true,
      memberAddMode: false,
      joinApprovalMode: false,
      ephemeralDuration: 86400,
    }),
    groupCreate: vi.fn().mockResolvedValue({ id: "clone@g.us" }),
    groupUpdateDescription: vi.fn().mockResolvedValue(undefined),
    profilePictureUrl: vi.fn().mockResolvedValue("https://example.com/group.jpg"),
    updateProfilePicture: vi.fn().mockResolvedValue(undefined),
    groupParticipantsUpdate: vi.fn().mockResolvedValue(undefined),
    groupSettingUpdate: vi.fn().mockResolvedValue(undefined),
    groupMemberAddMode: vi.fn().mockResolvedValue(undefined),
    groupToggleEphemeral: vi.fn().mockResolvedValue(undefined),
    groupJoinApprovalMode: vi.fn().mockResolvedValue(undefined),
  } as never;
}

describe("cloneWhatsAppGroup", () => {
  it("copies metadata, available members, permissions and reports the new JID", async () => {
    const sock = makeSocket();
    const result = await cloneWhatsAppGroup(sock, "source@g.us", { includeParticipants: true, copyPermissions: true });

    expect(result.newJid).toBe("clone@g.us");
    expect(result.name).toBe("Grupo Original");
    expect(result.copied).toEqual(expect.arrayContaining(["nome", "descrição", "foto", "participantes disponíveis", "permissão de mensagens", "permissão de configurações"]));
    expect(sock.groupCreate).toHaveBeenCalledWith("Grupo Original", ["111@s.whatsapp.net", "222@s.whatsapp.net"]);
    expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith("clone@g.us", ["111@s.whatsapp.net"], "promote");
    expect(sock.groupSettingUpdate).toHaveBeenCalled();
  });

  it("does not copy permissions or administrator roles when disabled", async () => {
    const sock = makeSocket();
    const result = await cloneWhatsAppGroup(sock, "source@g.us", { includeParticipants: true, copyPermissions: false });

    expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
    expect(sock.groupSettingUpdate).not.toHaveBeenCalled();
    expect(result.skipped).toEqual(expect.arrayContaining(["administradores (opção sem permissões)", "permissões e configurações de acesso (opção sem permissões)"]));
  });

  it("can clone only the group shell when member inclusion is disabled", async () => {
    const sock = makeSocket();
    const result = await cloneWhatsAppGroup(sock, "source@g.us", { includeParticipants: false, copyPermissions: false });

    expect(sock.groupCreate).toHaveBeenCalledWith("Grupo Original", []);
    expect(result.skipped).toContain("participantes (opção desativada)");
    expect(sock.groupParticipantsUpdate).not.toHaveBeenCalled();
  });
});
