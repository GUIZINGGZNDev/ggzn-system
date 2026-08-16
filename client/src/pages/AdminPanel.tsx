import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { removeAutoReply, replaceRule, toggleAutoReply, toggleRule } from "./AdminPanel.helpers";
import { ArrowLeft, Bot, Check, ChevronRight, Plus, Save, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type Rule = { id: string; text: string; enabled: boolean };
type AutoReply = { trigger: string; response: string; enabled: boolean };

export default function AdminPanel() {
  const groups = trpc.botAdmin.listGroups.useQuery(undefined, { retry: false });
  const [selectedJid, setSelectedJid] = useState("");
  const group = trpc.botAdmin.getGroup.useQuery({ jid: selectedJid }, { enabled: Boolean(selectedJid), retry: false });
  const update = trpc.botAdmin.updateGroup.useMutation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [newRule, setNewRule] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newResponse, setNewResponse] = useState("");

  useEffect(() => {
    if (!selectedJid && groups.data?.[0]) setSelectedJid(groups.data[0].jid);
  }, [groups.data, selectedJid]);

  useEffect(() => {
    if (group.data) {
      setRules(group.data.rules);
      setAutoReplies(group.data.autoReplies);
    }
  }, [group.data]);

  const selectedName = useMemo(() => groups.data?.find((item) => item.jid === selectedJid)?.name ?? "Nenhum grupo selecionado", [groups.data, selectedJid]);
  const hasChanges = useMemo(() => {
    if (!group.data) return false;
    return JSON.stringify(group.data.rules) !== JSON.stringify(rules) || JSON.stringify(group.data.autoReplies) !== JSON.stringify(autoReplies);
  }, [group.data, rules, autoReplies]);
  const save = () => {
    if (!selectedJid || !hasChanges || update.isPending) return;
    update.mutate({ jid: selectedJid, rules, autoReplies }, { onSuccess: () => void group.refetch() });
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
              <Card className="rounded-none border-2 border-black bg-black text-white shadow-[6px_6px_0_#ffb15c]"><CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">Grupo ativo</p><h2 className="mt-1 text-2xl font-black uppercase">{selectedName}</h2><p className="font-mono text-xs text-white/60">{selectedJid || "Selecione um grupo"}</p></div><Button onClick={save} disabled={!selectedJid || !hasChanges || update.isPending} className="min-h-11 bg-lime-300 font-black text-black hover:bg-lime-200 disabled:opacity-50"><Save className="mr-2 h-4 w-4" /> {update.isPending ? "Salvando" : hasChanges ? "Salvar tudo" : "Tudo salvo"}</Button></CardContent></Card>

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
