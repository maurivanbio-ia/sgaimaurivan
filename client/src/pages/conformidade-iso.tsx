import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { useUnidade } from "@/contexts/UnidadeContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  Truck,
  Wrench,
  GraduationCap,
  Leaf,
  HardHat,
  Building2,
  TrendingUp,
  RefreshCcw,
  ArrowRight,
  Info,
  Lightbulb,
  Search,
  Filter,
} from "lucide-react";

/* =========================
   Tipos
   ========================= */

interface ConformidadeData {
  iso14001: { score: number; requisitos: RequisitoISO[] };
  iso9001: { score: number; requisitos: RequisitoISO[] };
  iso45001: { score: number; requisitos: RequisitoISO[] };
  alertas: AlertaConformidade[];
  resumo: { totalRequisitos: number; conformes: number; naoConformes: number; emImplementacao: number };
}

type RequisitoStatus = "conforme" | "nao_conforme" | "em_implementacao" | "nao_aplicavel";

interface RequisitoISO {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  status: RequisitoStatus;
  evidencias: string[];
  moduloRelacionado: string;
  indicador?: number;
  meta?: number;
}

interface AlertaConformidade {
  id: string;
  tipo: "critico" | "atencao" | "info";
  mensagem: string;
  modulo: string;
  dataCriacao: string;
}

/* =========================
   Utils
   ========================= */

function normalizeText(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function StatusBadge({ status }: { status: RequisitoStatus }) {
  switch (status) {
    case "conforme":
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Conforme
        </Badge>
      );
    case "nao_conforme":
      return (
        <Badge className="bg-red-500 text-white">
          <XCircle className="h-3 w-3 mr-1" />
          Não Conforme
        </Badge>
      );
    case "em_implementacao":
      return (
        <Badge className="bg-yellow-500 text-white">
          <Clock className="h-3 w-3 mr-1" />
          Em Implementação
        </Badge>
      );
    case "nao_aplicavel":
    default:
      return <Badge variant="outline">Não aplicável</Badge>;
  }
}

function MaturityBadge({ score }: { score: number }) {
  if (score >= 85) return <Badge className="bg-emerald-600 text-white">Pronto para auditoria</Badge>;
  if (score >= 70) return <Badge variant="secondary">Em consolidação</Badge>;
  return <Badge className="bg-red-600 text-white">Risco de não conformidade</Badge>;
}

function ScoreCard({
  title,
  score,
  icon: Icon,
  colorBg,
  colorText,
}: {
  title: string;
  score: number;
  icon: any;
  colorBg: string;
  colorText: string;
}) {
  const scoreTextClass = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${colorBg} opacity-10 rounded-bl-full`} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${colorText}`} />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <MaturityBadge score={score} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-4xl font-bold ${scoreTextClass}`}>{score}%</span>
          <span className="text-muted-foreground text-sm mb-1">de conformidade</span>
        </div>
        <Progress value={score} className="h-2" />
      </CardContent>
    </Card>
  );
}

function AlertaCard({ alerta }: { alerta: AlertaConformidade }) {
  const style =
    alerta.tipo === "critico"
      ? { bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-800", Icon: XCircle, iconColor: "text-red-500" }
      : alerta.tipo === "atencao"
      ? { bg: "bg-yellow-50 dark:bg-yellow-950", border: "border-yellow-200 dark:border-yellow-800", Icon: AlertTriangle, iconColor: "text-yellow-500" }
      : { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-200 dark:border-blue-800", Icon: Clock, iconColor: "text-blue-500" };

  return (
    <div className={`p-3 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <style.Icon className={`h-5 w-5 ${style.iconColor} mt-0.5`} />
        <div className="flex-1">
          <p className="font-medium text-sm">{alerta.mensagem}</p>
          <p className="text-xs text-muted-foreground mt-1">Módulo: {alerta.modulo}</p>
        </div>
      </div>
    </div>
  );
}

function StatusCounters({ requisitos }: { requisitos: RequisitoISO[] }) {
  const counts = useMemo(() => {
    const c = { conforme: 0, nao_conforme: 0, em_implementacao: 0, nao_aplicavel: 0 };
    for (const r of requisitos) c[r.status] += 1;
    const total = requisitos.length || 1;
    return {
      ...c,
      total: requisitos.length,
      pct: {
        conforme: Math.round((c.conforme / total) * 100),
        nao_conforme: Math.round((c.nao_conforme / total) * 100),
        em_implementacao: Math.round((c.em_implementacao / total) * 100),
        nao_aplicavel: Math.round((c.nao_aplicavel / total) * 100),
      },
    };
  }, [requisitos]);

  return (
    <div className="flex flex-wrap gap-2 items-center text-xs">
      <Badge variant="outline">Total: {counts.total}</Badge>
      <Badge className="bg-green-600 text-white">Conforme: {counts.conforme} ({counts.pct.conforme}%)</Badge>
      <Badge className="bg-yellow-500 text-white">Em impl.: {counts.em_implementacao} ({counts.pct.em_implementacao}%)</Badge>
      <Badge className="bg-red-600 text-white">Não conf.: {counts.nao_conforme} ({counts.pct.nao_conforme}%)</Badge>
      <Badge variant="secondary">N/A: {counts.nao_aplicavel} ({counts.pct.nao_aplicavel}%)</Badge>
    </div>
  );
}

function IsoRequisitosPanel({
  requisitos,
  accentBorderClass,
  searchValue,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  emptyLabel = "Nenhum requisito encontrado",
}: {
  requisitos: RequisitoISO[];
  accentBorderClass: string;
  searchValue: string;
  statusFilter: "todos" | RequisitoStatus;
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: "todos" | RequisitoStatus) => void;
  emptyLabel?: string;
}) {
  const filtered = useMemo(() => {
    const q = normalizeText(searchValue);
    const byStatus = statusFilter === "todos" ? requisitos : requisitos.filter((r) => r.status === statusFilter);

    if (!q) return byStatus;

    return byStatus.filter((r) => {
      const hay = normalizeText(`${r.codigo} ${r.titulo} ${r.descricao} ${r.moduloRelacionado} ${r.evidencias?.join(" ") || ""}`);
      return hay.includes(q);
    });
  }, [requisitos, searchValue, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por código, título, módulo ou evidência"
              className="pl-9"
              aria-label="Buscar requisitos"
            />
          </div>

          <div className="w-full sm:w-[240px]">
            <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as any)}>
              <SelectTrigger className="gap-2" aria-label="Filtrar por status">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="conforme">Conforme</SelectItem>
                <SelectItem value="em_implementacao">Em implementação</SelectItem>
                <SelectItem value="nao_conforme">Não conforme</SelectItem>
                <SelectItem value="nao_aplicavel">Não aplicável</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <StatusCounters requisitos={requisitos} />
      </div>

      <ScrollArea className="h-[400px]">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">{emptyLabel}</div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filtered.map((req) => (
              <AccordionItem key={req.id} value={req.id}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left w-full pr-4">
                    <span className="font-mono text-sm text-muted-foreground min-w-[56px]">{req.codigo}</span>
                    <span className="flex-1 text-sm">{req.titulo}</span>
                    <StatusBadge status={req.status} />
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-4">
                  <div className={`pl-4 space-y-3 border-l-2 ${accentBorderClass} ml-6`}>
                    <p className="text-sm text-muted-foreground">{req.descricao}</p>

                    {req.indicador !== undefined && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">Indicador:</span>
                        <Progress value={req.indicador} className="w-24 h-2" />
                        <span className="text-sm font-medium">{req.indicador}%</span>
                        {req.meta !== undefined && <span className="text-sm text-muted-foreground">(Meta: {req.meta}%)</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Módulo: {req.moduloRelacionado}</span>
                    </div>

                    {req.evidencias?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Evidências:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                          {req.evidencias.map((ev, i) => (
                            <li key={i}>{ev}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
}

/* =========================
   Query (com tratamento robusto)
   ========================= */

async function fetchConformidadeISO(unidadeSelecionada: any): Promise<ConformidadeData> {
  const url = new URL("/api/conformidade-iso", window.location.origin);
  if (unidadeSelecionada !== undefined && unidadeSelecionada !== null) url.searchParams.set("unidade", String(unidadeSelecionada));

  const res = await fetch(url.toString(), { method: "GET", headers: { "Accept": "application/json" } });

  if (res.status === 204 || res.status === 404) {
    return {
      iso14001: { score: 0, requisitos: [] },
      iso9001: { score: 0, requisitos: [] },
      iso45001: { score: 0, requisitos: [] },
      alertas: [],
      resumo: { totalRequisitos: 0, conformes: 0, naoConformes: 0, emImplementacao: 0 },
    };
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Falha ao carregar conformidade ISO (${res.status}).`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg ? `Resposta inesperada: ${msg}` : "Resposta inesperada (não JSON).");
  }

  return (await res.json()) as ConformidadeData;
}

/* =========================
   Componente principal
   ========================= */

export default function ConformidadeISO() {
  const { unidadeSelecionada } = useUnidade();

  const [activeTab, setActiveTab] = useState<"iso14001" | "iso9001" | "iso45001">("iso14001");
  const [searchByTab, setSearchByTab] = useState<Record<string, string>>({
    iso14001: "",
    iso9001: "",
    iso45001: "",
  });
  const [statusByTab, setStatusByTab] = useState<Record<string, "todos" | RequisitoStatus>>({
    iso14001: "todos",
    iso9001: "todos",
    iso45001: "todos",
  });

  const q = useQuery<ConformidadeData>({
    queryKey: ["/api/conformidade-iso", unidadeSelecionada],
    queryFn: () => fetchConformidadeISO(unidadeSelecionada),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  const data: ConformidadeData = q.data ?? {
    iso14001: { score: 0, requisitos: [] },
    iso9001: { score: 0, requisitos: [] },
    iso45001: { score: 0, requisitos: [] },
    alertas: [],
    resumo: { totalRequisitos: 0, conformes: 0, naoConformes: 0, emImplementacao: 0 },
  };

  const scoreGeral = useMemo(() => {
    const avg = (data.iso14001.score + data.iso9001.score + data.iso45001.score) / 3;
    return Number.isFinite(avg) ? Math.round(avg) : 0;
  }, [data.iso14001.score, data.iso9001.score, data.iso45001.score]);

  const hasZeroData = scoreGeral === 0 && data.resumo.totalRequisitos === 0;

  if (q.isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="p-6 space-y-4">
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-200">
              <XCircle className="h-5 w-5" />
              Não foi possível carregar a Conformidade ISO
            </CardTitle>
            <CardDescription className="text-red-700/80 dark:text-red-200/80">
              {(q.error as any)?.message || "Erro inesperado."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2" onClick={() => q.refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const searchValue = searchByTab[activeTab] ?? "";
  const statusFilter = statusByTab[activeTab] ?? "todos";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Conformidade ISO
          </h1>
          <p className="text-muted-foreground mt-1">Monitoramento automático de atendimento às normas ISO 14001, 9001 e 45001</p>
        </div>

        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          {q.isFetching ? "Atualizando" : "Atualizar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Score Geral
              </CardTitle>
              <MaturityBadge score={scoreGeral} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-primary">{scoreGeral}%</div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.resumo.conformes} de {data.resumo.totalRequisitos} requisitos atendidos
            </p>
          </CardContent>
        </Card>

        <ScoreCard title="ISO 14001" score={data.iso14001.score} icon={Leaf} colorBg="bg-green-500" colorText="text-green-600" />
        <ScoreCard title="ISO 9001" score={data.iso9001.score} icon={FileText} colorBg="bg-blue-500" colorText="text-blue-600" />
        <ScoreCard title="ISO 45001" score={data.iso45001.score} icon={HardHat} colorBg="bg-orange-500" colorText="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Requisitos por Norma</CardTitle>
            <CardDescription>Busque, filtre por status e expanda para ver detalhes</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="iso14001" className="gap-2">
                  <Leaf className="h-4 w-4" />
                  ISO 14001
                </TabsTrigger>
                <TabsTrigger value="iso9001" className="gap-2">
                  <FileText className="h-4 w-4" />
                  ISO 9001
                </TabsTrigger>
                <TabsTrigger value="iso45001" className="gap-2">
                  <HardHat className="h-4 w-4" />
                  ISO 45001
                </TabsTrigger>
              </TabsList>

              {/* Lazy rendering real: só renderiza o conteúdo ativo */}
              {activeTab === "iso14001" && (
                <TabsContent value="iso14001" className="mt-4">
                  <IsoRequisitosPanel
                    requisitos={data.iso14001.requisitos}
                    accentBorderClass="border-green-500"
                    searchValue={searchByTab.iso14001}
                    statusFilter={statusByTab.iso14001}
                    onSearchChange={(v) => setSearchByTab((s) => ({ ...s, iso14001: v }))}
                    onStatusFilterChange={(v) => setStatusByTab((s) => ({ ...s, iso14001: v }))}
                  />
                </TabsContent>
              )}

              {activeTab === "iso9001" && (
                <TabsContent value="iso9001" className="mt-4">
                  <IsoRequisitosPanel
                    requisitos={data.iso9001.requisitos}
                    accentBorderClass="border-blue-500"
                    searchValue={searchByTab.iso9001}
                    statusFilter={statusByTab.iso9001}
                    onSearchChange={(v) => setSearchByTab((s) => ({ ...s, iso9001: v }))}
                    onStatusFilterChange={(v) => setStatusByTab((s) => ({ ...s, iso9001: v }))}
                  />
                </TabsContent>
              )}

              {activeTab === "iso45001" && (
                <TabsContent value="iso45001" className="mt-4">
                  <IsoRequisitosPanel
                    requisitos={data.iso45001.requisitos}
                    accentBorderClass="border-orange-500"
                    searchValue={searchByTab.iso45001}
                    statusFilter={statusByTab.iso45001}
                    onSearchChange={(v) => setSearchByTab((s) => ({ ...s, iso45001: v }))}
                    onStatusFilterChange={(v) => setStatusByTab((s) => ({ ...s, iso45001: v }))}
                  />
                </TabsContent>
              )}

              {/* “Chips” rápidos do estado atual */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="gap-2">
                  <Search className="h-3 w-3" />
                  Busca: {searchValue ? searchValue : "—"}
                </Badge>
                <Badge variant="outline">Status: {statusFilter === "todos" ? "Todos" : statusFilter.replaceAll("_", " ")}</Badge>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alertas de Conformidade
            </CardTitle>
            <CardDescription>Itens que requerem atenção imediata</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {data.alertas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum alerta de conformidade</p>
                  </div>
                ) : (
                  data.alertas.map((alerta) => <AlertaCard key={alerta.id} alerta={alerta} />)
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {hasZeroData && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Lightbulb className="h-5 w-5" />
              Como Melhorar Sua Conformidade
            </CardTitle>
            <CardDescription>Para o sistema calcular automaticamente, cadastre dados nos módulos monitorados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Leaf className="h-5 w-5 text-green-500" />
                  <span className="font-medium">ISO 14001 . Ambiental</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Cadastre licenças e acompanhe condicionantes para melhorar este indicador.</p>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/licencas">
                    <Button size="sm" variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      Licenças
                    </Button>
                  </Link>
                  <Link href="/condicionantes">
                    <Button size="sm" variant="outline" className="gap-1">
                      Condicionantes
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">ISO 9001 . Qualidade</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Mantenha treinamentos, fornecedores qualificados e documentos em dia.</p>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/treinamentos">
                    <Button size="sm" variant="outline" className="gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Treinamentos
                    </Button>
                  </Link>
                  <Link href="/fornecedores">
                    <Button size="sm" variant="outline" className="gap-1">
                      Fornecedores
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <HardHat className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">ISO 45001 . SST</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Registre colaboradores, documentos SST e mantenha a frota regularizada.</p>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/rh">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      RH
                    </Button>
                  </Link>
                  <Link href="/frota">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Truck className="h-3 w-3" />
                      Frota
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            O Que Cada Norma Verifica
          </CardTitle>
          <CardDescription>Entenda como o sistema monitora automaticamente sua conformidade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-500" />
                <h3 className="font-semibold text-green-600 dark:text-green-400">ISO 14001 . Gestão Ambiental</h3>
              </div>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Licenças ambientais vigentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Condicionantes cumpridas no prazo</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Equipamentos calibrados</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-500" />
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">ISO 9001 . Qualidade</h3>
              </div>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Treinamentos concluídos e válidos</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Fornecedores avaliados (nota 4+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>Base de conhecimento atualizada</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HardHat className="h-6 w-6 text-orange-500" />
                <h3 className="font-semibold text-orange-600 dark:text-orange-400">ISO 45001 . SST</h3>
              </div>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <span>CNHs de colaboradores vigentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <span>Documentos SST em dia</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <span>Frota com licenciamento e seguro válidos</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Módulos Monitorados</CardTitle>
          <CardDescription>Acesse os módulos para cadastrar dados e melhorar sua conformidade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: FileText, label: "Licenças", color: "text-blue-500", href: "/licencas" },
              { icon: Users, label: "RH", color: "text-purple-500", href: "/rh" },
              { icon: GraduationCap, label: "Treinamentos", color: "text-green-500", href: "/treinamentos" },
              { icon: Truck, label: "Frota", color: "text-orange-500", href: "/frota" },
              { icon: Wrench, label: "Equipamentos", color: "text-gray-500", href: "/equipamentos" },
              { icon: HardHat, label: "SST", color: "text-yellow-500", href: "/sst" },
            ].map((mod, i) => (
              <Link key={i} href={mod.href}>
                <div className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer group">
                  <mod.icon className={`h-8 w-8 ${mod.color} mb-2 group-hover:scale-110 transition-transform`} />
                  <span className="text-sm font-medium">{mod.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
