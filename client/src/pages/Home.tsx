import { useEffect, useState } from "react";
import { ArrowDownRight, Copy, ExternalLink, Github, LockKeyhole, Radio, RefreshCw, Terminal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type BotStatus = { status: string; pairingCode?: string | null; qrDataUrl?: string | null; phone?: string };

const commandGroups = [
  { label: "ADM", accent: "bg-lime-300", commands: ["banir", "remover", "silenciar", "promover", "rebaixar", "fechar", "abrir", "anunciar", "limpar"] },
  { label: "MEMBROS", accent: "bg-cyan-300", commands: ["sticker", "stext", "traduzir", "clima", "piada", "citacao", "calcular", "info"] },
  { label: "CARGOS", accent: "bg-orange-300", commands: ["owner", "admin", "moderador", "membro"] },
  { label: "ZOEIRA", accent: "bg-fuchsia-300", commands: ["fake", "gigante", "spam controlado", "figurinha animada", "sorteio"] },
];

export default function Home() {
  const [status, setStatus] = useState<BotStatus>({ status: "consultando" });
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    try { setStatus(await fetch("/api/bot/status").then((response) => response.json())); }
    catch { setStatus({ status: "offline" }); }
  };
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 8000); return () => clearInterval(timer); }, []);

  const pairing = async () => {
    setLoadingPairing(true);
    try { setStatus(await fetch("/api/bot/pairing").then((response) => response.json())); }
    catch { setStatus({ status: "erro" }); }
    finally { setLoadingPairing(false); }
  };
  const copyCode = async () => { if (!status.pairingCode) return; await navigator.clipboard.writeText(status.pairingCode); setCopied(true); setTimeout(() => setCopied(false), 1400); };

  return <main className="min-h-screen bg-white text-black selection:bg-black selection:text-white">
    <header className="border-b-4 border-black px-5 py-5 md:px-10">
      <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-6">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center bg-black text-xl font-black text-white">G</div><span className="text-sm font-black tracking-[0.26em]">GGZN SYSTEM</span></div>
        <nav className="hidden gap-8 text-xs font-black uppercase tracking-[0.14em] md:flex"><a href="#comandos" className="underline decoration-2 underline-offset-4">Comandos</a><a href="#pareamento">Pareamento</a><a href="#arquitetura">Arquitetura</a></nav>
        <a className="text-xs font-black uppercase underline decoration-2 underline-offset-4" href="#pareamento">Conectar <ArrowDownRight className="inline h-4 w-4" /></a>
      </div>
    </header>

    <section className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-24 pt-16 md:grid-cols-[1.35fr_.65fr] md:px-10 md:pt-24">
      <div><div className="mb-8 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em]"><span className="h-3 w-3 bg-lime-400" /> ONLINE / NODE.JS / BAILEYS</div><h1 className="max-w-5xl text-[clamp(4.5rem,13vw,12.5rem)] font-black leading-[.78] tracking-[-0.095em]">BOT<br /><span className="ml-[9vw]">BRUTO.</span></h1><p className="mt-12 max-w-xl border-l-8 border-black pl-5 text-xl font-bold leading-tight md:text-2xl">Automação de grupo sem interface enfeitada. Comandos rápidos, cargos claros e controle persistente por grupo.</p><div className="mt-10 flex flex-wrap gap-3"><a href="#comandos"><Button className="h-14 rounded-none border-4 border-black bg-black px-7 text-sm font-black uppercase tracking-widest text-white hover:bg-lime-300 hover:text-black">Ver comandos <ArrowDownRight className="ml-3 h-5 w-5" /></Button></a><a href="#pareamento"><Button variant="outline" className="h-14 rounded-none border-4 border-black bg-white px-7 text-sm font-black uppercase tracking-widest hover:bg-black hover:text-white">Parear agora</Button></a></div></div>
      <div className="relative flex min-h-[380px] items-end border-4 border-black bg-[#f4f4f0] p-6 md:min-h-[510px]"><div className="absolute right-0 top-0 h-24 w-24 border-b-4 border-l-4 border-black bg-orange-300" /><div className="absolute left-6 top-6 text-[10px] font-black uppercase tracking-[.3em]">/ 01 — manifesto</div><div><div className="mb-4 text-[8rem] font-black leading-[.72] tracking-[-.12em]">GG<br />ZN</div><div className="flex items-center gap-2 border-t-4 border-black pt-4 text-xs font-black uppercase"><Zap className="h-4 w-4" /> sem conversa mole</div></div></div>
    </section>

    <section id="arquitetura" className="border-y-4 border-black bg-black px-5 py-8 text-white md:px-10"><div className="mx-auto grid max-w-[1400px] gap-6 md:grid-cols-3"><div><span className="text-xs font-black text-lime-300">01 / STACK</span><p className="mt-2 text-2xl font-black">NODE.JS + TYPESCRIPT</p></div><div><span className="text-xs font-black text-cyan-300">02 / SESSÃO</span><p className="mt-2 text-2xl font-black">BAILEYS + RECONEXÃO</p></div><div><span className="text-xs font-black text-orange-300">03 / DADOS</span><p className="mt-2 text-2xl font-black">CONFIGURAÇÃO POR GRUPO</p></div></div></section>

    <section id="comandos" className="mx-auto max-w-[1400px] px-5 py-24 md:px-10"><div className="mb-14 flex items-end justify-between gap-6"><div><span className="text-xs font-black uppercase tracking-[.2em]">/ 02 — catálogo</span><h2 className="mt-3 text-6xl font-black leading-none tracking-[-.07em] md:text-8xl">COMANDOS<br />EM BLOCOS.</h2></div><Terminal className="hidden h-20 w-20 md:block" strokeWidth={1.4} /></div><div className="grid gap-5 md:grid-cols-2">{commandGroups.map((group, index) => <article key={group.label} className="border-4 border-black p-6"><div className="mb-6 flex items-center justify-between border-b-4 border-black pb-4"><span className={`${group.accent} px-3 py-1 text-sm font-black`}>{String(index + 1).padStart(2, "0")}</span><h3 className="text-3xl font-black tracking-tight">{group.label}</h3></div><div className="flex flex-wrap gap-2">{group.commands.map((command) => <code key={command} className="border-2 border-black px-3 py-2 text-sm font-bold">!{command}</code>)}</div></article>)}</div></section>

    <section id="pareamento" className="border-t-4 border-black bg-orange-300 px-5 py-24 md:px-10"><div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[.9fr_1.1fr]"><div><span className="text-xs font-black uppercase tracking-[.2em]">/ 03 — conexão</span><h2 className="mt-4 text-6xl font-black leading-[.85] tracking-[-.07em] md:text-8xl">PAREIE.<br />LIGUE.<br />MANDE.</h2><p className="mt-8 max-w-md text-lg font-bold">Use o número configurado do GGZN SYSTEM. A sessão é restaurada automaticamente quando as credenciais locais existem.</p><div className="mt-8 flex items-center gap-3 text-xs font-black uppercase"><span className={`h-4 w-4 ${status.status === "connected" ? "bg-lime-400" : "bg-black"}`} /> status: {status.status}</div></div><div className="border-4 border-black bg-white p-6 md:p-8"><div className="mb-6 flex items-center justify-between border-b-4 border-black pb-4"><div><p className="text-xs font-black uppercase tracking-[.18em]">endpoint de pareamento</p><p className="mt-2 text-2xl font-black">{status.phone ?? "5534991286637"}</p></div><Radio className="h-8 w-8" /></div>{status.qrDataUrl ? <div className="flex flex-col items-center gap-4"><img src={status.qrDataUrl} alt="QR Code de pareamento do GGZN SYSTEM" className="h-64 w-64 border-4 border-black" /><p className="text-center text-xs font-black uppercase">Escaneie no WhatsApp &gt; aparelhos conectados</p></div> : status.pairingCode ? <div className="border-4 border-black p-6 text-center"><p className="text-xs font-black uppercase">código de pareamento</p><p className="my-5 break-all text-4xl font-black tracking-[.2em]">{status.pairingCode}</p><Button onClick={copyCode} className="rounded-none border-2 border-black bg-black font-black uppercase text-white hover:bg-lime-300 hover:text-black">{copied ? "Copiado" : "Copiar código"}<Copy className="ml-2 h-4 w-4" /></Button></div> : <div className="border-4 border-dashed border-black p-10 text-center"><LockKeyhole className="mx-auto mb-4 h-10 w-10" /><p className="font-black uppercase">Nenhum código ativo</p><p className="mt-2 text-sm font-bold">Clique abaixo para iniciar uma conexão.</p></div>}<Button onClick={pairing} disabled={loadingPairing} className="mt-6 h-14 w-full rounded-none border-4 border-black bg-lime-300 text-black font-black uppercase tracking-widest hover:bg-black hover:text-white">{loadingPairing ? "Gerando..." : "Gerar código de pareamento"}<RefreshCw className={`ml-3 h-5 w-5 ${loadingPairing ? "animate-spin" : ""}`} /></Button></div></div></section>

    <footer className="border-t-4 border-black px-5 py-8 md:px-10"><div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-5 text-xs font-black uppercase md:flex-row"><span>GGZN SYSTEM © 2026</span><span>Link direto / sem login / acesso restrito por divulgação</span><a href="#" className="underline">voltar ao topo ↑</a></div></footer>
  </main>;
}
