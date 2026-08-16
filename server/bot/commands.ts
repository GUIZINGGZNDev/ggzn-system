import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { downloadMediaMessage, getContentType } from "@whiskeysockets/baileys";
import sharp from "sharp";
import QRCode from "qrcode";
import { invokeLLM } from "../_core/llm";
import { createHeartbeatJob } from "../_core/heartbeat";
import { attachReminderTask, createReminder, DEFAULT_FEATURE_CONFIG, DEFAULT_JOIN_MESSAGES, getMemberRole, getOrCreateGroup, updateGroupConfig, upsertMember } from "../db";
import { getBotState, getPhone } from "./manager";

const ROLE_LEVEL = { member: 1, moderator: 2, admin: 3, owner: 4 } as const;
const funHits = new Map<string, number[]>();
const autoHits = new Map<string, number[]>();
const mentionHits = new Map<string, number[]>();
const participantEventHits = new Map<string, number>();
const memberMessageStats = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();
const floodHits = new Map<string, number[]>();
const slowmodeHits = new Map<string, number>();
const funCommands = new Set(["fake", "gigante", "spam", "sorteio", "trava-zap"]);
const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const ownerBootstrapped = new Set<string>();
const ROLE_CACHE_TTL_MS = 15_000;
export const MEDIA_TIMEOUT_MS = 7_000;
const LINK_PATTERN = /https?:\/\/\S+|www\.\S+/i;
const truthChallenges = ["Conte uma coisa que quase ninguém sabe sobre você.", "Qual foi a última coisa que te fez rir?", "Descreva seu dia em três palavras."];
const dareChallenges = ["Envie um sticker que represente seu humor.", "Escreva uma frase usando apenas letras maiúsculas.", "Mande uma foto do seu papel de parede, se quiser."];
const quizQuestions = ["Qual comando mostra o status do bot?\nA) !grupo\nB) !status\nC) !id", "Qual prefixo é aceito por padrão?\nA) !\nB) @\nC) $", "Qual comando abre o menu?\nA) !menu\nB) !abrir\nC) !painel"];
export function getMemberStats(groupJid: string, userJid: string) { return memberMessageStats.get(`${groupJid}:${userJid}`) ?? { count: 0, firstSeen: Date.now(), lastSeen: Date.now() }; }
export function parseReminderDelay(value: string) {
  const match = value.match(/^(\d{1,4})(s|m|h)$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const milliseconds = unit === "s" ? amount * 1000 : unit === "m" ? amount * 60_000 : amount * 3_600_000;
  return milliseconds >= 60_000 && milliseconds <= 7 * 24 * 3_600_000 ? milliseconds : undefined;
}

async function llmText(instruction: string, input: string) {
  const response = await Promise.race([
    invokeLLM({ messages: [{ role: "system", content: "Responda em português brasileiro, de forma curta e segura." }, { role: "user", content: `${instruction}\n\n${input.slice(0, 3000)}` }] }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
  ]);
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.slice(0, 3000) : "Não foi possível gerar uma resposta agora.";
}
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
    commandLine(prefix, "boasvindas set texto", "define a mensagem de entrada"),
    commandLine(prefix, "boasvindas on/off", "ativa ou pausa boas-vindas"),
    commandLine(prefix, "despedida set texto", "define a mensagem de saída"),
    commandLine(prefix, "despedida on/off", "ativa ou pausa despedidas"),
    commandLine(prefix, "prefixo set ?", "define o prefixo ativo"),
    commandLine(prefix, "aviso @membro motivo", "registra uma advertência"),
    commandLine(prefix, "avisos @membro", "consulta advertências"),
    commandLine(prefix, "resetavisos @membro", "limpa advertências"),
    commandLine(prefix, "config resumo", "mostra configurações ativas"),
    commandLine(prefix, "backup config", "gera resumo da configuração"),
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
    commandLine(prefix, "auto menção on", "ativa respostas para @bot"),
    commandLine(prefix, "auto menção off", "desativa respostas para @bot"),
    commandLine(prefix, "menu voltar", "volta ao menu principal"),
  ].join("\n"),
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
    commandLine(prefix, "versao", "mostra a versão do sistema"),
    commandLine(prefix, "bot", "mostra o estado operacional"),
    commandLine(prefix, "regras", "mostra as regras básicas"),
    commandLine(prefix, "grupo", "mostra o nome e a configuração do grupo"),
    commandLine(prefix, "versao", "mostra a versão do GGZN SYSTEM"),
    commandLine(prefix, "animar texto", "responde com indicador de digitação"),
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
    commandLine(prefix, "verdade", "sorteia uma pergunta"),
    commandLine(prefix, "desafio", "sorteia um desafio seguro"),
    commandLine(prefix, "dado 2d6", "rola dados configuráveis"),
    commandLine(prefix, "quiz", "inicia uma pergunta rápida"),
    commandLine(prefix, "enquete pergunta", "cria uma enquete"),
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
    commandLine(prefix, "versao", "mostra a versão do sistema"),
    commandLine(prefix, "bot", "mostra o estado operacional"),
    commandLine(prefix, "regras", "mostra as regras básicas"),
    commandLine(prefix, "boasvindas status", "mostra o estado das mensagens"),
    commandLine(prefix, "despedida status", "mostra o estado das mensagens"),
    commandLine(prefix, "perfil @membro", "mostra perfil e estatísticas"),
    commandLine(prefix, "top mensagens", "mostra ranking da sessão"),
    commandLine(prefix, "uptime", "mostra tempo de processo"),
    commandLine(prefix, "latencia", "mede latência local"),
    commandLine(prefix, "changelog", "mostra mudanças recentes"),
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
    commandLine(prefix, "aviso @membro motivo", "registra advertência"),
    commandLine(prefix, "antiflood on/off", "protege contra excesso de mensagens"),
    commandLine(prefix, "lock links", "bloqueia links"),
    commandLine(prefix, "slowmode 10", "define intervalo de comandos"),
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
  ].join("\n"),
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
    commandLine(prefix, "resumir texto", "resume texto com IA"),
    commandLine(prefix, "corrigir texto", "corrige texto com IA"),
    commandLine(prefix, "ideia tema", "gera ideias com IA"),
    commandLine(prefix, "enquete pergunta", "cria uma enquete"),
    commandLine(prefix, "@bot oi", "responde a uma menção direta"),
    commandLine(prefix, "auto listar", "lista auto-respostas e estado de menções"),
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
    commandLine(prefix, "antiflood on/off", "ativa ou pausa anti-flood"),
    commandLine(prefix, "lock/unlock links", "controla links do grupo"),
    commandLine(prefix, "slowmode segundos", "define intervalo mínimo"),
    commandLine(prefix, "log on/off", "controla logs administrativos"),
    commandLine(prefix, "config resumo", "mostra configuração completa"),
    commandLine(prefix, "auto menção on", "ativa respostas para @bot"),
    commandLine(prefix, "auto menção off", "desativa respostas para @bot"),
    commandLine(prefix, "boasvindas teste", "testa a mensagem de entrada"),
    commandLine(prefix, "despedida teste", "testa a mensagem de saída"),
    commandLine(prefix, "qr texto", "gera QR Code"),
    commandLine(prefix, "calendario", "mostra data e hora"),
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

const MENU_ANIMATION_MS: Record<string, number> = { principal: 140, adm: 220, adm1: 180, membros: 160, cargos: 150, zoeira: 200, info: 130, mod: 220, mod1: 180, site: 110, textos: 150, ia: 240, config: 210 };
const MENU_ANIMATION_LABEL: Record<string, string> = { principal: "GGZN CORPORATION iniciando", adm: "Central ADM carregando", adm1: "Ferramentas avançadas abrindo", membros: "Utilidades do grupo preparando", cargos: "Hierarquia sendo sincronizada", zoeira: "Modo zoeira seguro ativando", info: "Informações do sistema carregando", mod: "Painel de moderação abrindo", mod1: "Controles de moderação preparando", site: "Acesso oficial carregando", textos: "Central de textos preparando", ia: "Núcleo IA iniciando", config: "Configurações do grupo carregando" };
const MENU_ANIMATION_VIDEO_URL = "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-motion_c4b4c925.mp4";
async function replyAnimated(sock: WASocket, jid: string, text: string, durationMs = 120) {
  const presence = sock.sendPresenceUpdate ? sock.sendPresenceUpdate("composing", jid).catch(() => undefined) : Promise.resolve();
  await Promise.race([presence, new Promise((resolve) => setTimeout(resolve, Math.max(60, Math.min(durationMs, 280))))]);
  await reply(sock, jid, text);
  if (sock.sendPresenceUpdate) await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
}
async function replyMenuAnimated(sock: WASocket, jid: string, section: string, text: string) {
  const duration = MENU_ANIMATION_MS[section] ?? MENU_ANIMATION_MS.principal;
  console.info(`[GGZN][menu][animation] section=${section} label=${MENU_ANIMATION_LABEL[section] ?? MENU_ANIMATION_LABEL.principal} duration=${duration}ms`);
  const presence = sock.sendPresenceUpdate ? sock.sendPresenceUpdate("composing", jid).catch(() => undefined) : Promise.resolve();
  await Promise.race([presence, new Promise((resolve) => setTimeout(resolve, Math.max(60, Math.min(duration, 280))))]);
  try {
    await sock.sendMessage(jid, { video: { url: MENU_ANIMATION_VIDEO_URL }, gifPlayback: true });
    await reply(sock, jid, text);
  } catch (error) {
    console.warn(`[GGZN][menu][animation-fallback] section=${section}`, error);
    await reply(sock, jid, text);
  } finally {
    if (sock.sendPresenceUpdate) await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
  }
}

function mentionText(message: WAMessage) {
  const text = textOf(message).trim();
  const info = message.message?.extendedTextMessage?.contextInfo;
  const botJid = `${getPhone()}@s.whatsapp.net`;
  const isDirectMention = info?.mentionedJid?.some((jid) => jid.replace(/:\d+/, "") === botJid) || /^@(?:bot|ggzn)(?:\s|$)/i.test(text);
  if (!isDirectMention) return undefined;
  return text.replace(/^@(?:bot|ggzn)\s*/i, "").replace(/@\S+/g, "").trim().toLowerCase();
}

const defaultMentionReplies: Record<string, string> = {
  oi: "Oi! GGZN SYSTEM online. Use !menu para abrir o painel.",
  olá: "Olá! Estou online. Use !menu para ver os comandos.",
  ola: "Olá! Estou online. Use !menu para ver os comandos.",
  "bom dia": "Bom dia! GGZN SYSTEM pronto para operar.",
  "boa tarde": "Boa tarde! GGZN SYSTEM segue online.",
  "boa noite": "Boa noite! GGZN SYSTEM continua de prontidão.",
  "tudo bem": "Tudo certo por aqui. Status operacional ativo.",
  ajuda: "Posso ajudar com menus, regras, moderação e utilidades. Use !menu.",
};

function mentionReply(group: { autoReplies: Array<{ trigger: string; response: string; enabled: boolean }> }, text: string) {
  const custom = group.autoReplies.find((item) => item.enabled && text.includes(item.trigger.toLowerCase()));
  return custom?.response ?? defaultMentionReplies[text] ?? (text ? `Recebi: “${text.slice(0, 80)}”. Use !menu para ver as opções.` : "Estou online. Use !menu para abrir o painel.");
}

export function formatJoinMessage(template: string, participant: string, groupName: string) {
  const number = participant.split("@")[0]?.split(":")[0] ?? participant;
  return template.replaceAll("{mention}", `@${number}`).replaceAll("{nome}", `@${number}`).replaceAll("{numero}", number).replaceAll("{grupo}", groupName).slice(0, 2000);
}

export async function handleGroupParticipantsUpdate(sock: WASocket, event: { id: string; participants: Array<string | { id?: string; phoneNumber?: string }>; action: string }) {
  if (!event.id?.endsWith("@g.us") || !["add", "remove"].includes(event.action)) return;
  const participantIds = event.participants.map((participant) => typeof participant === "string" ? participant : participant.id ?? participant.phoneNumber ?? "").filter(Boolean).slice(0, 20);
  const eventKey = `${event.id}:${event.action}:${participantIds.slice().sort().join(",")}`;
  const lastEvent = participantEventHits.get(eventKey) ?? 0;
  if (Date.now() - lastEvent < 10_000) return;
  participantEventHits.set(eventKey, Date.now());
  const group = await getOrCreateGroup(event.id);
  const config = event.action === "add" ? group.joinMessages.welcome : group.joinMessages.farewell;
  if (!config.enabled || !participantIds.length) return;
  const lines = participantIds.map((participant) => formatJoinMessage(config.text, participant, group.name));
  const mentions = participantIds.map((participant) => participant.replace(/:\d+/, ""));
  await sock.sendMessage(event.id, { text: lines.join("\n"), mentions });
  console.info(`[GGZN][group-event] action=${event.action} jid=${event.id} participants=${participantIds.length}`);
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
  const group = isGroup(jid) ? await getOrCreateGroup(jid) : { activePrefix: "!", prefixes: ["!", "/", "#", "."], disabledCommands: [] as string[], rules: [], autoReplies: [], joinMessages: DEFAULT_JOIN_MESSAGES, featureConfig: DEFAULT_FEATURE_CONFIG, jid, name: "Privado" };
  const sender = senderOf(message);
  const statsKey = `${jid}:${sender}`;
  const previousStats = memberMessageStats.get(statsKey) ?? { count: 0, firstSeen: Date.now(), lastSeen: Date.now() };
  memberMessageStats.set(statsKey, { count: previousStats.count + 1, firstSeen: previousStats.firstSeen, lastSeen: Date.now() });
  const senderIsOwner = sender.replace(/\D/g, "") === getPhone();
  if (isGroup(jid) && group.featureConfig.antiFlood && !senderIsOwner) {
    const now = Date.now();
    const floodKey = `${jid}:${sender}`;
    const recent = (floodHits.get(floodKey) ?? []).filter((time) => now - time < 15000);
    floodHits.set(floodKey, [...recent, now]);
    if (recent.length >= 6) { await reply(sock, jid, "Anti-flood ativado: aguarde alguns segundos antes de enviar mais comandos."); return; }
  }
  if (isGroup(jid) && group.featureConfig.blockLinks && !senderIsOwner && LINK_PATTERN.test(text) && !text.startsWith("!")) {
    await reply(sock, jid, "Links estão bloqueados neste grupo. Peça a um administrador para liberar.");
    return;
  }
  const prefix = group.prefixes.find((candidate) => text.startsWith(candidate));
  if (!prefix) {
    const mentionedText = mentionText(message);
    if (mentionedText && !group.disabledCommands.includes("__mention__")) {
      const mentionKey = `${jid}:${senderOf(message)}`;
      const now = Date.now();
      const hits = (mentionHits.get(mentionKey) ?? []).filter((time) => now - time < 60000);
      if (hits.length < 4) {
        mentionHits.set(mentionKey, [...hits, now]);
        await replyAnimated(sock, jid, mentionReply(group, mentionedText));
      }
      return;
    }
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
  if (isGroup(jid) && group.featureConfig.slowmodeSeconds > 0 && !senderIsOwner && !["menu", "help", "ping", "status", "bot"].includes(command)) {
    const slowKey = `${jid}:${sender}`;
    const now = Date.now();
    const last = slowmodeHits.get(slowKey) ?? 0;
    if (now - last < group.featureConfig.slowmodeSeconds * 1000) { await reply(sock, jid, `Slowmode ativo: aguarde ${group.featureConfig.slowmodeSeconds}s.`); return; }
    slowmodeHits.set(slowKey, now);
  }
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
      await replyMenuAnimated(sock, jid, "principal", getMainMenu(group.activePrefix));
      return;
    }
    const nestedSection = requestedSection === "adm" && args[1] === "1" ? "adm1" : requestedSection === "mod" && args[1] === "1" ? "mod1" : undefined;
    const section = nestedSection ?? getMenuSection(requestedSection);
    const resolvedSection = section && menus[section] ? section : "principal";
    const menuText = resolvedSection === "principal" ? getMainMenu(group.activePrefix) : menus[resolvedSection](group.activePrefix);
    await replyMenuAnimated(sock, jid, resolvedSection, menuText);
    return;
  }
  if (command === "prefixos") { await reply(sock, jid, `Prefixos aceitos: ${group.prefixes.join(" ")}\nAtivo: ${group.activePrefix}`); return; }
  if (command === "ping") { const startedAt = performance.now(); await reply(sock, jid, `Pong! ${Math.round(performance.now() - startedAt)}ms`); return; }
  if (command === "hora") { await reply(sock, jid, `Hora: ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date())}`); return; }
  if (command === "data") { await reply(sock, jid, `Data: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date())}`); return; }
  if (command === "id") { await reply(sock, jid, `Chat: ${jid}\nUsuário: ${sender}`); return; }
  if (command === "regras" && !args[0]) { const activeRules = group.rules.filter((rule) => rule.enabled); const rules = activeRules.length ? activeRules.map((rule, index) => `${index + 1}. ${rule.text}`).join("\n") : "Nenhuma regra personalizada."; await reply(sock, jid, `REGRAS GGZN\n${rules}`); return; }
  if (command === "regras") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const action = args[0]?.toLowerCase(); if (action === "add") { const value = args.slice(1).join(" ").trim(); if (!value) return reply(sock, jid, "Use !regras add texto"); const rules = [...group.rules, { id: String(Date.now()), text: value.slice(0, 240), enabled: true }]; await updateGroupConfig(jid, { rules }); await reply(sock, jid, "Regra adicionada."); return; } if (action === "toggle") { const id = args[1]; const rules = group.rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule); await updateGroupConfig(jid, { rules }); await reply(sock, jid, "Estado da regra atualizado."); return; } if (action === "limpar") { await updateGroupConfig(jid, { rules: [] }); await reply(sock, jid, "Regras limpas."); return; } await reply(sock, jid, "Use !regras add texto | !regras toggle ID | !regras limpar"); return; }
  if (command === "auto") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const action = args[0]?.toLowerCase(); if (["menção", "mencao", "mention"].includes(action ?? "")) { const value = args[1]?.toLowerCase(); if (!["on", "off"].includes(value ?? "")) return reply(sock, jid, "Use !auto menção on ou !auto menção off"); const disabled = new Set(group.disabledCommands); value === "off" ? disabled.add("__mention__") : disabled.delete("__mention__"); await updateGroupConfig(jid, { disabledCommands: Array.from(disabled) }); await reply(sock, jid, `Auto-resposta por @bot: ${value === "on" ? "ativada" : "desativada"}.`); return; } if (action === "add") { const [trigger, response] = args.slice(1).join(" ").split("=>").map((part) => part?.trim()); if (!trigger || !response) return reply(sock, jid, "Use !auto add gatilho => resposta"); const autoReplies = [...group.autoReplies.filter((item) => item.trigger !== trigger), { trigger: trigger.slice(0, 40).toLowerCase(), response: response.slice(0, 500), enabled: true }]; await updateGroupConfig(jid, { autoReplies }); await reply(sock, jid, "Auto-resposta adicionada."); return; } if (action === "remover") { const trigger = args.slice(1).join(" ").trim().toLowerCase(); await updateGroupConfig(jid, { autoReplies: group.autoReplies.filter((item) => item.trigger !== trigger) }); await reply(sock, jid, "Auto-resposta removida."); return; } if (action === "listar") { const mentionStatus = group.disabledCommands.includes("__mention__") ? "OFF" : "ON"; await reply(sock, jid, `MENÇÕES @BOT: ${mentionStatus}\n${group.autoReplies.length ? group.autoReplies.map((item) => `${item.enabled ? "ON" : "OFF"} | ${item.trigger}`).join("\n") : "Nenhuma auto-resposta cadastrada."}`); return; } await reply(sock, jid, "Use !auto add gatilho => resposta | !auto listar | !auto remover gatilho | !auto menção on/off"); return; }
  if (command === "grupo") { await reply(sock, jid, `Grupo: ${group.name}\nPrefixo: ${group.activePrefix}\nComandos bloqueados: ${group.disabledCommands.length}`); return; }
  if (command === "perfil" || command === "consulta") { const target = mentioned(message) ?? sender; const stats = getMemberStats(jid, target); const warnings = group.featureConfig.warnings[target] ?? []; await reply(sock, jid, `PERFIL GGZN\nUsuário: @${target.split("@")[0]}\nMensagens nesta sessão: ${stats.count}\nAdvertências: ${warnings.length}\nCargo: ${target === getPhone() ? "Dono" : "Membro"}`); return; }
  if (command === "top" && args[0]?.toLowerCase() === "mensagens") { const rows = Array.from(memberMessageStats.entries()).filter(([key]) => key.startsWith(`${jid}:`)).sort((a, b) => b[1].count - a[1].count).slice(0, 5); await reply(sock, jid, rows.length ? `TOP MENSAGENS\n${rows.map(([key, value], index) => `${index + 1}. @${key.split(":")[1].split("@")[0]} — ${value.count}`).join("\n")}` : "Ainda não há estatísticas."); return; }
  if (command === "aviso") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "moderator"))) return; const target = mentioned(message); if (!target) return reply(sock, jid, "Mencione o membro: !aviso @membro motivo"); const reason = args.filter((arg) => !arg.startsWith("@" )).join(" ").trim().slice(0, 180) || "Sem motivo informado"; const warnings = { ...group.featureConfig.warnings, [target]: [...(group.featureConfig.warnings[target] ?? []), reason] }; await updateGroupConfig(jid, { featureConfig: { ...group.featureConfig, warnings } }); await reply(sock, jid, `Advertência registrada para @${target.split("@")[0]}.`); return; }
  if (command === "avisos") { const target = mentioned(message) ?? sender; const warnings = group.featureConfig.warnings[target] ?? []; await reply(sock, jid, warnings.length ? `ADVERTÊNCIAS\n${warnings.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "Nenhuma advertência registrada."); return; }
  if (command === "resetavisos") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const target = mentioned(message); if (!target) return reply(sock, jid, "Mencione o membro para limpar os avisos."); const warnings = { ...group.featureConfig.warnings }; delete warnings[target]; await updateGroupConfig(jid, { featureConfig: { ...group.featureConfig, warnings } }); await reply(sock, jid, "Advertências removidas."); return; }
  if (["slowmode", "antiflood", "lock", "unlock", "log"].includes(command)) { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; const featureConfig = { ...group.featureConfig }; if (command === "slowmode") { const seconds = Math.max(0, Math.min(300, Number(args[0] ?? 0) || 0)); featureConfig.slowmodeSeconds = seconds; await updateGroupConfig(jid, { featureConfig }); await reply(sock, jid, `Slowmode: ${seconds ? `${seconds}s` : "desativado"}.`); return; } if (command === "antiflood") { featureConfig.antiFlood = args[0]?.toLowerCase() === "on"; await updateGroupConfig(jid, { featureConfig }); await reply(sock, jid, `Anti-flood: ${featureConfig.antiFlood ? "ON" : "OFF"}.`); return; } if (command === "lock" || command === "unlock") { if (args[0]?.toLowerCase() !== "links") return reply(sock, jid, "Use !lock links ou !unlock links"); featureConfig.blockLinks = command === "lock"; await updateGroupConfig(jid, { featureConfig }); await reply(sock, jid, `Links: ${featureConfig.blockLinks ? "bloqueados" : "liberados"}.`); return; } featureConfig.logs = args[0]?.toLowerCase() === "on"; await updateGroupConfig(jid, { featureConfig }); await reply(sock, jid, `Logs administrativos: ${featureConfig.logs ? "ON" : "OFF"}.`); return; }
  if (command === "config" && args[0]?.toLowerCase() === "resumo") { await reply(sock, jid, `CONFIGURAÇÃO\nPrefixo: ${group.activePrefix}\nAnti-flood: ${group.featureConfig.antiFlood ? "ON" : "OFF"}\nLinks: ${group.featureConfig.blockLinks ? "BLOQUEADOS" : "LIBERADOS"}\nSlowmode: ${group.featureConfig.slowmodeSeconds || "OFF"}\nBoas-vindas: ${group.joinMessages.welcome.enabled ? "ON" : "OFF"}\nDespedida: ${group.joinMessages.farewell.enabled ? "ON" : "OFF"}`); return; }
  if (command === "backup" && args[0]?.toLowerCase() === "config") { if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return; await reply(sock, jid, `BACKUP DE CONFIGURAÇÃO\n${JSON.stringify({ prefix: group.activePrefix, features: group.featureConfig, joinMessages: group.joinMessages }).slice(0, 3500)}`); return; }
  if (command === "calendario") { await reply(sock, jid, new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date())); return; }
  if (command === "lembrete") {
    const delay = parseReminderDelay(args[0] ?? "");
    const reminderText = args.slice(1).join(" ").trim().slice(0, 1000);
    if (!delay || !reminderText) return reply(sock, jid, "Use !lembrete 10m texto. O mínimo é 1 minuto.");
    const dueAt = new Date(Date.now() + delay);
    dueAt.setSeconds(0, 0);
    const id = await createReminder({ chatJid: jid, senderJid: sender, text: reminderText, dueAt });
    if (!id) return reply(sock, jid, "Lembretes persistentes estão indisponíveis no momento.");
    try {
      const job = await createHeartbeatJob({ name: `ggzn-reminder-${id}-${Date.now()}`, cron: `0 ${dueAt.getUTCMinutes()} ${dueAt.getUTCHours()} ${dueAt.getUTCDate()} ${dueAt.getUTCMonth() + 1} *`, path: "/api/scheduled/botReminder", description: `GGZN reminder ${id}` }, "");
      await attachReminderTask(id, job.taskUid);
      await reply(sock, jid, `Lembrete criado para ${dueAt.toLocaleString("pt-BR")}.`);
    } catch {
      await reply(sock, jid, "Não foi possível registrar o lembrete no agendador.");
    }
    return;
  }
  if (command === "qr") { const value = args.join(" ").trim(); if (!value) return reply(sock, jid, "Use !qr texto ou !qr link"); const qr = await QRCode.toBuffer(value.slice(0, 1000), { width: 420, margin: 2 }); await sock.sendMessage(jid, { image: qr, caption: "QR Code gerado pelo GGZN SYSTEM." }); return; }
  if (command === "encurtar") { const value = args[0]; if (!value || !LINK_PATTERN.test(value)) return reply(sock, jid, "Envie um link válido."); await reply(sock, jid, `Link recebido e validado: ${value.slice(0, 500)}`); return; }
  if (command === "dado") { const notation = args[0] ?? "1d6"; const match = notation.match(/^(\d{1,2})d(\d{1,4})$/i); if (!match) return reply(sock, jid, "Use !dado 2d6"); const amount = Math.min(Number(match[1]), 20); const sides = Math.min(Number(match[2]), 1000); const rolls = Array.from({ length: amount }, () => Math.floor(Math.random() * sides) + 1); await reply(sock, jid, `DADO ${notation}: ${rolls.join(" + ")} = ${rolls.reduce((sum, value) => sum + value, 0)}`); return; }
  if (command === "verdade" || command === "desafio") { const list = command === "verdade" ? truthChallenges : dareChallenges; await reply(sock, jid, `${command.toUpperCase()}: ${list[Math.floor(Math.random() * list.length)]}`); return; }
  if (command === "quiz") { await reply(sock, jid, quizQuestions[Math.floor(Math.random() * quizQuestions.length)]); return; }
  if (command === "enquete") { const question = args.join(" ").trim(); if (!question) return reply(sock, jid, "Use !enquete pergunta"); await sock.sendMessage(jid, { poll: { name: question.slice(0, 200), values: ["Sim", "Não", "Talvez"], selectableCount: 1 } }); return; }
  if (["resumir", "corrigir", "ideia"].includes(command)) { const input = args.join(" ").trim(); if (!input) return reply(sock, jid, `Use !${command} texto`); try { const instruction = command === "resumir" ? "Resuma o texto em até cinco linhas." : command === "corrigir" ? "Corrija a ortografia e mantenha o sentido." : "Gere cinco ideias práticas sobre o tema."; await replyAnimated(sock, jid, await llmText(instruction, input)); } catch { await reply(sock, jid, "A função de IA está temporariamente indisponível. Tente novamente em alguns segundos."); } return; }
  if (command === "uptime") { await reply(sock, jid, `Uptime do processo: ${Math.floor(process.uptime())}s`); return; }
  if (command === "latencia") { const startedAt = performance.now(); await reply(sock, jid, `Latência local: ${Math.round(performance.now() - startedAt)}ms`); return; }
  if (command === "manutencao" && args[0]?.toLowerCase() === "status") { const bot = getBotState(); await reply(sock, jid, `Manutenção: ${bot.status === "connected" ? "não detectada" : "transporte em atenção"}.`); return; }
  if (command === "changelog") { await reply(sock, jid, "GGZN SYSTEM CHANGELOG\n• Menções @bot\n• Boas-vindas e despedidas\n• Proteções anti-flood e links\n• Jogos, IA e utilidades"); return; }
  if (["boasvindas", "despedida"].includes(command)) {
    if (!isGroup(jid) || !(await requireRole(sock, jid, sender, "admin"))) return;
    const kind = command === "boasvindas" ? "welcome" : "farewell";
    const current = group.joinMessages[kind];
    const action = args[0]?.toLowerCase();
    if (action === "on" || action === "off") {
      const joinMessages = { ...group.joinMessages, [kind]: { ...current, enabled: action === "on" } };
      await updateGroupConfig(jid, { joinMessages });
      await reply(sock, jid, `${command === "boasvindas" ? "Boas-vindas" : "Despedida"}: ${action === "on" ? "ativada" : "desativada"}.`);
      return;
    }
    if (action === "set") {
      const text = args.slice(1).join(" ").trim();
      if (!text) return reply(sock, jid, `Use !${command} set texto`);
      const joinMessages = { ...group.joinMessages, [kind]: { ...current, text: text.slice(0, 1000), enabled: true } };
      await updateGroupConfig(jid, { joinMessages });
      await reply(sock, jid, `Mensagem de ${command === "boasvindas" ? "boas-vindas" : "despedida"} atualizada.`);
      return;
    }
    if (action === "status") {
      await reply(sock, jid, `${command === "boasvindas" ? "Boas-vindas" : "Despedida"}: ${current.enabled ? "ON" : "OFF"}\nMensagem: ${current.text}`);
      return;
    }
    if (action === "teste") {
      const participant = sender;
      const text = formatJoinMessage(current.text, participant, group.name);
      await sock.sendMessage(jid, { text, mentions: [participant.replace(/:\d+/, "")] });
      return;
    }
    await reply(sock, jid, `Use !${command} set texto | !${command} on/off | !${command} status | !${command} teste`);
    return;
  }
  if (command === "status" || command === "bot") { const bot = getBotState(); await reply(sock, jid, `Status: ${bot.status.toUpperCase()}\nTransporte: Baileys\nNúmero: ${bot.phone}`); return; }
  if (command === "versao") { await reply(sock, jid, "GGZN SYSTEM v1.0\nNode.js + Baileys\nModo: resposta rápida e segura."); return; }
  if (command === "animar") { const animatedText = args.join(" ").trim().slice(0, 240) || "GGZN SYSTEM online."; await replyAnimated(sock, jid, animatedText); return; }
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
