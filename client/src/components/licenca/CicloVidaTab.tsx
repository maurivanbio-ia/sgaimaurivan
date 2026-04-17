import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, Link2, RefreshCcw, ExternalLink, ClipboardList, RefreshCw, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const VINCULO_EVENTO: Record<string, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  requerimento:   { label: "Requerimento de Renovação",  icon: "📋", color: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-300" },
  protocolo:      { label: "Protocolo",                  icon: "📮", color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-300" },
  notificacao:    { label: "Notificação Recebida",       icon: "📬", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-300" },
  resposta:       { label: "Resposta / Ofício",          icon: "📩", color: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-300" },
  renovacao:      { label: "Nova Licença Emitida",       icon: "✅", color: "text-teal-700",   bgColor: "bg-teal-50",   borderColor: "border-teal-300" },
  complementacao: { label: "Complementação",             icon: "➕", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-300" },
  recurso:        { label: "Recurso",                    icon: "⚖️", color: "text-red-700",    bgColor: "bg-red-50",    borderColor: "border-red-300" },
  outro:          { label: "Documento Vinculado",        icon: "📄", color: "text-gray-700",   bgColor: "bg-gray-50",   borderColor: "border-gray-300" },
};

function formatEvDate(d: string | null) {
  if (!d) return "Data não informada";
  try {
    const [y, m, day] = d.split("T")[0].split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

export function CicloVidaTab({ licenca, licencaId, onRenovar }: { licenca: any; licencaId: number; onRenovar?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: docsGestao = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/licencas", licencaId, "documentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/documentos`);
      return res.json();
    },
  });

  const syncStatusMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/licencas/${licencaId}`, { status: "em_renovacao" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/licencas"] });
      toast({
        title: "Status sincronizado automaticamente",
        description: "Licença marcada como Em Renovação pois possui requerimento vinculado.",
      });
    },
  });

  const cancelarRenovacaoMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/licencas/${licencaId}`, { status: "vencida" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/licencas"] });
      toast({ title: "Renovação cancelada", description: "Licença voltou ao status Vencida." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível cancelar a renovação.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (docsGestao.length === 0) return;
    const temRequerimento = docsGestao.some((d: any) => d.licencaVinculoTipo === "requerimento");
    if (temRequerimento && licenca.status === "vencida" && !syncStatusMutation.isPending && !syncStatusMutation.isSuccess) {
      syncStatusMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsGestao, licenca.status]);

  // Construir eventos cronológicos
  type Evento = {
    date: string | null;
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    doc?: any;
    type: "emissao" | "doc" | "validade" | "status";
  };

  const eventos: Evento[] = [];

  eventos.push({
    date: licenca.dataEmissao || null,
    label: `Licença ${licenca.numero} emitida`,
    icon: "🛡️",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    type: "emissao",
  });

  const docsOrdenados = [...docsGestao].sort((a, b) => {
    const da = a.dataEmissao || a.dataUpload || "";
    const db2 = b.dataEmissao || b.dataUpload || "";
    return da.localeCompare(db2);
  });

  for (const doc of docsOrdenados) {
    const ev = VINCULO_EVENTO[doc.licencaVinculoTipo || "outro"] || VINCULO_EVENTO["outro"];
    eventos.push({ date: doc.dataEmissao || doc.dataUpload || null, label: ev.label, icon: ev.icon, color: ev.color, bgColor: ev.bgColor, borderColor: ev.borderColor, doc, type: "doc" });
  }

  const statusAtual = licenca.status;
  if (statusAtual === "em_renovacao") {
    eventos.push({ date: null, label: "Em Processo de Renovação", icon: "⏳", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-400", type: "status" });
  } else if (statusAtual === "vencida") {
    eventos.push({ date: licenca.validade || null, label: "Licença Vencida", icon: "🔴", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-400", type: "validade" });
  } else if (statusAtual === "cancelada") {
    eventos.push({ date: null, label: "Licença Cancelada", icon: "❌", color: "text-gray-700", bgColor: "bg-gray-50", borderColor: "border-gray-400", type: "status" });
  } else {
    eventos.push({ date: licenca.validade || null, label: "Validade da Licença", icon: "📅", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-300", type: "validade" });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-base">Ciclo de Vida — {licenca.numero}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Linha do tempo de eventos e documentos vinculados a esta licença, em ordem cronológica.
        </p>
      </div>

      {licenca.status === "em_renovacao" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 font-medium">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Licença em processo de renovação
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Quando a nova licença for emitida, registre-a no sistema para encerrar este ciclo.
            Caso o processo seja cancelado, reporte abaixo.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {onRenovar ? (
              <Button size="sm" onClick={onRenovar} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Nova Licença Emitida
              </Button>
            ) : (
              <Button size="sm" asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <a href={`/empreendimentos/${licenca.empreendimentoId}`}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Ir para o Empreendimento
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={cancelarRenovacaoMutation.isPending}
              onClick={() => cancelarRenovacaoMutation.mutate()}
              className="gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar Renovação
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <ClipboardList className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          O status desta licença é atualizado <strong>automaticamente</strong> ao cadastrar documentos vinculados em{" "}
          <strong>Gestão de Dados</strong>. Para registrar um requerimento de renovação, acesse Gestão de Dados,
          faça upload do protocolo e selecione esta licença com o tipo de relação{" "}
          <em>Requerimento</em>.
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Clock className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-300 via-blue-200 to-gray-200" />
          <div className="space-y-0">
            {eventos.map((ev, idx) => (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                <div className={`relative z-10 flex-shrink-0 h-12 w-12 rounded-full ${ev.bgColor} border-2 ${ev.borderColor} flex items-center justify-center text-xl shadow-sm`}>
                  {ev.icon}
                </div>
                <div className={`flex-1 rounded-lg border ${ev.borderColor} ${ev.bgColor} p-3 shadow-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${ev.color}`}>{ev.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatEvDate(ev.date)}</p>
                      {ev.doc && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {ev.doc.titulo || ev.doc.codigoArquivo || ev.doc.nome}
                          </p>
                          {ev.doc.numeroDocumento && <p className="text-xs text-muted-foreground">Nº {ev.doc.numeroDocumento}</p>}
                          {ev.doc.orgaoEmissor && <p className="text-xs text-muted-foreground">🏛 {ev.doc.orgaoEmissor}</p>}
                          {ev.doc.statusDocumental && (
                            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs bg-white border border-gray-200 text-gray-600">
                              {ev.doc.statusDocumental}
                            </span>
                          )}
                        </div>
                      )}
                      {ev.type === "validade" && licenca.validade && (
                        <p className="text-xs mt-1">
                          {new Date(licenca.validade + "T00:00:00") > new Date()
                            ? <span className="text-green-700">Ainda vigente</span>
                            : <span className="text-red-600 font-medium">⚠ Vencida</span>
                          }
                        </p>
                      )}
                    </div>
                    {ev.type === "doc" && ev.doc?.licencaVinculoTipo && (
                      <span className={`flex-shrink-0 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${ev.bgColor} ${ev.color} ${ev.borderColor}`}>
                        {VINCULO_EVENTO[ev.doc.licencaVinculoTipo]?.label || "Documento"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docsGestao.length === 0 && !isLoading && (
        <div className="border rounded-lg p-6 text-center text-muted-foreground bg-muted/20 mt-4">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum evento registrado</p>
          <p className="text-xs mt-1 opacity-70">Vincule documentos da Gestão de Dados a esta licença para construir o ciclo de vida.</p>
          <a href="/gestao-dados" className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Abrir Gestão de Dados
          </a>
        </div>
      )}
    </div>
  );
}
