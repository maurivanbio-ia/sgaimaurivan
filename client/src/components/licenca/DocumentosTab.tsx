import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Link2, ExternalLink } from "lucide-react";
import type { Condicionante } from "@shared/schema";
import { STATUS_CONDICIONANTE } from "./types";
import { EvidenciasPanel } from "./EvidenciasPanel";

const LICENCA_VINCULO_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  requerimento:    { label: "Requerimento",     icon: "📋", color: "bg-blue-100 text-blue-800 border-blue-200" },
  protocolo:       { label: "Protocolo",         icon: "📮", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  notificacao:     { label: "Notificação",       icon: "📬", color: "bg-orange-100 text-orange-800 border-orange-200" },
  resposta:        { label: "Resposta/Ofício",   icon: "📩", color: "bg-green-100 text-green-800 border-green-200" },
  renovacao:       { label: "Renovação",         icon: "🔄", color: "bg-teal-100 text-teal-800 border-teal-200" },
  complementacao:  { label: "Complementação",    icon: "➕", color: "bg-purple-100 text-purple-800 border-purple-200" },
  recurso:         { label: "Recurso",           icon: "⚖️", color: "bg-red-100 text-red-800 border-red-200" },
  outro:           { label: "Outro",             icon: "📄", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

export function DocumentosTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const { data: docsGestao = [], isLoading: loadingDocs } = useQuery<any[]>({
    queryKey: ["/api/licencas", licencaId, "documentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/documentos`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* ── Documentos da Gestão de Dados ────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-1 rounded-full bg-green-600" />
          <h3 className="font-semibold text-sm">Documentos da Gestão de Dados</h3>
          <Badge variant="secondary" className="text-xs">{docsGestao.length}</Badge>
          <a href="/gestao-dados" className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Abrir Gestão de Dados
          </a>
        </div>
        {loadingDocs ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
        ) : docsGestao.length === 0 ? (
          <div className="border rounded-lg p-6 text-center text-muted-foreground bg-muted/20">
            <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento da Gestão de Dados vinculado a esta licença.</p>
            <p className="text-xs mt-1 opacity-70">No módulo Gestão de Dados, edite um documento e vincule-o a esta licença.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Documento</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo de Relação</th>
                  <th className="px-3 py-2 text-left font-medium">Órgão</th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {docsGestao.map((doc: any, idx: number) => {
                  const vinculo = LICENCA_VINCULO_LABELS[doc.licencaVinculoTipo] || LICENCA_VINCULO_LABELS["outro"];
                  return (
                    <tr key={doc.id} className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-xs leading-tight">{doc.titulo || doc.codigoArquivo || doc.nome}</p>
                        {doc.numeroDocumento && <p className="text-muted-foreground text-xs">Nº {doc.numeroDocumento}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {doc.licencaVinculoTipo ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${vinculo.color}`}>
                            {vinculo.icon} {vinculo.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.orgaoEmissor || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {doc.dataEmissao
                          ? new Intl.DateTimeFormat("pt-BR").format(new Date(doc.dataEmissao + "T12:00:00"))
                          : doc.dataUpload
                            ? new Intl.DateTimeFormat("pt-BR").format(new Date(doc.dataUpload))
                            : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {doc.statusDocumental || doc.status || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Evidências por Condicionante ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-1 rounded-full bg-blue-600" />
          <h3 className="font-semibold text-sm">Evidências por Condicionante</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Evidências são gerenciadas por condicionante. Selecione uma condicionante abaixo para ver ou adicionar evidências.
        </p>
        {condicionantes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma condicionante cadastrada. Vá à aba Condicionantes para começar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {condicionantes.map(cond => (
              <Card key={cond.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {(cond as any).codigo && <code className="bg-muted px-1 rounded text-xs">{(cond as any).codigo}</code>}
                    {(cond as any).titulo || cond.descricao.substring(0, 80)}
                    <Badge className={`text-xs ml-auto ${STATUS_CONDICIONANTE[cond.status]?.color}`}>
                      {STATUS_CONDICIONANTE[cond.status]?.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EvidenciasPanel condicionanteId={cond.id} licencaId={licencaId} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
