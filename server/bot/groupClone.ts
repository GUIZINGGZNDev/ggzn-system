import type { WASocket } from "@whiskeysockets/baileys";
import { getOrCreateGroup, updateGroupConfig } from "../db";

type CloneOptions = {
  includeParticipants: boolean;
};

export type CloneResult = {
  sourceJid: string;
  newJid: string;
  name: string;
  copied: string[];
  skipped: string[];
  failedParticipants: string[];
};

function cleanParticipantJid(jid: string) {
  return jid.replace(/:\d+(?=@)/, "");
}

export async function cloneWhatsAppGroup(sock: WASocket, sourceJid: string, options: CloneOptions): Promise<CloneResult> {
  if (!sourceJid.endsWith("@g.us")) throw new Error("Informe um JID de grupo válido.");
  const source = await sock.groupMetadata(sourceJid);
  const selfJid = cleanParticipantJid(sock.user?.id ?? "");
  const sourceParticipants = source.participants.map((participant) => cleanParticipantJid(participant.id)).filter((jid) => jid && jid !== selfJid);
  const initialParticipants = options.includeParticipants ? sourceParticipants.slice(0, 256) : [];
  const created = await sock.groupCreate(source.subject || "GGZN CLONE", initialParticipants);
  const newJid = created.id;
  if (!newJid) throw new Error("O WhatsApp não retornou o JID do novo grupo.");

  const copied: string[] = ["nome"];
  const skipped: string[] = [];
  const failedParticipants: string[] = [];

  try {
    if (source.desc) {
      await sock.groupUpdateDescription(newJid, source.desc);
      copied.push("descrição");
    } else skipped.push("descrição vazia");
  } catch { skipped.push("descrição"); }

  try {
    const imageUrl = await sock.profilePictureUrl(sourceJid, "image");
    if (imageUrl) {
      await sock.updateProfilePicture(newJid, { url: imageUrl });
      copied.push("foto");
    }
  } catch { skipped.push("foto (indisponível ou protegida)"); }

  if (options.includeParticipants) {
    const sourceByJid = new Map(source.participants.map((participant) => [cleanParticipantJid(participant.id), participant]));
    for (const participant of sourceParticipants.slice(0, 256)) {
      const sourceParticipant = sourceByJid.get(participant);
      if (!sourceParticipant?.admin) continue;
      try {
        await sock.groupParticipantsUpdate(newJid, [participant], "promote");
      } catch { failedParticipants.push(participant); }
    }
    if (sourceParticipants.length > 256) skipped.push(`${sourceParticipants.length - 256} membros além do limite seguro de 256`);
    copied.push("participantes disponíveis");
    copied.push("administradores disponíveis");
  } else {
    skipped.push("participantes (opção desativada)");
  }

  try {
    if (source.announce !== undefined) {
      await sock.groupSettingUpdate(newJid, source.announce ? "announcement" : "not_announcement");
      copied.push("permissão de mensagens");
    }
    if (source.restrict !== undefined) {
      await sock.groupSettingUpdate(newJid, source.restrict ? "locked" : "unlocked");
      copied.push("permissão de configurações");
    }
  } catch { skipped.push("permissões do grupo"); }

  try {
    if (source.memberAddMode !== undefined) {
      await sock.groupMemberAddMode(newJid, source.memberAddMode ? "all_member_add" : "admin_add");
      copied.push("permissão de adicionar membros");
    }
  } catch { skipped.push("permissão de adicionar membros"); }

  try {
    if (source.ephemeralDuration !== undefined) {
      await sock.groupToggleEphemeral(newJid, source.ephemeralDuration);
      copied.push("mensagens temporárias");
    }
  } catch { skipped.push("mensagens temporárias"); }

  try {
    if (source.joinApprovalMode !== undefined) {
      await sock.groupJoinApprovalMode(newJid, source.joinApprovalMode ? "on" : "off");
      copied.push("aprovação de entrada");
    }
  } catch { skipped.push("aprovação de entrada"); }

  const sourceConfig = await getOrCreateGroup(sourceJid, source.subject || "Grupo sem nome");
  await updateGroupConfig(newJid, {
    name: sourceConfig.name || source.subject,
    activePrefix: sourceConfig.activePrefix,
    prefixes: sourceConfig.prefixes,
    disabledCommands: sourceConfig.disabledCommands,
    rules: sourceConfig.rules,
    autoReplies: sourceConfig.autoReplies,
    joinMessages: sourceConfig.joinMessages,
    featureConfig: sourceConfig.featureConfig,
  });
  copied.push("configurações do GGZN");

  return { sourceJid, newJid, name: source.subject, copied, skipped, failedParticipants };
}
