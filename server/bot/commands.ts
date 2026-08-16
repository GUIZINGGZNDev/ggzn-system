import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { downloadMediaMessage, getContentType } from "@whiskeysockets/baileys";
import sharp from "sharp";
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

export function getMenu(section?: string) { return section && menus[section] ? menus[section] : undefined; }
export function requiredRoleForCommand(command: string) { return ["silenciar", "limpar", "anunciar"].includes(command) ? "moderator" : ["banir", "remover", "promover", "rebaixar", "fechar", "abrir", "prefixo"].includes(command) ? "admin" : "member"; }
export function moderationEffect(command: string) { return command === "silenciar" ? "announcement" : command === "limpar" ? "delete-quoted" : "none"; }
export function safeZoeiraResponse(command: string) { if (command === "spam") return "Spam controlado bloqueado"; if (command === "trava-zap") return "Trava-zap bloqueado"; if (command === "fake") return "sem atribuição real"; return undefined; }

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
  if (command === "silenciar") {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "moderator"))) return;
    await sock.groupSettingUpdate(jid, "announcement");
    await reply(sock, jid, "Grupo silenciado: somente administradores podem enviar mensagens. Use !abrir para reabrir.");
    return;
  }
  if (command === "anunciar") { if (await requireRole(sock, jid, sender, "moderator")) await reply(sock, jid, `*ANÚNCIO*\n${args.join(" ") || "Sem texto informado."}`); return; }
  if (command === "sticker" && message.message?.imageMessage) {
    const media = await downloadMediaMessage(message, "buffer", {});
    const sticker = await sharp(media as Buffer).resize(512, 512, { fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toBuffer();
    await sock.sendMessage(jid, { sticker });
    return;
  }
  if (command === "stext") {
    const text = args.join(" ").slice(0, 80) || "GGZN SYSTEM";
    const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#050505"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-weight="900" font-size="58" fill="#d9ff57">${escapeXml(text)}</text></svg>`;
    const sticker = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
    await sock.sendMessage(jid, { sticker });
    return;
  }

  if (command === "clima") { await reply(sock, jid, await weather(args.join(" "))); return; }
  if (command === "traduzir") { await reply(sock, jid, await translate(args)); return; }
  if (command === "info") { await reply(sock, jid, await lookupInfo(args.join(" "))); return; }
  if (command === "limpar") {
    if (!(await requireRole(sock, jid, sender, "moderator"))) return;
    const quoted = message.message?.extendedTextMessage?.contextInfo;
    if (!quoted?.stanzaId) { await reply(sock, jid, "Cite a mensagem que deseja limpar."); return; }
    await sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: false, id: quoted.stanzaId, participant: quoted.participant } });
    return;
  }

  const response: Record<string, string> = {
    sticker: "Envie uma imagem com a legenda !sticker para gerar uma figurinha.",
    stext: "Use !stext com uma frase curta para gerar figurinha de texto.",
    traduzir: "Use !traduzir pt Hello world.",
    clima: "Consultando o clima...",
    piada: "Por que o bot foi ao grupo? Para encontrar uma boa conexão.",
    citacao: "A organização transforma comandos em sistema.",
    calcular: calculate(args.join(" ")),
    info: "Use !info com um termo de busca.",
    fake: `Mensagem encenada pelo GGZN SYSTEM — sem atribuição real: ${args.join(" ") || "sem conteúdo"}`,
    gigante: `${args.join(" ") || "GGZN SYSTEM"}`.toUpperCase(),
    spam: `${safeZoeiraResponse("spam")}: o sistema limita mensagens repetitivas para proteger o grupo.`,
    "trava-zap": `${safeZoeiraResponse("trava-zap")} pelo GGZN SYSTEM para evitar abuso e quedas de sessão.`,
    sorteio: drawWinner(args),
  };
  if (response[command]) await reply(sock, jid, response[command]);
}

async function weather(city: string) {
  if (!city) return "Use !clima com o nome de uma cidade.";
  try { const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`); return `Clima: ${await response.text()}`; } catch { return "Não foi possível consultar o clima agora."; }
}
async function translate(args: string[]) {
  const lang = args[0]; const text = args.slice(1).join(" ");
  if (!lang || !text) return "Uso: !traduzir pt texto ou !traduzir en texto";
  try { const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${encodeURIComponent(lang)}`); const data = await response.json() as { responseData?: { translatedText?: string } }; return `Tradução: ${data.responseData?.translatedText ?? "sem resultado"}`; } catch { return "Não foi possível traduzir agora."; }
}
async function lookupInfo(term: string) {
  if (!term) return "Use !info com um termo de busca.";
  try { const response = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`); const data = await response.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } }; return data.extract ? `${data.extract.slice(0, 600)}${data.content_urls?.desktop?.page ? `\\n${data.content_urls.desktop.page}` : ""}` : "Nenhuma informação encontrada."; } catch { return "Não foi possível buscar informações agora."; }
}

function escapeXml(value: string) { return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char); }
function drawWinner(items: string[]) { return items.length ? `Sorteado: *${items[Math.floor(Math.random() * items.length)]}*` : "Informe os participantes depois de !sorteio."; }

export function calculate(expression: string) {
  if (!expression || !/^[0-9+\-*/().% ]+$/.test(expression)) return "Use apenas números e operadores básicos.";
  try { return `Resultado: ${Function(`"use strict"; return (${expression})`)()}`; } catch { return "Não foi possível calcular essa expressão."; }
}
