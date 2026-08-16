import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  Check,
  ExternalLink,
  Github,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type BotStatus = { status: string; phone?: string; lastError?: string };

const commandGroups = [
  { label: "ADM", code: "01", accent: "bg-lime-300", description: "Controle de grupo e moderação.", commands: ["banir", "remover", "silenciar", "promover", "rebaixar", "fechar", "abrir", "anunciar", "limpar"] },
  { label: "MEMBROS", code: "02", accent: "bg-cyan-300", description: "Utilidades rápidas para o dia a dia.", commands: ["sticker", "stext", "traduzir", "clima", "piada", "citacao", "calcular", "info"] },
  { label: "CARGOS", code: "03", accent: "bg-orange-300", description: "Hierarquia clara e persistente.", commands: ["owner", "admin", "moderador", "membro"] },
  { label: "ZOEIRA", code: "04", accent: "bg-fuchsia-300", description: "Diversão com limites e antiabuso.", commands: ["fake", "gigante", "spam controlado", "figurinha animada", "sorteio"] },
];

export const statusCopy: Record<string, { label: string; detail: string; tone: string }> = {
  connected: { label: "ATIVO", detail: "Sessão WhatsApp operacional", tone: "bg-lime-300" },
  connecting: { label: "CONECTANDO", detail: "Restaurando sessão persistida", tone: "bg-orange-300" },
  needs_pairing: { label: "AGUARDANDO VÍNCULO", detail: "Conexão privada necessária", tone: "bg-orange-300" },
  disconnected: { label: "DESCONECTADO", detail: "Reconexão automática em avaliação", tone: "bg-red-300" },
  offline: { label: "OFFLINE", detail: "API de status indisponível", tone: "bg-red-300" },
  consultando: { label: "CONSULTANDO", detail: "Buscando saúde da sessão", tone: "bg-neutral-300" },
};

export function getStatusPresentation(status: string) {
  return statusCopy[status] ?? statusCopy.offline;
}

export function maskPhone(phone = "5534991286637") {
  return `${phone.slice(0, 4)} •••• ${phone.slice(-4)}`;
}

export default function Home() {
  const [status, setStatus] = useState<BotStatus>({ status: "consultando" });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/bot/status");
      if (!response.ok) throw new Error("status unavailable");
      setStatus(await response.json());
    } catch {
      setStatus({ status: "offline" });
    } finally {
      setLastChecked(new Date());
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, []);

  const health = getStatusPresentation(status.status);
  const maskedPhone = useMemo(() => maskPhone(status.phone), [status.phone]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f6f2] text-black selection:bg-black selection:text-white">
      <header className="sticky top-0 z-30 border-b-2 border-black bg-[#f6f6f2]/95 px-5 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-5">
          <a href="#top" className="flex shrink-0 items-center gap-3" aria-label="GGZN SYSTEM, voltar ao início">
            <span className="flex h-11 w-11 items-center justify-center rounded-[1px] bg-black text-xl font-black text-lime-300 shadow-[4px_4px_0_#b8d92f]">G</span>
            <span className="hidden text-sm font-black tracking-[0.26em] sm:inline">GGZN SYSTEM</span>
          </a>
          <nav className="flex items-center gap-5 overflow-x-auto text-[10px] font-black uppercase tracking-[0.14em] md:gap-8 md:text-xs" aria-label="Navegação principal">
            <a href="#comandos" className="whitespace-nowrap underline decoration-2 underline-offset-4">Comandos</a>
            <a href="#converse" className="whitespace-nowrap">Conexão</a>
            <a href="#arquitetura" className="hidden whitespace-nowrap sm:inline">Arquitetura</a>
          </nav>
          <a className="hidden shrink-0 text-xs font-black uppercase underline decoration-2 underline-offset-4 lg:inline" href="#converse">Status ao vivo <ArrowDownRight className="inline h-4 w-4" /></a>
        </div>
      </header>

      <section id="top" className="mx-auto grid max-w-[1400px] gap-12 px-5 pb-24 pt-16 md:grid-cols-[1.08fr_.92fr] md:px-10 md:pb-32 md:pt-24">
        <div className="relative">
          <div className="mb-8 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em]"><span className={`h-3 w-3 ${health.tone} animate-pulse shadow-[0_0_0_5px_rgba(217,255,87,.2)]`} /> {health.label} / NODE.JS / BAILEYS</div>
          <p className="mb-4 text-xs font-black uppercase tracking-[.24em] text-neutral-500">/ automação de grupo, sem ruído</p>
          <h1 className="max-w-5xl text-[clamp(4.5rem,13vw,12.5rem)] font-black leading-[.76] tracking-[-.095em]">BOT<br /><span className="ml-[9vw]">BRUTO.</span></h1>
          <p className="mt-12 max-w-xl border-l-8 border-black pl-5 text-xl font-bold leading-tight md:text-2xl">Comandos rápidos, cargos claros e controle persistente por grupo. O sistema trabalha nos bastidores para o grupo conversar melhor.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#comandos"><Button className="h-14 rounded-none border-4 border-black bg-black px-7 text-sm font-black uppercase tracking-widest text-white transition-transform hover:bg-lime-300 hover:text-black active:scale-[.97]">Ver comandos <ArrowDownRight className="ml-3 h-5 w-5" /></Button></a>
            <a href="#converse"><Button variant="outline" className="h-14 rounded-none border-4 border-black bg-white px-7 text-sm font-black uppercase tracking-widest transition-transform hover:bg-black hover:text-white active:scale-[.97]">Ver conexão</Button></a>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-2 gap-3 border-t-2 border-black pt-4 text-xs font-black uppercase md:grid-cols-4">
            <span><strong className="block text-2xl">04</strong> níveis</span><span><strong className="block text-2xl">30+</strong> comandos</span><span><strong className="block text-2xl">24/7</strong> pronto</span><span><strong className="block text-2xl">01</strong> núcleo</span>
          </div>
        </div>
        <div className="relative flex min-h-[440px] items-end overflow-hidden border-4 border-black bg-[#111] p-6 text-white shadow-[10px_10px_0_#d9ff57] md:min-h-[560px]" style={{ backgroundImage: "linear-gradient(180deg, rgba(5,5,5,.08), rgba(5,5,5,.9)), url(/manus-storage/ggzn-premium-hero_eecc6acd.webp)", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="absolute right-0 top-0 h-24 w-24 border-b-4 border-l-4 border-white/50 bg-orange-300" />
          <div className="absolute left-6 top-6 text-[10px] font-black uppercase tracking-[.3em] text-lime-300">/ 01 — manifesto</div>
          <div className="absolute right-6 top-7 flex items-center gap-2 text-[10px] font-black uppercase"><span className="h-2 w-2 rounded-full bg-lime-300" /> live system</div>
          <div className="relative w-full"><div className="mb-5 text-[8rem] font-black leading-[.72] tracking-[-.12em] text-white drop-shadow-[5px_5px_0_#d9ff57] md:text-[10rem]">GG<br />ZN</div><div className="flex items-center justify-between gap-3 border-t-2 border-white/50 pt-4 text-xs font-black uppercase"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-lime-300" /> sem conversa mole</span><span className="text-lime-300">v1.0 / online</span></div></div>
        </div>
      </section>

      <section id="arquitetura" className="border-y-2 border-black bg-[#050505] px-5 py-8 text-white md:px-10"><div className="mx-auto grid max-w-[1400px] gap-6 md:grid-cols-3"><div className="border-l-2 border-lime-300 pl-4"><span className="text-xs font-black text-lime-300">01 / STACK</span><p className="mt-2 text-2xl font-black">NODE.JS + TYPESCRIPT</p></div><div className="border-l-2 border-cyan-300 pl-4"><span className="text-xs font-black text-cyan-300">02 / SESSÃO</span><p className="mt-2 text-2xl font-black">BAILEYS + RECONEXÃO</p></div><div className="border-l-2 border-orange-300 pl-4"><span className="text-xs font-black text-orange-300">03 / DADOS</span><p className="mt-2 text-2xl font-black">CONFIGURAÇÃO POR GRUPO</p></div></div></section>

      <section id="comandos" className="mx-auto max-w-[1400px] px-5 py-24 md:px-10"><div className="mb-14 flex items-end justify-between gap-6"><div><span className="text-xs font-black uppercase tracking-[.2em] text-neutral-500">/ 02 — catálogo de operação</span><h2 className="mt-3 text-6xl font-black leading-none tracking-[-.07em] md:text-8xl">COMANDOS<br /><span className="text-neutral-400">EM BLOCOS.</span></h2></div><Terminal className="hidden h-20 w-20 md:block" strokeWidth={1.4} /></div><div className="grid gap-5 md:grid-cols-2">{commandGroups.map((group) => <article key={group.label} className="group border-2 border-black bg-white p-6 shadow-[6px_6px_0_#050505] transition-transform duration-200 hover:-translate-y-1"><div className="mb-5 flex items-start justify-between gap-4 border-b-4 border-black pb-4"><div><span className={`${group.accent} px-3 py-1 text-sm font-black`}>{group.code}</span><h3 className="mt-3 text-3xl font-black tracking-tight">{group.label}</h3></div><Sparkles className="h-6 w-6 opacity-50" /></div><p className="mb-5 text-sm font-bold text-neutral-600">{group.description}</p><div className="flex flex-wrap gap-2">{group.commands.map((command) => <code key={command} className="border-2 border-black px-3 py-2 text-sm font-bold transition-colors group-hover:bg-[#f6f6f2]">!{command}</code>)}</div></article>)}</div></section>

      <section id="converse" className="border-t-2 border-black bg-[#ffb866] px-5 py-24 md:px-10"><div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[.9fr_1.1fr]"><div><span className="text-xs font-black uppercase tracking-[.2em]">/ 03 — saúde da sessão</span><h2 className="mt-4 text-6xl font-black leading-[.85] tracking-[-.07em] md:text-8xl">CONECTE.<br />CONFIRA.<br />MANDE.</h2><p className="mt-8 max-w-md text-lg font-bold">O status é consultado automaticamente. A conexão do proprietário permanece protegida e nunca é exibida no site público.</p><div className="mt-8 flex items-center gap-3 text-xs font-black uppercase" aria-live="polite"><span className={`h-4 w-4 ${health.tone} border-2 border-black`} /> {health.detail}</div></div><div className="border-2 border-black bg-white p-6 shadow-[8px_8px_0_#050505] md:p-8"><div className="mb-6 flex items-start justify-between gap-4 border-b-4 border-black pb-4"><div><p className="text-xs font-black uppercase tracking-[.18em]">canal de conexão</p><p className="mt-2 text-2xl font-black tracking-wide">+{maskedPhone}</p></div><Radio className="h-8 w-8" /></div><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div className="border-4 border-black bg-[#f6f6f2] p-5"><div className="flex items-center gap-3"><span className={`h-3 w-3 ${health.tone} border border-black`} /><p className="text-sm font-black uppercase">{health.label}</p></div><p className="mt-2 text-sm font-bold text-neutral-600">{health.detail}</p>{status.lastError && <p className="mt-2 text-xs font-bold text-red-700">Último evento: {status.lastError}</p>}</div><Button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="h-full min-h-16 rounded-none border-4 border-black bg-black px-5 text-white hover:bg-lime-300 hover:text-black" aria-label="Atualizar status da conexão"><RefreshCw className={`mx-auto h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} /></Button></div><div className="mt-5 flex items-start gap-3 border-t-2 border-black pt-5"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" /><div><p className="font-black uppercase">Conexão protegida</p><p className="mt-1 text-sm font-bold">O QR e o código do proprietário não são exibidos publicamente.</p></div></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[10px] font-black uppercase text-neutral-500"><span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> atualização automática: 8s</span><span>{lastChecked ? `verificado ${lastChecked.toLocaleTimeString("pt-BR")}` : "aguardando verificação"}</span></div></div></div></section>

      <footer className="border-t-4 border-black px-5 py-8 md:px-10"><div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-5 text-xs font-black uppercase md:flex-row"><span>GGZN SYSTEM © 2026</span><span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> link direto / sem login</span><a href="https://github.com/GUIZINGGZNDev/whatsapp-bot-node" target="_blank" rel="noreferrer" className="flex items-center gap-2 underline"><Github className="h-3.5 w-3.5" /> código privado <ExternalLink className="h-3.5 w-3.5" /></a><a href="#top" className="underline">voltar ao topo ↑</a></div></footer>
    </main>
  );
}
