import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  type Demanda, type Colaborador, type Status, type Prioridade, type Complexidade, type Categoria,
  VALID_STATUSES, CATEGORIAS, STATUS_LABEL, SETORES,
} from "./types";
import {
  apiRequestDemandas, ensureArray, normalizeDateYmd, normalizeDemanda,
  insertDemandaInCache, replaceDemandaInCache,
} from "./utils";

export function DemandaForm({ initial, onSuccess }: { initial?: Partial<Demanda>; onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const [openResponsavel, setOpenResponsavel] = useState(false);

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => apiRequestDemandas("GET", "/api/empreendimentos"),
  });

  const { data: colaboradoresRaw = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
    queryFn: async () => apiRequestDemandas("GET", "/api/colaboradores"),
  });

  const colaboradores = Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [];

  const [form, setForm] = useState({
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    setor: initial?.setor ?? SETORES[0],
    prioridade: (initial?.prioridade ?? "media") as Prioridade,
    complexidade: (initial?.complexidade ?? "media") as Complexidade,
    categoria: (initial?.categoria ?? "geral") as Categoria,
    responsavelId: (initial as any)?.responsavelId ?? null,
    responsavelNome: (initial as any)?.responsavel ?? "",
    dataInicio: (initial as any)?.dataInicio ? normalizeDateYmd((initial as any).dataInicio) : "",
    dataEntrega: initial?.dataEntrega ? normalizeDateYmd(initial.dataEntrega) : "",
    status: (initial?.status ?? "a_fazer") as Status,
    empreendimentoId: initial?.empreendimentoId ? String(initial.empreendimentoId) : "",
    licencaId: (initial as any)?.licencaId ? String((initial as any).licencaId) : "",
    condicionanteId: (initial as any)?.condicionanteId ? String((initial as any).condicionanteId) : "",
  });

  const { data: licencasEmp = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos", form.empreendimentoId, "licencas"],
    queryFn: async () => apiRequestDemandas("GET", `/api/empreendimentos/${form.empreendimentoId}/licencas`),
    enabled: Boolean(form.empreendimentoId),
  });

  const { data: condicionantesLic = [] } = useQuery<any[]>({
    queryKey: ["/api/licencas", form.licencaId, "condicionantes"],
    queryFn: async () => apiRequestDemandas("GET", `/api/licencas/${form.licencaId}/condicionantes`),
    enabled: Boolean(form.licencaId),
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Demanda> => {
      if (!form.responsavelId) throw new Error("Selecione um responsável.");
      const payload: any = {
        titulo: String(form.titulo).trim(),
        descricao: String(form.descricao).trim(),
        setor: form.setor,
        prioridade: form.prioridade,
        complexidade: form.complexidade,
        categoria: form.categoria,
        dataInicio: form.dataInicio || null,
        dataEntrega: form.dataEntrega,
        status: form.status ?? "a_fazer",
        responsavelId: form.responsavelId,
      };
      if (form.empreendimentoId) payload.empreendimentoId = Number(form.empreendimentoId);
      if (form.licencaId) payload.licencaId = Number(form.licencaId);
      if (form.condicionanteId) {
        payload.condicionanteId = Number(form.condicionanteId);
        payload.origem = "condicionante";
      }
      const res = isEdit && initial?.id != null
        ? await apiRequestDemandas<any>("PATCH", `/api/demandas/${initial.id}`, payload)
        : await apiRequestDemandas<any>("POST", "/api/demandas", payload);
      const norm = normalizeDemanda(res) ?? normalizeDemanda(res?.data) ?? null;
      if (!norm) throw new Error("Resposta inválida do servidor ao salvar demanda.");
      const nome = colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? null;
      return { ...norm, responsavelId: form.responsavelId, responsavel: nome };
    },
    onSuccess: async (createdOrUpdated: Demanda) => {
      if (!isEdit) insertDemandaInCache(queryClient, createdOrUpdated);
      else replaceDemandaInCache(queryClient, createdOrUpdated);
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/dashboard/stats"] });
      toast({ title: isEdit ? "Demanda atualizada." : "Demanda criada." });
      onSuccess();
    },
    onError: (e: Error) => {
      toast({ title: "Falha ao salvar", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    },
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <div>
        <Label>Título *</Label>
        <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
      </div>

      <div>
        <Label>Descrição *</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
      </div>

      <div>
        <Label>Empreendimento</Label>
        <Select value={form.empreendimentoId || ""} onValueChange={(v) => setForm({ ...form, empreendimentoId: v, licencaId: "", condicionanteId: "" })}>
          <SelectTrigger><SelectValue placeholder="Selecione um empreendimento (opcional)" /></SelectTrigger>
          <SelectContent>
            {ensureArray<any>(empreendimentos).map((emp: any) => (
              <SelectItem key={emp.id} value={String(emp.id)}>{emp.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.empreendimentoId && (
        <div>
          <Label>Licença Ambiental <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Select value={form.licencaId || ""} onValueChange={(v) => setForm({ ...form, licencaId: v, condicionanteId: "" })}>
            <SelectTrigger><SelectValue placeholder="Selecione uma licença" /></SelectTrigger>
            <SelectContent>
              {ensureArray<any>(licencasEmp).map((lic: any) => (
                <SelectItem key={lic.id} value={String(lic.id)}>{lic.numero} — {lic.tipo || "Licença"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.licencaId && (
        <div>
          <Label>Exigência / Condicionante <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Select value={form.condicionanteId || ""} onValueChange={(v) => {
            const cond = condicionantesLic.find((c: any) => String(c.id) === v);
            const updates: any = { condicionanteId: v };
            if (cond && !form.dataEntrega && cond.prazo) updates.dataEntrega = cond.prazo;
            setForm({ ...form, ...updates });
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione a exigência" /></SelectTrigger>
            <SelectContent>
              {ensureArray<any>(condicionantesLic).map((cond: any, idx: number) => {
                const num = cond.item || String(idx + 1);
                const label = cond.titulo || cond.descricao?.substring(0, 60);
                return (
                  <SelectItem key={cond.id} value={String(cond.id)}>
                    <span className="font-mono text-xs mr-1">{num}.</span> {label}
                    {cond.codigo ? <span className="text-muted-foreground ml-1">[{cond.codigo}]</span> : null}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {form.condicionanteId && (() => {
            const cond = condicionantesLic.find((c: any) => String(c.id) === form.condicionanteId);
            if (!cond) return null;
            return (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/50 rounded px-2 py-1">
                {cond.descricao}
              </p>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Setor *</Label>
          <Select value={form.setor} onValueChange={(v) => setForm({ ...form, setor: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
            <SelectContent>
              {SETORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Prioridade *</Label>
          <Select value={form.prioridade} onValueChange={(v: Prioridade) => setForm({ ...form, prioridade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Complexidade *</Label>
          <Select value={form.complexidade} onValueChange={(v: Complexidade) => setForm({ ...form, complexidade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa (5 pts)</SelectItem>
              <SelectItem value="media">Média (15 pts)</SelectItem>
              <SelectItem value="alta">Alta (30 pts)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Categoria *</Label>
        <Select value={form.categoria} onValueChange={(v: Categoria) => setForm({ ...form, categoria: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <Label className="mb-2">Responsável *</Label>
          <Popover open={openResponsavel} onOpenChange={setOpenResponsavel}>
            <PopoverTrigger asChild>
              <Button
                variant="outline" role="combobox" aria-expanded={openResponsavel}
                className={cn("w-full justify-between", !form.responsavelId && "text-muted-foreground")}
              >
                {form.responsavelId
                  ? colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? "Selecionado"
                  : "Selecione um colaborador"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0">
              <Command>
                <CommandInput placeholder="Buscar colaborador..." />
                <CommandList>
                  <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                  <CommandGroup>
                    {colaboradores.filter((c) => c.tipo === "user" && c.id).map((colab) => (
                      <CommandItem
                        key={`${colab.tipo}-${colab.id}`}
                        value={colab.nome}
                        onSelect={() => { setForm({ ...form, responsavelId: colab.id, responsavelNome: colab.nome }); setOpenResponsavel(false); }}
                      >
                        <User className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{colab.nome}</span>
                          {colab.email && <span className="text-xs text-muted-foreground">{colab.email}</span>}
                        </div>
                        <Check className={cn("ml-auto h-4 w-4", form.responsavelId === colab.id ? "opacity-100" : "opacity-0")} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {form.responsavelId && (() => {
            const resp = colaboradores.find(c => c.id === form.responsavelId);
            if (!resp) return null;
            return resp.whatsapp ? (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">✅ Receberá notificação por WhatsApp</p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">⚠️ Sem WhatsApp — cadastre em Sistema → Gerenciar Usuários</p>
            );
          })()}
        </div>

        <div>
          <Label>Data Início</Label>
          <Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} placeholder="Opcional" />
        </div>

        <div>
          <Label>Data Entrega *</Label>
          <Input type="date" value={form.dataEntrega} onChange={(e) => setForm({ ...form, dataEntrega: e.target.value })} required />
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Para demandas de vários dias, preencha Data Início e Data Entrega. Ex: 13/01 a 17/01
      </p>

      {isEdit && (
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VALID_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Salvar alterações" : "Criar demanda"}
      </Button>
    </form>
  );
}
