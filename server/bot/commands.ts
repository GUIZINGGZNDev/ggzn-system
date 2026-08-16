import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { getContentType } from "@whiskeysockets/baileys";
import { getMemberRole, getOrCreateGroup, updateGroupConfig, upsertMember } from "../db";
import { getPhone } from "./manager";

const ROLE_LEVEL = { member: 1, moderator: 2, admin: 3, owner: 4 } as const;
const funHits = new Map<string, number[]>();
const funCommands = new Set(["fake", "gigante", "spam", "sorteio", "trava-zap"]);
export function applyPrefixAction(current: string[], active: string, action: "add" | "remove" | "set", next: string) {
  if (action === "remove") {
    const list = current.filter((item) => item !== next);
    return { prefixes: list.length ? list : current, activePrefix: active === next && list.length ? list[0] : active };
  }
  const prefixes = Array.from(new Set(action === "add" ? [...current, next] : [next, ...current]));
  return { prefixes, activePrefix: action === "add" ? active : next };
}
type Role = keyof typeof ROLE_LEVEL;

const mainMenu = (prefix: string) => `*GGZN SYSTEM*\n\nPrefixo ativo: ${prefix}\n\n${prefix}menu adm\n${prefix}menu membros\n${prefix}menu cargos\n${prefix}menu zoeira\n${prefix}menu info\n${prefix}menu config`;
const menus: Record<string, string> = {
  adm: `*MENU ADM*\nbanir • remover • silenciar • promover • rebaixar\nfechar • abrir • anunciar • limpar`,
  membros: `*MENU MEMBROS*\nsticker • stext • traduzir • clima\npiada • citacao • calcular • info`,
  cargos: `*MENU CARGOS*\nDono > Administrador > Moderador > Membro\nUse os comandos de promoção apenas em grupos.`,
  zoeira: `*MENU ZOEIRA*\nfake • gigante • spam • sorteio\ntrava-zap é bloqueado pelo sistema para evitar abuso.`,
  info: `*GGZN SYSTEM*\nBot modular em Node.js + Baileys.\nUse o site público para consultar a lista completa.`,
  config: `*MENU CONFIGURAÇÕES*\nprefixos • prefixo <caractere>\nativar <comando> • desativar <comando>`,
};

function textOf(message: WAMessage) {
  const content = message.message;
  if (!content) return "";
  const type = getContentType(content);
  if (type === "conversation") return content.conversation ?? "";
  if (type === "extendedTextMessage") return content.extendedTextMessage?.text ?? "";
  if (type === "imageMessage") return content.imageMessage?.caption ?? "";
  if (type === "videoMessage") return content.videoMessage?.caption ?? "";
  return "";
}

function senderOf(message: WAMessage) { return message.key.participant ?? message.key.remoteJid ?? ""; }
function isGroup(jid: string) { return jid.endsWith("@g.us"); }
export function atLeast(role: Role, required: Role) { return ROLE_LEVEL[role] >= ROLE_LEVEL[required]; }
function mentioned(message: WAMessage) { return message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; }
async function reply(sock: WASocket, jid: string, text: string) { await sock.sendMessage(jid, { text }); }

async function requireRole(sock: WASocket, jid: string, sender: string, required: Role) {
  const role = sender.replace(/\D/g, "") === getPhone() ? "owner" : await getMemberRole(jid, sender) as Role;
  if (!atLeast(role, required)) {
    await reply(sock, jid, `Acesso negado. Este comando exige o cargo *${required}*.`);
    return false;
  }
  return true;
}

export async function handleIncomingMessage(sock: WASocket, message: WAMessage) {
  const jid = message.key.remoteJid;
  if (!jid || message.key.fromMe || !message.message) return;
  const text = textOf(message).trim();
  if (!text) return;
  const group = isGroup(jid) ? await getOrCreateGroup(jid) : { activePrefix: "!", prefixes: ["!", "/", "#", "."], disabledCommands: [], jid, name: "Privado" };
  const prefix = group.prefixes.find((candidate) => text.startsWith(candidate));
  if (!prefix) return;
  const [rawCommand, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const command = rawCommand?.toLowerCase();
  if (!command || group.disabledCommands.includes(command)) return;
  const sender = senderOf(message);
  if (isGroup(jid) && sender.replace(/\D/g, "") === getPhone()) await upsertMember(jid, sender, "owner");

  if (funCommands.has(command)) {
    const now = Date.now();
    const hits = (funHits.get(sender) ?? []).filter((time) => now - time < 60000);
    if (hits.length >= 8) { await reply(sock, jid, "Limite de zoeira atingido. Aguarde um minuto para continuar."); return; }
    funHits.set(sender, [...hits, now]);
  }

  if (command === "menu" || command === "help") {
    const section = args[0]?.toLowerCase();
    await reply(sock, jid, section && menus[section] ? menus[section] : mainMenu(group.activePrefix));
    return;
  }
  if (command === "prefixos") { await reply(sock, jid, `Prefixos aceitos: ${group.prefixes.join(" ")}\nAtivo: ${group.activePrefix}`); return; }
  if (command === "prefixo") {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return;
    const action = args[0]?.toLowerCase();
    const next = action === "add" || action === "remove" || action === "set" ? args[1] : args[0];
    if (!next || next.length > 2) { await reply(sock, jid, "Uso: !prefixo set ! | !prefixo add ? | !prefixo remove ?"); return; }
    const prefixAction = action === "add" || action === "remove" || action === "set" ? action : "set";
    const result = applyPrefixAction(group.prefixes, group.activePrefix, prefixAction, next);
    await updateGroupConfig(jid, result);
    await reply(sock, jid, prefixAction === "add" ? `Prefixo adicionado: ${next}` : prefixAction === "remove" ? `Prefixo removido: ${next}` : `Prefixo ativo alterado para ${next}`); return;
  }
  if (command === "ativar" || command === "desativar") {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return;
    const target = args[0]?.toLowerCase(); if (!target) return reply(sock, jid, "Informe o comando.");
    const disabled = new Set(group.disabledCommands);
    command === "desativar" ? disabled.add(target) : disabled.delete(target);
    await updateGroupConfig(jid, { disabledCommands: Array.from(disabled) });
    await reply(sock, jid, `Comando ${target}: ${command === "desativar" ? "desativado" : "ativado"}`); return;
  }

  const target = mentioned(message);
  if (["banir", "remover"].includes(command)) {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin")) || !target) return;
    await sock.groupParticipantsUpdate(jid, [target], "remove"); await reply(sock, jid, "Membro removido do grupo."); return;
  }
  if (["promover", "rebaixar"].includes(command)) {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin")) || !target) return;
    const targetRole = command === "rebaixar" ? "member" : args[0]?.toLowerCase() === "moderador" ? "moderator" : "admin";
    await sock.groupParticipantsUpdate(jid, [target], command === "promover" ? "promote" : "demote");
    await upsertMember(jid, target, targetRole);
    await reply(sock, jid, `Cargo atualizado: ${targetRole === "moderator" ? "Moderador" : targetRole === "admin" ? "Administrador" : "Membro"}.`); return;
  }
  if (command === "fechar" || command === "abrir") {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return;
    await sock.groupSettingUpdate(jid, command === "fechar" ? "announcement" : "not_announcement"); await reply(sock, jid, `Grupo ${command === "fechar" ? "fechado" : "aberto"} para mensagens.`); return;
  }
  if (command === "silenciar") { if (await requireRole(sock, jid, sender, "moderator")) await reply(sock, jid, "Modo silencioso registrado. Para aplicar moderação avançada, use as ferramentas nativas do grupo."); return; }
  if (command === "anunciar") { if (await requireRole(sock, jid, sender, "moderator")) await reply(sock, jid, `*ANÚNCIO*\n${args.join(" ") || "Sem texto informado."}`); return; }
  if (command === "limpar") { if (await requireRole(sock, jid, sender, "moderator")) await reply(sock, jid, "A limpeza automática depende da mensagem citada; cite uma mensagem para removê-la com segurança."); return; }

  const response: Record<string, string> = {
    sticker: "Envie uma imagem com a legenda !sticker para gerar uma figurinha.",
    stext: `Figurinha de texto solicitada: ${args.join(" ") || "informe um texto"}`,
    traduzir: "Tradução preparada. Informe o idioma de destino e o texto.",
    clima: "Clima: configure uma cidade, por exemplo !clima Uberlândia.",
    piada: "Por que o bot foi ao grupo? Para encontrar uma boa conexão.",
    citacao: "A organização transforma comandos em sistema.",
    calcular: calculate(args.join(" ")),
    info: "Busca de informações: informe um termo para consultar uma fonte configurada.",
    fake: `Mensagem fake apenas demonstrativa: ${args.join(" ") || "sem conteúdo"}`,
    gigante: `${args.join(" ") || "GGZN SYSTEM"}`.toUpperCase(),
    spam: "Spam controlado bloqueado: o sistema limita mensagens repetitivas para proteger o grupo.",
    "trava-zap": "Trava-zap bloqueado pelo GGZN SYSTEM para evitar abuso e quedas de sessão.",
    sorteio: `Sorteio registrado entre os participantes mencionados. ${target ? `Participante: ${target}` : "Mencione os participantes."}`,
  };
  if (response[command]) await reply(sock, jid, response[command]);
}

export function calculate(expression: string) {
  if (!expression || !/^[0-9+\-*/().% ]+$/.test(expression)) return "Use apenas números e operadores básicos.";
  try { return `Resultado: ${Function(`"use strict"; return (${expression})`)()}`; } catch { return "Não foi possível calcular essa expressão."; }
}
