import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/date-utils";
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle2, FileText,
  History, CalendarDays, ChevronRight, Download, Pencil,
} from "lucide-react";
import {
  getLicencaStatusColor, getLicencaStatusLabel, isArquivoAcessivel,
  diasParaVencer, type LicencaComEmpreendimento,
} from "@/components/licenca/types";
import { CondicionantesTab } from "@/components/licenca/CondicionantesTab";
import { DocumentosTab } from "@/components/licenca/DocumentosTab";
import { CicloVidaTab } from "@/components/licenca/CicloVidaTab";
import { CronogramaTab } from "@/components/licenca/CronogramaTab";
import { HistoricoTab } from "@/components/licenca/HistoricoTab";

export default function LicenseDetail() {
  const [, params] = useRoute("/licencas/:id");
  const licencaId = parseInt(params?.id || "0");

  const { data: licenca, isLoading } = useQuery<LicencaComEmpreendimento>({
    queryKey: ["/api/licencas", licencaId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}`);
      return res.json();
    },
    enabled: !!licencaId,
  });

  const { data: empreendimento } = useQuery<any>({
    queryKey: ["/api/empreendimentos", licenca?.empreendimentoId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/empreendimentos/${licenca!.empreendimentoId}`);
      return res.json();
    },
    enabled: !!licenca?.empreendimentoId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando licença...</div>
      </div>
    );
  }

  if (!licenca) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Licença não encontrada.</div>
      </div>
    );
  }

  const licencaStatus = licenca.status;
  const diasVencer = diasParaVencer(licenca.validade);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/empreendimentos">
          <span className="hover:text-foreground cursor-pointer">Empreendimentos</span>
        </Link>
        <ChevronRight className="h-4 w-4" />
        {empreendimento && (
          <>
            <Link href={`/empreendimentos/${licenca.empreendimentoId}`}>
              <span className="hover:text-foreground cursor-pointer">{empreendimento.nome}</span>
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="text-foreground font-medium">Licença {licenca.numero}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href={`/empreendimentos/${licenca.empreendimentoId}`}>
            <Button variant="outline" size="sm" className="gap-1 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                {licenca.numero}
              </h1>
              <Badge className={`${getLicencaStatusColor(licencaStatus)}`}>
                {getLicencaStatusLabel(licencaStatus)}
              </Badge>
              <Badge variant="outline">{licenca.tipo}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {licenca.orgaoEmissor}
              {empreendimento && <span className="ml-2">• {empreendimento.nome}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/licencas/${licencaId}/editar`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-4 w-4" />
              Editar Licença
            </Button>
          </Link>
          {licenca.arquivoPdf && (
            isArquivoAcessivel(licenca.arquivoPdf) ? (
              <a href={`/api/licencas/${licencaId}/arquivo`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="gap-1 text-amber-600 border-amber-300 cursor-default" disabled
                title="Arquivo do sistema anterior. Edite a licença e faça o upload novamente.">
                <AlertTriangle className="h-4 w-4" />
                Re-upload necessário
              </Button>
            )
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Emissão</div>
            <div className="font-semibold">{formatDate(licenca.dataEmissao)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Validade</div>
            <div className="font-semibold">{formatDate(licenca.validade)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Órgão Emissor</div>
            <div className="font-semibold text-sm">{licenca.orgaoEmissor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Dias p/ Vencer</div>
            <div className={`font-semibold ${diasVencer !== null && diasVencer < 0 ? "text-red-600" : diasVencer !== null && diasVencer < 30 ? "text-yellow-600" : "text-green-600"}`}>
              {diasVencer === null ? "-" : diasVencer < 0 ? `${Math.abs(diasVencer)}d vencida` : `${diasVencer}d`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banner Em Renovação */}
      {licenca.status === "em_renovacao" && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm">Processo de Renovação em Andamento</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Um requerimento de renovação foi protocolado para esta licença. Consulte a aba <strong>Ciclo de Vida</strong> para ver o documento vinculado.
            </p>
          </div>
          <button
            className="text-xs text-blue-600 dark:text-blue-400 underline flex-shrink-0 hover:text-blue-800"
            onClick={() => {
              const tab = document.querySelector('[data-state][value="ciclovida"]') as HTMLElement;
              if (tab) tab.click();
            }}
          >
            Ver detalhes →
          </button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="condicionantes" className="w-full">
        <TabsList className="w-full flex overflow-x-auto flex-nowrap h-auto">
          <TabsTrigger value="detalhes" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <Shield className="h-4 w-4" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="condicionantes" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Condicionantes
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <FileText className="h-4 w-4" />
            Documentos e Evidências
          </TabsTrigger>
          <TabsTrigger value="ciclovida" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <History className="h-4 w-4" />
            Ciclo de Vida
            {licenca.status === "em_renovacao" && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Cronograma
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <History className="h-4 w-4" />
            Histórico e Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="mt-6">
          <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-6">
              <div>
                <span className="text-muted-foreground">Número:</span>
                <div className="font-semibold">{licenca.numero}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <div className="font-semibold">{licenca.tipo}</div>
              </div>
              {(licenca as any).tipoOutorga && (
                <div>
                  <span className="text-muted-foreground">Tipo de Outorga:</span>
                  <div className="font-semibold capitalize">{(licenca as any).tipoOutorga}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Órgão Emissor:</span>
                <div className="font-semibold">{licenca.orgaoEmissor}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Data de Emissão:</span>
                <div className="font-semibold">{formatDate(licenca.dataEmissao)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Validade:</span>
                <div className="font-semibold">{formatDate(licenca.validade)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div>
                  <Badge className={getLicencaStatusColor(licenca.status)}>
                    {licenca.status === "ativa" ? "Ativa" : licenca.status === "a_vencer" ? "A Vencer" : "Vencida"}
                  </Badge>
                </div>
              </div>
              {empreendimento && (
                <div>
                  <span className="text-muted-foreground">Empreendimento:</span>
                  <div className="font-semibold">{empreendimento.nome}</div>
                </div>
              )}
              {licenca.arquivoPdf && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Arquivo PDF:</span>
                  <div>
                    {isArquivoAcessivel(licenca.arquivoPdf) ? (
                      <a href={`/api/licencas/${licencaId}/arquivo`} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Visualizar PDF
                      </a>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Arquivo do sistema anterior — edite a licença e faça o upload novamente
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condicionantes" className="mt-6">
          <CondicionantesTab
            licencaId={licencaId}
            licenca={licenca}
            empreendimentoId={licenca.empreendimentoId}
            empreendimento={empreendimento}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <DocumentosTab licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="ciclovida" className="mt-6">
          <CicloVidaTab licenca={licenca} licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="cronograma" className="mt-6">
          <CronogramaTab licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <HistoricoTab licencaId={licencaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
