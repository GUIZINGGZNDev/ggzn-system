import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { downloadMediaMessage, getContentType } from "@whiskeysockets/baileys";
import sharp from "sharp";
import { getMemberRole, getOrCreateGroup, updateGroupConfig, upsertMember } from "../db";
import { getBotState, getPhone } from "./manager";

const ROLE_LEVEL = { member: 1, moderator: 2, admin: 3, owner: 4 } as const;
const funHits = new Map<string, number[]>();
const autoHits = new Map<string, number[]>();
const funCommands = new Set(["fake", "gigante", "spam", "sorteio", "trava-zap"]);
const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const ownerBootstrapped = new Set<string>();
const ROLE_CACHE_TTL_MS = 15_000;
export const MEDIA_TIMEOUT_MS = 7_000;
export function applyPrefixAction(current: string[], active: string, action: "add" | "remove" | "set", next: string) {
  if (action === "remove") {
    const list = current.filter((item) => item !== next);
    return { prefixes: list.length ? list : current, activePrefix: active === next && list.length ? list[0] : active };
  }
  const prefixes = Array.from(new Set(action === "add" ? [...current, next] : [next, ...current]));
  return { prefixes, activePrefix: action === "add" ? active : next };
}
type Role = keyof typeof ROLE_LEVEL;

const commandLine = (prefix: string, command: string, _description: string) => `${prefix}${command}`;
const submenuRule = "────────────────────────────────";
export const MENU_NUMBER_MAP = { "1": "adm", "2": "zoeira", "3": "info", "4": "mod", "5": "site", "6": "textos", "7": "ia" } as const;
const getMenuSection = (value?: string) => value ? MENU_NUMBER_MAP[value as keyof typeof MENU_NUMBER_MAP] ?? value : undefined;
export const getMainMenu = (prefix: string) => [
  "╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮",
  "┃       GGZN CORPORATION       ┃",
  "┃         MENU PRINCIPAL       ┃",
  "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯",
  `          PREFIXO: ${prefix}`,
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
  `│ ${prefix}menu 1  •  ${prefix}menu adm  │`,
  `│ ${prefix}menu 2  •  ${prefix}menu zoeira │`,
  `│ ${prefix}menu 3  •  ${prefix}menu info  │`,
  `│ ${prefix}menu 4  •  ${prefix}menu mod   │`,
  `│ ${prefix}menu 5  •  ${prefix}menu site  │`,
  `│ ${prefix}menu 6  •  ${prefix}menu textos│`,
  `│ ${prefix}menu 7  •  ${prefix}menu ia    │`,
  "└──────────────────────────────┘",
].join("\n");
const menus: Record<string, (prefix: string) => string> = {
  adm: (prefix) => [
    "*MENU ADM — CONTROLE DO GRUPO*",
    submenuRule,
    "",
    commandLine(prefix, "banir @membro", "remove definitivamente um membro"),
    commandLine(prefix, "remover @membro", "remove um membro do grupo"),
    commandLine(prefix, "silenciar", "fecha o grupo para membros"),
    commandLine(prefix, "promover @membro", "promove o membro a administrador"),
    commandLine(prefix, "promover moderador @membro", "atribui cargo de moderador"),
    commandLine(prefix, "rebaixar @membro", "remove o cargo administrativo"),
    commandLine(prefix, "fechar", "somente administradores enviam mensagens"),
    commandLine(prefix, "abrir", "libera mensagens para o grupo"),
    commandLine(prefix, "anunciar texto", "envia um anúncio identificado"),
    commandLine(prefix, "limpar", "apaga a mensagem citada"),
    commandLine(prefix, "ativar comando", "reativa um comando no grupo"),
    commandLine(prefix, "desativar comando", "desativa um comando no grupo"),
    commandLine(prefix, "prefixo set ?", "define o prefixo ativo"),
    "",
    submenuRule,
    "Requisito: Moderador para silenciar/anunciar/limpar.",
    "Requisito: Administrador para banir, cargos, abrir, fechar e configurações.",
  ].join("\n"),
  adm1: (prefix) => [
    "*MENU ADM / 1 — FERRAMENTAS AVANÇADAS*",
    submenuRule,
    "",
    commandLine(prefix, "regras add texto", "adiciona uma regra"),
    commandLine(prefix, "regras limpar", "remove todas as regras"),
    commandLine(prefix, "auto add gatilho => resposta", "cria uma auto-resposta"),
    commandLine(prefix, "auto listar", "lista auto-respostas"),
    commandLine(prefix, "auto remover gatilho", "remove uma auto-resposta"),
    commandLine(prefix, "menu voltar", "volta ao menu principal"),
  ].join("\\n"),
  membros: (prefix) => [
    "*MENU MEMBROS — UTILIDADES*",
    submenuRule,
    "",
    commandLine(prefix, "sticker", "converte a imagem enviada em figurinha"),
    commandLine(prefix, "stext frase", "cria uma figurinha com texto"),
    commandLine(prefix, "traduzir pt texto", "traduz o texto para português"),
    commandLine(prefix, "traduzir en texto", "traduz o texto para inglês"),
    commandLine(prefix, "clima cidade", "consulta o clima de uma cidade"),
    commandLine(prefix, "piada", "envia uma piada rápida"),
    commandLine(prefix, "citacao", "envia uma citação do sistema"),
    commandLine(prefix, "calcular 2+2", "calcula números e operadores básicos"),
    commandLine(prefix, "info termo", "busca um resumo informativo"),
    commandLine(prefix, "menu", "abre o menu completo"),
    commandLine(prefix, "help membros", "abre este submenu"),
    commandLine(prefix, "prefixos", "mostra os prefixos aceitos"),
    commandLine(prefix, "ping", "responde com o tempo do bot"),
    commandLine(prefix, "hora", "mostra o horário atual"),
    commandLine(prefix, "data", "mostra a data atual"),
    commandLine(prefix, "id", "mostra os identificadores da conversa"),
    commandLine(prefix, "regras", "mostra as regras básicas"),
    commandLine(prefix, "grupo", "mostra o nome e a configuração do grupo"),
  ].join("\n"),
  cargos: (prefix) => [
    "*MENU CARGOS — HIERARQUIA*",
    submenuRule,
    "",
    commandLine(prefix, "promover @membro", "promove a administrador"),
    commandLine(prefix, "promover moderador @membro", "promove a moderador"),
    commandLine(prefix, "rebaixar @membro", "retorna o membro ao nível básico"),
    commandLine(prefix, "menu adm", "consulta ações administrativas"),
    commandLine(prefix, "menu config", "consulta configurações do grupo"),
    "",
    "Níveis: Dono > Administrador > Moderador > Membro.",
    "Promoções exigem administrador e funcionam em grupos.",
  ].join("\n"),
  zoeira: (prefix) => [
    "*MENU ZOEIRA — DIVERSÃO CONTROLADA*",
    submenuRule,
    "",
    commandLine(prefix, "fake texto", "encena texto sem autoria real"),
    commandLine(prefix, "gigante texto", "converte o texto para maiúsculas"),
    commandLine(prefix, "sorteio nome1 nome2", "sorteia um participante"),
    commandLine(prefix, "spam", "retorna aviso anti-spam controlado"),
    commandLine(prefix, "trava-zap", "retorna aviso e permanece bloqueado"),
    commandLine(prefix, "piada", "envia uma piada rápida"),
    commandLine(prefix, "citacao", "envia uma frase de efeito"),
    commandLine(prefix, "gigante GGZN SYSTEM", "gera texto destacado"),
    "",
    "Limite de uso aplicado por membro em funções de zoeira.",
    "Trava-zap e spam destrutivo nunca são executados pelo sistema.",
  ].join("\n"),
  info: (prefix) => [
    "*MENU INFO — SISTEMA*",
    submenuRule,
    "",
    commandLine(prefix, "menu", "mostra o menu completo"),
    commandLine(prefix, "help categoria", "abre um submenu específico"),
    commandLine(prefix, "info termo", "busca um resumo na Wikipédia"),
    commandLine(prefix, "prefixos", "lista os prefixos configurados"),
    commandLine(prefix, "menu cargos", "mostra a hierarquia de cargos"),
    commandLine(prefix, "menu config", "mostra a configuração por grupo"),
    commandLine(prefix, "ping", "responde com o tempo do bot"),
    commandLine(prefix, "id", "mostra os identificadores da conversa"),
    commandLine(prefix, "regras", "mostra as regras básicas"),
    "",
    "GGZN SYSTEM — Node.js + Baileys.",
    "Sessão, cargos, prefixos e comandos são persistidos por grupo.",
  ].join("\n"),
  mod: (prefix) => [
    "*GGZN CORPORATION / MODERAÇÃO*",
    submenuRule,
    "",
    commandLine(prefix, "silenciar", "fecha o grupo para membros"),
    commandLine(prefix, "abrir", "libera mensagens para o grupo"),
    commandLine(prefix, "fechar", "restringe mensagens a administradores"),
    commandLine(prefix, "limpar", "apaga a mensagem citada"),
    commandLine(prefix, "anunciar texto", "publica um anúncio identificado"),
    commandLine(prefix, "banir @membro", "remove um membro do grupo"),
    commandLine(prefix, "remover @membro", "remove um membro do grupo"),
    "",
    "Use `menu adm` para ver todas as ações administrativas.",
  ].join("\n"),
  mod1: (prefix) => [
    "*MENU MODERAÇÃO / 1 — CONTROLE*",
    submenuRule,
    "",
    commandLine(prefix, "silenciar", "fecha o grupo"),
    commandLine(prefix, "abrir", "reabre o grupo"),
    commandLine(prefix, "limpar", "apaga mensagem citada"),
    commandLine(prefix, "anunciar texto", "envia anúncio"),
    commandLine(prefix, "regras", "mostra regras do grupo"),
    commandLine(prefix, "menu voltar", "volta ao menu principal"),
  ].join("\\n"),
  site: (prefix) => [
    "*GGZN CORPORATION / SITE OFC*",
    submenuRule,
    "",
    "Site oficial:",
    "https://ggznbot-g89bqgka.manus.space",
    "",
    commandLine(prefix, "menu", "volta ao painel principal"),
    "A conexão do bot permanece protegida e não é exibida publicamente.",
  ].join("\n"),
  textos: (prefix) => [
    "*GGZN CORPORATION / TEXTOS*",
    submenuRule,
    "",
    commandLine(prefix, "stext frase", "cria figurinha com texto"),
    commandLine(prefix, "gigante texto", "converte texto para maiúsculas"),
    commandLine(prefix, "fake texto", "encena texto sem autoria real"),
    commandLine(prefix, "citacao", "envia uma citação do sistema"),
    commandLine(prefix, "anunciar texto", "publica texto como anúncio"),
    commandLine(prefix, "calcular 2+2", "calcula uma expressão"),
  ].join("\n"),
  ia: (prefix) => [
    "*GGZN CORPORATION / IA*",
    submenuRule,
    "",
    commandLine(prefix, "info termo", "busca um resumo informativo"),
    commandLine(prefix, "traduzir pt texto", "traduz texto para português"),
    commandLine(prefix, "traduzir en texto", "traduz texto para inglês"),
    commandLine(prefix, "clima cidade", "consulta dados externos"),
    commandLine(prefix, "piada", "resposta automática rápida"),
    "",
    "Auto-respostas seguras e integrações possuem timeout.",
  ].join("\n"),
  config: (prefix) => [
    "*MENU CONFIGURAÇÕES — POR GRUPO*",
    submenuRule,
    "",
    commandLine(prefix, "prefixos", "lista todos os prefixos aceitos"),
    commandLine(prefix, "prefixo set !", "substitui e ativa um prefixo"),
    commandLine(prefix, "prefixo add ?", "adiciona um prefixo alternativo"),
    commandLine(prefix, "prefixo remove ?", "remove um prefixo alternativo"),
    commandLine(prefix, "ativar comando", "reativa uma função desativada"),
    commandLine(prefix, "desativar comando", "desativa uma função do grupo"),
    commandLine(prefix, "ativar clima", "reativa o comando clima"),
    commandLine(prefix, "desativar spam", "desativa o comando spam"),
    commandLine(prefix, "menu config", "reabre este submenu"),
    commandLine(prefix, "menu voltar", "volta ao menu principal"),
    commandLine(prefix, "status", "mostra o estado do bot"),
    "",
    "Configurações exigem cargo de Administrador.",
    "Prefixos disponíveis por padrão: ! / # .",
  ].join("\n"),
};

export function getMenu(section?: string, prefix = "!") { return section && menus[section] ? menus[section](prefix) : undefined; }
export function requiredRoleForCommand(command: string) { return ["silenciar", "limpar", "anunciar"].includes(command) ? "moderator" : ["banir", "remover", "promover", "rebaixar", "fechar", "abrir", "prefixo"].includes(command) ? "admin" : "member"; }
export function moderationEffect(command: string) { return command === "silenciar" ? "announcement" : command === "limpar" ? "delete-quoted" : "none"; }
export function safeZoeiraResponse(command: string) { if (command === "spam") return "Spam controlado bloqueado"; if (command === "trava-zap") return "Trava-zap bloqueado"; if (command === "fake") return "sem atribuição real"; return undefined; }
export function commandLabel(message: WAMessage) { const match = textOf(message).trim().match(/^[!/#.\/]\s*([^\s]+)/); return match?.[1]?.toLowerCase(); }

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
async function reply(sock: WASocket, jid: string, text: string) {
  const startedAt = performance.now();
  await sock.sendMessage(jid, { text });
  const elapsed = Math.round(performance.now() - startedAt);
  console.info(`[GGZN][message][sent] ${elapsed}ms jid=${jid} chars=${text.length}`);
}

async function requireRole(sock: WASocket, jid: string, sender: string, required: Role) {
  const owner = sender.replace(/\D/g, "") === getPhone();
  const cacheKey = `${jid}:${sender}`;
  const cached = roleCache.get(cacheKey);
  const role = owner ? "owner" : cached && cached.expiresAt > Date.now() ? cached.role : await getCachedRole(cacheKey, jid, sender);
  if (!atLeast(role, required)) {
    await reply(sock, jid, `Acesso negado. Este comando exige o cargo *${required}*.`);
    return false;
  }
  return true;
}
async function getCachedRole(cacheKey: string, jid: string, sender: string): Promise<Role> {
  const role = await getMemberRole(jid, sender) as Role;
  roleCache.set(cacheKey, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
  return role;
}

export async function handleIncomingMessage(sock: WASocket, message: WAMessage) {
  const jid = message.key.remoteJid;
  if (!jid || message.key.fromMe || !message.message) return;
  const text = textOf(message).trim();
  if (!text) return;
  const group = isGroup(jid) ? await getOrCreateGroup(jid) : { activePrefix: "!", prefixes: ["!", "/", "#", "."], disabledCommands: [] as string[], rules: [], autoReplies: [], jid, name: "Privado" };
  const prefix = group.prefixes.find((candidate) => text.startsWith(candidate));
  if (!prefix) {
    const auto = group.autoReplies.find((item) => item.enabled && text.toLowerCase().includes(item.trigger.toLowerCase()));
    if (auto) {
      const autoKey = `${jid}:${senderOf(message)}`;
      const now = Date.now();
      const hits = (autoHits.get(autoKey) ?? []).filter((time) => now - time < 60000);
      if (hits.length < 3) { autoHits.set(autoKey, [...hits, now]); await reply(sock, jid, auto.response); }
    }
    return;
  }
  const [rawCommand, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const command = rawCommand?.toLowerCase();
  if (!command || group.disabledCommands.includes(command)) return;
  const sender = senderOf(message);
  if (isGroup(jid) && sender.replace(/\D/g, "") === getPhone() && !ownerBootstrapped.has(jid)) {
    ownerBootstrapped.add(jid);
    void upsertMember(jid, sender, "owner");
  }

  if (funCommands.has(command)) {
    const now = Date.now();
    const hits = (funHits.get(sender) ?? []).filter((time) => now - time < 60000);
    if (hits.length >= 8) { await reply(sock, jid, "Limite de zoeira atingido. Aguarde um minuto para continuar."); return; }
    funHits.set(sender, [...hits, now]);
  }

  if (command === "menu" || command === "help") {
    const requestedSection = args[0]?.toLowerCase();
    if (requestedSection === "voltar" || requestedSection === "principal") {
      await reply(sock, jid, getMainMenu(group.activePrefix));
      return;
    }
    const nestedSection = requestedSection === "adm" && args[1] === "1" ? "adm1" : requestedSection === "mod" && args[1] === "1" ? "mod1" : undefined;
    const section = nestedSection ?? getMenuSection(requestedSection);
    await reply(sock, jid, section && menus[section] ? menus[section](group.activePrefix) : getMainMenu(group.activePrefix));
    return;
  }
  if (command === "prefixos") { await reply(sock, jid, `Prefixos aceitos: ${group.prefixes.join(" ")}\nAtivo: ${group.activePrefix}`); return; }
  if (command === "ping") { const startedAt = performance.now(); await reply(sock, jid, `Pong! ${Math.round(performance.now() - startedAt)}ms`); return; }
  if (command === "hora") { await reply(sock, jid, `Hora: ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date())}`); return; }
  if (command === "data") { await reply(sock, jid, `Data: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date())}`); return; }
  if (command === "id") { await reply(sock, jid, `Chat: ${jid}\nUsuário: ${sender}`); return; }
  if (command === "regras" && !args[0]) { const activeRules = group.rules.filter((rule) => rule.enabled); const rules = activeRules.length ? activeRules.map((rule, index) => `${index + 1}. ${rule.text}`).join("\n") : "Nenhuma regra personalizada."; await reply(sock, jid, `REGRAS GGZN\n${rules}`); return; }
  if (command === "regras") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const action = args[0]?.toLowerCase(); if (action === "add") { const value = args.slice(1).join(" ").trim(); if (!value) return reply(sock, jid, "Use !regras add texto"); const rules = [...group.rules, { id: String(Date.now()), text: value.slice(0, 240), enabled: true }]; await updateGroupConfig(jid, { rules }); await reply(sock, jid, "Regra adicionada."); return; } if (action === "toggle") { const id = args[1]; const rules = group.rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule); await updateGroupConfig(jid, { rules }); await reply(sock, jid, "Estado da regra atualizado."); return; } if (action === "limpar") { await updateGroupConfig(jid, { rules: [] }); await reply(sock, jid, "Regras limpas."); return; } await reply(sock, jid, "Use !regras add texto | !regras toggle ID | !regras limpar"); return; }
  if (command === "auto") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const action = args[0]?.toLowerCase(); if (action === "add") { const [trigger, response] = args.slice(1).join(" ").split("=>").map((part) => part?.trim()); if (!trigger || !response) return reply(sock, jid, "Use !auto add gatilho => resposta"); const autoReplies = [...group.autoReplies.filter((item) => item.trigger !== trigger), { trigger: trigger.slice(0, 40), response: response.slice(0, 500), enabled: true }]; await updateGroupConfig(jid, { autoReplies }); await reply(sock, jid, "Auto-resposta adicionada."); return; } if (action === "remover") { const trigger = args.slice(1).join(" ").trim(); await updateGroupConfig(jid, { autoReplies: group.autoReplies.filter((item) => item.trigger !== trigger) }); await reply(sock, jid, "Auto-resposta removida."); return; } if (action === "listar") { await reply(sock, jid, group.autoReplies.length ? group.autoReplies.map((item) => `${item.enabled ? "ON" : "OFF"} | ${item.trigger}`).join("\n") : "Nenhuma auto-resposta cadastrada."); return; } await reply(sock, jid, "Use !auto add gatilho => resposta | !auto listar | !auto remover gatilho"); return; }
  if (command === "grupo") { await reply(sock, jid, `Grupo: ${group.name}\nPrefixo: ${group.activePrefix}\nComandos bloqueados: ${group.disabledCommands.length}`); return; }
  if (command === "status") { const bot = getBotState(); await reply(sock, jid, `Status: ${bot.status.toUpperCase()}\nTransporte: Baileys\nNúmero: ${bot.phone}`); return; }
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
    roleCache.delete(`${jid}:${target}`);
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
    const mediaStartedAt = performance.now();
    const media = await withTimeout(downloadMediaMessage(message, "buffer", {}), MEDIA_TIMEOUT_MS);
    console.info(`[GGZN][external][sticker-download] ${Math.round(performance.now() - mediaStartedAt)}ms`);
    const conversionStartedAt = performance.now();
    const sticker = await withTimeout(sharp(media as Buffer).resize(512, 512, { fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toBuffer(), MEDIA_TIMEOUT_MS);
    console.info(`[GGZN][external][sticker-conversion] ${Math.round(performance.now() - conversionStartedAt)}ms`);
    const sendStartedAt = performance.now();
    await sock.sendMessage(jid, { sticker });
    console.info(`[GGZN][message][sent] ${Math.round(performance.now() - sendStartedAt)}ms jid=${jid} type=sticker`);
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

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) { return await Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))]); }
async function fetchWithTimeout(url: string, timeoutMs = 3500, label = "api") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timer); console.info(`[GGZN][external][${label}] ${Math.round(performance.now() - startedAt)}ms`); }
}
async function weather(city: string) {
  if (!city) return "Use !clima com o nome de uma cidade.";
  try { const response = await fetchWithTimeout(`https://wttr.in/${encodeURIComponent(city)}?format=3`, 3500, "clima"); return `Clima: ${await response.text()}`; } catch { return "Não foi possível consultar o clima agora."; }
}
async function translate(args: string[]) {
  const lang = args[0]; const text = args.slice(1).join(" ");
  if (!lang || !text) return "Uso: !traduzir pt texto ou !traduzir en texto";
  try { const response = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${encodeURIComponent(lang)}`, 3500, "traduzir"); const data = await response.json() as { responseData?: { translatedText?: string } }; return `Tradução: ${data.responseData?.translatedText ?? "sem resultado"}`; } catch { return "Não foi possível traduzir agora."; }
}
async function lookupInfo(term: string) {
  if (!term) return "Use !info com um termo de busca.";
  try { const response = await fetchWithTimeout(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, 3500, "info"); const data = await response.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } }; return data.extract ? `${data.extract.slice(0, 600)}${data.content_urls?.desktop?.page ? `\n${data.content_urls.desktop.page}` : ""}` : "Nenhuma informação encontrada."; } catch { return "Não foi possível buscar informações agora."; }
}

function escapeXml(value: string) { return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char); }
function drawWinner(items: string[]) { return items.length ? `Sorteado: *${items[Math.floor(Math.random() * items.length)]}*` : "Informe os participantes depois de !sorteio."; }

export function calculate(expression: string) {
  if (!expression || !/^[0-9+\-*/().% ]+$/.test(expression)) return "Use apenas números e operadores básicos.";
  try { return `Resultado: ${Function(`"use strict"; return (${expression})`)()}`; } catch { return "Não foi possível calcular essa expressão."; }
}
