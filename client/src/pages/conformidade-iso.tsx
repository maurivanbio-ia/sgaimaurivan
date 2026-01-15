import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";
import { Link } from "wouter";

import { useUnidade } from "@/contexts/UnidadeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/* =========================
   Tipos
========================= */

interface ConformidadeData {
  iso14001: { score: number; requisitos: RequisitoISO[] };
  iso9001: { score: number; requisitos: RequisitoISO[] };
  iso45001: { score: number; requisitos: RequisitoISO[] };
  alertas: AlertaConformidade[];
  resumo: {
    totalRequisitos: number;
    conformes: number;
    naoConformes: number;
    emImplementacao: number;
  };
}

interface RequisitoISO {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  status: "conforme" | "nao_conforme" | "em_implementacao" | "nao_aplicavel";
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

type NormaKey = "iso14001" | "iso9001" | "iso45001";

type NormaConfig = {
  key: NormaKey;
  label: string;
  icon: LucideIcon;
  scoreCardBg: string;
  borderAccent: string;
};

/* =========================
   Configuração declarativa
========================= */

const NORMAS: readonly NormaConfig[] = [
  { key: "iso14001", label: "ISO 14001", icon: Leaf, scoreCardBg: "bg-green-500", borderAccent: "border-green-500" },
  { key: "iso9001", label: "ISO 9001", icon: FileText, scoreCardBg: "bg-blue-500", borderAccent: "border-blue-500" },
  { key: "iso45001", label: "ISO 45001", icon: HardHat, scoreCardBg: "bg-orange-500", borderAccent: "border-orange-500" },
] as const;

/* =========================
   Fetch helper (robusto)
========================= */

async function fetchJsonStrict<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao acessar ${url}`);
  }

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Resposta não é JSON. Provável redirecionamento para login ou erro de rota.\nInício da resposta: ${text.slice(0, 80)}`
    );
  }

  return res.json();
}

/* =========================
   Helpers (robustos e testáveis)
========================= */

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function computeScoreGeral(data: ConformidadeData): number {
  const scores = [data.iso14001.score, data.iso9001.score, data.iso45001.score].map(clampPercent);
  const valid = scores.filter((s) => Number.isFinite(s));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function isEmptyDataset(data: ConformidadeData): boolean {
  const allScoresZero = clampPercent(data.iso14001.score) === 0 && clampPercent(data.iso9001.score) === 0 && clampPercent(data.iso45001.score) === 0;
  const noReqs =
    data.iso14001.requisitos.length === 0 &&
    data.iso9001.requisitos.length === 0 &&
    data.iso45001.requisitos.length === 0;

  return allScoresZero && (data.resumo.totalRequisitos === 0 || noReqs);
}

/**
 * Normaliza a unidade para um identificador estável no queryKey.
 * Se o seu contexto já fornece string/number, retorna como está.
 * Se fornecer objeto, tenta usar campos comuns.
 */
function getUnidadeId(unidadeSelecionada: unknown): string | number | null {
  if (typeof unidadeSelecionada === "string" || typeof unidadeSelecionada === "number") return unidadeSelecionada;

  if (unidadeSelecionada && typeof unidadeSelecionada === "object") {
    const u = unidadeSelecionada as Record<string, unknown>;
    const candidate = u.id ?? u.unidadeId ?? u.unidade_id ?? u.codigo ?? u.value;
    if (typeof candidate === "string" || typeof candidate === "number") return candidate;
  }

  return null;
}

/* =========================
   Componentes de UI
========================= */

function StatusBadge({ status }: { status: RequisitoISO["status"] }) {
  switch (status) {
    case "conforme":
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Conforme
        </Badge>
      );
    case "nao_conforme":
      return (
        <Badge className="bg-red-500 text-white">
          <XCircle className="h-3 w-3 mr-1" /> Não Conforme
        </Badge>
      );
    case "em_implementacao":
      return (
        <Badge className="bg-yellow-500 text-white">
          <Clock className="h-3 w-3 mr-1" /> Em Implementação
        </Badge>
      );
    case "nao_aplicavel":
      return <Badge variant="outline">Não aplicável</Badge>;
  }
}

function ScoreCard({
  title,
  score,
  icon: Icon,
  colorBg,
}: {
  title: string;
  score: number;
  icon: LucideIcon;
  colorBg: string;
}) {
  const safeScore = clampPercent(score);

  const getColorClass = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const iconTextColor = colorBg.replace("bg-", "text-");

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${colorBg} opacity-10 rounded-bl-full`} />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconTextColor}`} />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-4xl font-bold ${getColorClass(safeScore)}`}>{safeScore}%</span>
          <span className="text-muted-foreground text-sm mb-1">de conformidade</span>
        </div>
        <Progress value={safeScore} className="h-2" />
      </CardContent>
    </Card>
  );
}

function AlertaCard({ alerta }: { alerta: AlertaConformidade }) {
  const getAlertStyle = (tipo: AlertaConformidade["tipo"]) => {
    switch (tipo) {
      case "critico":
        return {
          bg: "bg-red-50 dark:bg-red-950",
          border: "border-red-200 dark:border-red-800",
          icon: XCircle,
          iconColor: "text-red-500",
        };
      case "atencao":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950",
          border: "border-yellow-200 dark:border-yellow-800",
          icon: AlertTriangle,
          iconColor: "text-yellow-500",
        };
      case "info":
        return {
          bg: "bg-blue-50 dark:bg-blue-950",
          border: "border-blue-200 dark:border-blue-800",
          icon: Clock,
          iconColor: "text-blue-500",
        };
    }
  };

  const style = getAlertStyle(alerta.tipo);
  const Icon = style.icon;

  return (
    <div className={`p-3 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${style.iconColor} mt-0.5`} />
        <div className="flex-1">
          <p className="font-medium text-sm">{alerta.mensagem}</p>
          <p className="text-xs text-muted-foreground mt-1">Módulo: {alerta.modulo}</p>
        </div>
      </div>
    </div>
  );
}

const NormaTabContent = React.memo(function NormaTabContent({
  requisitos,
  accentBorder,
}: {
  requisitos: RequisitoISO[];
  accentBorder: string;
}) {
  return (
    <ScrollArea className="h-[400px]">
      {requisitos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum requisito encontrado</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {requisitos.map((req) => (
            <AccordionItem key={req.id} value={req.id}>
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left w-full pr-4">
                  <span className="font-mono text-sm text-muted-foreground min-w-[50px]">{req.codigo}</span>
                  <span className="flex-1 text-sm">{req.titulo}</span>
                  <StatusBadge status={req.status} />
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4">
                <div className={`pl-4 space-y-3 border-l-2 ${accentBorder} ml-6`}>
                  <p className="text-sm text-muted-foreground">{req.descricao}</p>

                  {req.indicador !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Indicador:</span>
                      <Progress value={clampPercent(req.indicador)} className="w-24 h-2" />
                      <span className="text-sm font-medium">{clampPercent(req.indicador)}%</span>
                      {req.meta !== undefined && (
                        <span className="text-sm text-muted-foreground">(Meta: {clampPercent(req.meta)}%)</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>Módulo: {req.moduloRelacionado}</span>
                  </div>

                  {req.evidencias.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Evidências:</span>
                      <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                        {req.evidencias.map((ev, i) => (
                          <li key={`${req.id}-ev-${i}`}>{ev}</li>
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
  );
});

/* =========================
   Componente principal
========================= */

export default function ConformidadeISO() {
  const { unidadeSelecionada } = useUnidade();
  const unidadeParam = React.useMemo(() => {
    const id = getUnidadeId(unidadeSelecionada);
    if (!id) return '';
    return String(id);
  }, [unidadeSelecionada]);

  const {
    data: conformidade,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<ConformidadeData>({
    queryKey: ["conformidade-iso", unidadeParam],
    queryFn: async () => {
      const url = unidadeParam 
        ? `/api/conformidade-iso?unidade=${encodeURIComponent(unidadeParam)}`
        : '/api/conformidade-iso';
      return fetchJsonStrict<ConformidadeData>(url);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  if (isLoading) {
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

  if (isError) {
    return (
      <div className="p-6">
        <Card className="border-red-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Falha ao carregar conformidade
            </CardTitle>
            <CardDescription>
              Ocorreu um erro ao consultar os dados. Verifique conexão, permissões ou tente novamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Tentar novamente
            </Button>
            <span className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data: ConformidadeData = conformidade ?? {
    iso14001: { score: 0, requisitos: [] },
    iso9001: { score: 0, requisitos: [] },
    iso45001: { score: 0, requisitos: [] },
    alertas: [],
    resumo: { totalRequisitos: 0, conformes: 0, naoConformes: 0, emImplementacao: 0 },
  };

  const scoreGeral = computeScoreGeral(data);
  const showZeroGuidance = isEmptyDataset(data);

  const alertasOrdenados = React.useMemo(() => {
    const rank: Record<AlertaConformidade["tipo"], number> = { critico: 0, atencao: 1, info: 2 };
    return [...data.alertas].sort((a, b) => rank[a.tipo] - rank[b.tipo]);
  }, [data.alertas]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Conformidade ISO
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento automático de atendimento às normas ISO 14001, 9001 e 45001
          </p>
        </div>

        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Score Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-primary">{scoreGeral}%</div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.resumo.conformes} de {data.resumo.totalRequisitos} requisitos atendidos
            </p>
          </CardContent>
        </Card>

        <ScoreCard title="ISO 14001" score={data.iso14001.score} icon={Leaf} colorBg="bg-green-500" />
        <ScoreCard title="ISO 9001" score={data.iso9001.score} icon={FileText} colorBg="bg-blue-500" />
        <ScoreCard title="ISO 45001" score={data.iso45001.score} icon={HardHat} colorBg="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Requisitos por Norma</CardTitle>
            <CardDescription>Clique para expandir e ver detalhes dos requisitos</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="iso14001">
              <TabsList className="grid w-full grid-cols-3">
                {NORMAS.map((n) => (
                  <TabsTrigger key={n.key} value={n.key} className="gap-2">
                    <n.icon className="h-4 w-4" /> {n.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {NORMAS.map((n) => (
                <TabsContent key={n.key} value={n.key} className="mt-4">
                  <NormaTabContent requisitos={data[n.key].requisitos} accentBorder={n.borderAccent} />
                </TabsContent>
              ))}
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
                {alertasOrdenados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum alerta de conformidade</p>
                  </div>
                ) : (
                  alertasOrdenados.map((alerta) => <AlertaCard key={alerta.id} alerta={alerta} />)
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {showZeroGuidance && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <Lightbulb className="h-5 w-5" />
              Como Melhorar Sua Conformidade
            </CardTitle>
            <CardDescription>
              Para que o sistema calcule automaticamente sua conformidade, você precisa cadastrar dados nos módulos monitorados
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Leaf className="h-5 w-5 text-green-500" />
                  <span className="font-medium">ISO 14001. Ambiental</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Cadastre licenças ambientais e acompanhe condicionantes para melhorar este indicador.
                </p>
                <div className="flex gap-2">
                  <Link href="/licencas">
                    <Button size="sm" variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" /> Licenças
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
                  <span className="font-medium">ISO 9001. Qualidade</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Mantenha treinamentos atualizados, fornecedores qualificados e documentos em dia.
                </p>
                <div className="flex gap-2">
                  <Link href="/treinamentos">
                    <Button size="sm" variant="outline" className="gap-1">
                      <GraduationCap className="h-3 w-3" /> Treinamentos
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
                  <span className="font-medium">ISO 45001. SST</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Registre colaboradores, CNHs, documentos SST e mantenha a frota regularizada.
                </p>
                <div className="flex gap-2">
                  <Link href="/rh">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> RH
                    </Button>
                  </Link>
                  <Link href="/frota">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Truck className="h-3 w-3" /> Frota
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
                <h3 className="font-semibold text-green-600 dark:text-green-400">ISO 14001. Gestão Ambiental</h3>
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
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">ISO 9001. Qualidade</h3>
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
                <h3 className="font-semibold text-orange-600 dark:text-orange-400">ISO 45001. SST</h3>
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
            ].map((mod) => (
              <Link key={mod.href} href={mod.href}>
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
