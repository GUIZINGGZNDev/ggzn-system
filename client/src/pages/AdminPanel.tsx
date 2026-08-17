import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { removeAutoReply, replaceRule, toggleAutoReply, toggleRule } from "./AdminPanel.helpers";
import { ArrowLeft, Bot, Check, ChevronRight, Image as ImageIcon, Link2, LoaderCircle, Plus, Save, Shield, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type Rule = { id: string; text: string; enabled: boolean };
type AutoReply = { trigger: string; response: string; enabled: boolean };
type FeatureConfig = { slowmodeSeconds: number; antiFlood: boolean; blockLinks: boolean; logs: boolean; warnings: Record<string, string[]> };

export default function AdminPanel() {
  const groups = trpc.botAdmin.listGroups.useQuery(undefined, { retry: false });
  const [selectedJid, setSelectedJid] = useState("");
  const group = trpc.botAdmin.getGroup.useQuery({ jid: selectedJid }, { enabled: Boolean(selectedJid), retry: false });
  const update = trpc.botAdmin.updateGroup.useMutation();
  const clone = trpc.botAdmin.cloneGroup.useMutation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [newRule, setNewRule] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [featureConfig, setFeatureConfig] = useState<FeatureConfig>({ slowmodeSeconds: 0, antiFlood: false, blockLinks: false, logs: false, warnings: {} });
  const [includeParticipants, setIncludeParticipants] = useState(false);
  const [cloneConfirmation, setCloneConfirmation] = useState("");
  const [cloneStage, setCloneStage] = useState(0);
  const cloneStages = ["Lendo dados do grupo", "Criando novo grupo", "Aplicando permissões", "Copiando configurações", "Finalizando clone"];

  useEffect(() => {
    if (!selectedJid && groups.data?.[0]) setSelectedJid(groups.data[0].jid);
  }, [groups.data, selectedJid]);

  useEffect(() => {
    if (!clone.isPending) {
      setCloneStage(0);
      return;
    }
    const timer = window.setInterval(() => setCloneStage((current) => (current + 1) % cloneStages.length), 1200);
    return () => window.clearInterval(timer);
  }, [clone.isPending, cloneStages.length]);

  useEffect(() => {
    if (group.data) {
      setRules(group.data.rules);
      setAutoReplies(group.data.autoReplies);
      setFeatureConfig(group.data.featureConfig);
    }
  }, [group.data]);

  const selectedName = useMemo(() => groups.data?.find((item) => item.jid === selectedJid)?.name ?? "Nenhum grupo selecionado", [groups.data, selectedJid]);
  const hasChanges = useMemo(() => {
    if (!group.data) return false;
    return JSON.stringify(group.data.rules) !== JSON.stringify(rules) || JSON.stringify(group.data.autoReplies) !== JSON.stringify(autoReplies) || JSON.stringify(group.data.featureConfig) !== JSON.stringify(featureConfig);
  }, [group.data, rules, autoReplies, featureConfig]);
  const save = () => {
    if (!selectedJid || !hasChanges || update.isPending) return;
    update.mutate({ jid: selectedJid, rules, autoReplies, featureConfig }, { onSuccess: () => void group.refetch() });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#f5f4ef] text-black -m-4 p-5 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 border-b-4 border-black pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-lime-700"><Shield className="h-4 w-4" /> Área protegida</div>
              <h1 className="text-4xl font-black uppercase tracking-tight md:text-6xl">GGZN CONTROL</h1>
              <p className="mt-2 max-w-xl font-medium text-black/65">Administração privada de regras e automações por grupo.</p>
            </div>
            <Link href="/"><Button variant="outline" className="border-2 border-black bg-transparent font-black uppercase"><ArrowLeft className="mr-2 h-4 w-4" /> Site público</Button></Link>
          </header>

          {groups.isError ? <Card className="border-2 border-red-600 bg-red-50"><CardContent className="p-5 font-bold">Acesso negado ou sessão expirada. Entre com uma conta administradora para continuar.</CardContent></Card> : null}

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <Card className="rounded-none border-2 border-black bg-white shadow-[6px_6px_0_#b7ff2a]">
              <CardHeader className="border-b-2 border-black"><CardTitle className="flex items-center gap-2 text-sm font-black uppercase"><Bot className="h-4 w-4" /> Grupos</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3">
                {groups.isLoading ? <p className="p-2 text-sm font-bold">Carregando...</p> : null}
                {!groups.isLoading && !groups.data?.length ? <p className="p-2 text-sm font-bold text-black/60">Nenhum grupo registrado ainda.</p> : null}
                {groups.data?.map((item) => <button key={item.jid} onClick={() => setSelectedJid(item.jid)} aria-pressed={selectedJid === item.jid} className={`flex min-h-14 w-full items-center justify-between border-2 p-3 text-left transition ${selectedJid === item.jid ? "border-black bg-lime-300" : "border-transparent bg-black/5 hover:border-black"}`}><span className="min-w-0"><span className="block truncate font-black">{item.name}</span><span className="block truncate text-xs font-mono opacity-60">{item.jid}</span></span><ChevronRight className="h-4 w-4 shrink-0" /></button>)}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="rounded-none border-2 border-black text-white bg-black shadow-[6px_6px_0_#ffb15c]"><CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">Grupo ativo</p><h2 className="mt-1 text-2xl font-black uppercase">{selectedName}</h2><p className="font-mono text-xs text-white/60">{selectedJid || "Selecione um grupo"}</p></div><Button onClick={save} disabled={!selectedJid || !hasChanges || update.isPending} className="min-h-11 bg-lime-300 font-black text-black hover:bg-lime-200 disabled:opacity-50"><Save className="mr-2 h-4 w-4" /> {update.isPending ? "Salvando" : hasChanges ? "Salvar tudo" : "Tudo salvo"}</Button></CardContent></Card>

              <Card className="rounded-none border-2 border-black bg-orange-200 shadow-[4px_4px_0_#050505]"><CardHeader className="border-b-2 border-black"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Bot className="h-5 w-5" /> Clonar este grupo</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><p className="text-sm font-bold">Cria um novo grupo com nome, foto, descrição, permissões e configurações do GGZN. A inclusão de membros é opcional e pode falhar para participantes protegidos pelo WhatsApp.</p><div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm font-black uppercase"><input type="checkbox" checked={includeParticipants} onChange={(event) => setIncludeParticipants(event.target.checked)} className="h-5 w-5 accent-black" /> Incluir membros</label><div className="flex min-w-[180px] flex-1 items-center gap-2"><Label htmlFor="clone-confirmation" className="sr-only">Confirmação</Label><Input id="clone-confirmation" value={cloneConfirmation} onChange={(event) => setCloneConfirmation(event.target.value.toUpperCase())} placeholder="Digite CLONAR" className="rounded-none border-2 border-black bg-white font-black" /><Button onClick={() => clone.mutate({ sourceJid: selectedJid, includeParticipants, confirmation: "CLONAR" }, { onSuccess: () => setCloneConfirmation("") })} disabled={!selectedJid || cloneConfirmation !== "CLONAR" || clone.isPending} className="rounded-none border-2 border-black bg-black font-black uppercase text-white hover:bg-lime-300 hover:text-black" aria-busy={clone.isPending}>{clone.isPending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Processando</> : "Criar clone"}</Button></div></div>{clone.isPending ? <div className="space-y-2 border-2 border-black bg-black p-3 text-white" role="status" aria-live="polite"><div className="flex items-center gap-2 text-sm font-black uppercase"><LoaderCircle className="h-5 w-5 animate-spin text-lime-300" /> {cloneStages[cloneStage]}</div><div className="h-2 overflow-hidden bg-white/20"><div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] bg-lime-300" /></div><p className="text-xs font-bold text-white/70">Não feche esta página nem clique novamente. A operação pode levar alguns segundos.</p></div> : null}{clone.isError ? <p role="alert" className="border-2 border-red-700 bg-red-50 p-3 font-bold text-red-900">{clone.error.message}</p> : null}{clone.data ? <div className="border-2 border-black bg-white p-3 text-sm font-bold"><p className="uppercase">Clone criado: {clone.data.name}</p><p className="font-mono">{clone.data.newJid}</p><p className="mt-2">Copiado: {clone.data.copied.join(", ")}</p>{clone.data.skipped.length ? <p className="mt-1 text-red-800">Não copiado: {clone.data.skipped.join(", ")}</p> : null}</div> : null}</CardContent></Card>

              <Card className="rounded-none border-2 border-black bg-white shadow-[4px_4px_0_#b7ff2a]"><CardHeader className="border-b-2 border-black"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><SlidersHorizontal className="h-5 w-5" /> Controles de moderação</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="flex cursor-pointer items-center justify-between gap-3 border-2 border-black p-3"><span><span className="block text-sm font-black uppercase">Anti-flood</span><span className="text-xs font-medium text-black/60">Limita rajadas</span></span><input type="checkbox" checked={featureConfig.antiFlood} onChange={(event) => setFeatureConfig({ ...featureConfig, antiFlood: event.target.checked })} className="h-5 w-5 accent-lime-400" /></label><label className="flex cursor-pointer items-center justify-between gap-3 border-2 border-black p-3"><span><span className="block text-sm font-black uppercase">Bloquear links</span><span className="text-xs font-medium text-black/60">Filtra URLs</span></span><input type="checkbox" checked={featureConfig.blockLinks} onChange={(event) => setFeatureConfig({ ...featureConfig, blockLinks: event.target.checked })} className="h-5 w-5 accent-lime-400" /></label><label className="flex cursor-pointer items-center justify-between gap-3 border-2 border-black p-3"><span><span className="block text-sm font-black uppercase">Logs admin</span><span className="text-xs font-medium text-black/60">Registra ações</span></span><input type="checkbox" checked={featureConfig.logs} onChange={(event) => setFeatureConfig({ ...featureConfig, logs: event.target.checked })} className="h-5 w-5 accent-lime-400" /></label><label className="border-2 border-black p-3"><span className="block text-sm font-black uppercase">Slowmode (seg.)</span><Input type="number" min={0} max={3600} value={featureConfig.slowmodeSeconds} onChange={(event) => setFeatureConfig({ ...featureConfig, slowmodeSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })} className="mt-2 h-9 rounded-none border-2 border-black" /></label></CardContent></Card>

              <Card className="rounded-none border-2 border-black bg-[#050505] text-white shadow-[4px_4px_0_#ffb15c]"><CardHeader className="border-b-2 border-white/30"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><ImageIcon className="h-5 w-5 text-lime-300" /> Fotos dos menus</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7">{[{ label: "Principal", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-principal-v2_4dbb8250.jpg" }, { label: "ADM", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-adm-v2_2d4241c1.jpg" }, { label: "Zoeira", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-zoeira-v2_4053a42f.jpg" }, { label: "Info", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-info-v2_09809cc7.jpg" }, { label: "Mod", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-mod-v2_a7f4c2a5.jpg" }, { label: "IA", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-ia-v2_1dd62a6d.jpg" }, { label: "Performance", url: "https://ggznbot-g89bqgka.manus.space/manus-storage/ggzn-menu-performance-v2_270d8af6.jpg" }].map((photo) => <figure key={photo.label} className="overflow-hidden border-2 border-white/30"><img src={photo.url} alt={`Foto do menu ${photo.label}`} className="aspect-[4/5] w-full object-cover" loading="lazy" /><figcaption className="border-t border-white/30 p-2 text-[10px] font-black uppercase text-lime-300">{photo.label}</figcaption></figure>)}</CardContent></Card>

              <div className="grid gap-5 xl:grid-cols-2">
                <Card className="rounded-none border-2 border-black bg-white"><CardHeader className="border-b-2 border-black"><CardTitle className="text-lg font-black uppercase">Regras do grupo</CardTitle></CardHeader><CardContent className="space-y-4 p-5">
                  <div className="flex gap-2"><Input value={newRule} onChange={(event) => setNewRule(event.target.value)} placeholder="Nova regra" className="rounded-none border-2 border-black" /><Button onClick={() => { if (newRule.trim()) { setRules([...rules, { id: crypto.randomUUID(), text: newRule.trim(), enabled: true }]); setNewRule(""); } }} className="rounded-none bg-black text-white"><Plus className="h-4 w-4" /></Button></div>
                  <div className="space-y-2">{rules.map((rule, index) => <div key={rule.id} className="flex items-center gap-2 border-2 border-black p-2"><span className="w-7 shrink-0 font-black">{index + 1}.</span><Input value={rule.text} onChange={(event) => setRules(replaceRule(rules, rule.id, event.target.value))} className="h-8 rounded-none border-0 bg-transparent p-0 font-medium focus-visible:ring-0" /><Button variant="outline" onClick={() => setRules(toggleRule(rules, rule.id))} className="h-8 rounded-none border-2 border-black px-2 text-xs font-black">{rule.enabled ? "Ativa" : "Pausada"}</Button><Button variant="ghost" size="icon" onClick={() => setRules(rules.filter((item) => item.id !== rule.id))} aria-label="Remover regra"><Trash2 className="h-4 w-4 text-red-600" /></Button></div>)}</div>
                </CardContent></Card>

                <Card className="rounded-none border-2 border-black bg-white"><CardHeader className="border-b-2 border-black"><CardTitle className="text-lg font-black uppercase">Auto-respostas</CardTitle></CardHeader><CardContent className="space-y-4 p-5">
                  <div className="grid gap-2 sm:grid-cols-2"><div><Label className="text-xs font-black uppercase">Gatilho</Label><Input value={newTrigger} onChange={(event) => setNewTrigger(event.target.value)} placeholder="bom dia" className="mt-1 rounded-none border-2 border-black" /></div><div><Label className="text-xs font-black uppercase">Resposta</Label><Input value={newResponse} onChange={(event) => setNewResponse(event.target.value)} placeholder="Bom dia!" className="mt-1 rounded-none border-2 border-black" /></div></div>
                  <Button onClick={() => { if (newTrigger.trim() && newResponse.trim()) { setAutoReplies([...autoReplies, { trigger: newTrigger.trim(), response: newResponse.trim(), enabled: true }]); setNewTrigger(""); setNewResponse(""); } }} className="w-full rounded-none bg-black font-black uppercase text-white"><Plus className="mr-2 h-4 w-4" /> Adicionar auto-resposta</Button>
                  <div className="space-y-2">{autoReplies.map((item) => <div key={item.trigger} className="border-2 border-black p-3"><div className="flex items-center justify-between gap-2"><Input value={item.trigger} onChange={(event) => setAutoReplies(autoReplies.map((reply) => reply.trigger === item.trigger ? { ...reply, trigger: event.target.value } : reply))} className="h-8 max-w-[180px] rounded-none border-2 border-black font-black" /><div className="flex items-center gap-2"><Badge className={item.enabled ? "bg-lime-300 text-black" : "bg-black/10 text-black"}>{item.enabled ? "ATIVA" : "PAUSADA"}</Badge><Button variant="ghost" size="icon" onClick={() => setAutoReplies(removeAutoReply(autoReplies, item.trigger))} aria-label="Remover auto-resposta"><Trash2 className="h-4 w-4 text-red-600" /></Button></div></div><div className="mt-2 flex items-center gap-2"><Input value={item.response} onChange={(event) => setAutoReplies(autoReplies.map((reply) => reply.trigger === item.trigger ? { ...reply, response: event.target.value } : reply))} className="h-8 rounded-none border-0 bg-black/5 text-sm focus-visible:ring-0" /><Button variant="outline" onClick={() => setAutoReplies(toggleAutoReply(autoReplies, item.trigger))} className="h-8 rounded-none border-2 border-black px-2 text-xs font-black">{item.enabled ? "Pausar" : "Ativar"}</Button></div></div>)}</div>
                </CardContent></Card>
              </div>
              <div aria-live="polite" className="space-y-2">
                {update.isError ? <p role="alert" className="border-2 border-red-600 bg-red-50 p-3 font-bold text-red-800">Não foi possível salvar agora. Verifique sua sessão e tente novamente.</p> : null}
                {update.isSuccess && !hasChanges ? <p className="flex items-center gap-2 font-bold text-lime-700"><Check className="h-4 w-4" /> Configurações salvas.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export { AdminPanel };
