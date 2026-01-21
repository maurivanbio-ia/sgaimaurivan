import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ExternalLink
} from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ConformidadeData {
  iso14001: {
    score: number;
    requisitos: RequisitoISO[];
  };
  iso9001: {
    score: number;
    requisitos: RequisitoISO[];
  };
  iso45001: {
    score: number;
    requisitos: RequisitoISO[];
  };
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
  status: 'conforme' | 'nao_conforme' | 'em_implementacao' | 'nao_aplicavel';
  evidencias: string[];
  moduloRelacionado: string;
  indicador?: number;
  meta?: number;
}

interface AlertaConformidade {
  id: string;
  tipo: 'critico' | 'atencao' | 'info';
  mensagem: string;
  modulo: string;
  dataCriacao: string;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'conforme':
      return <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Conforme</Badge>;
    case 'nao_conforme':
      return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" /> Não Conforme</Badge>;
    case 'em_implementacao':
      return <Badge className="bg-yellow-500 text-white"><Clock className="h-3 w-3 mr-1" /> Em Implementação</Badge>;
    default:
      return <Badge variant="outline">N/A</Badge>;
  }
}

function ScoreCard({ title, score, icon: Icon, color }: { title: string; score: number; icon: any; color: string }) {
  const getColorClass = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-10 rounded-bl-full`} />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-4xl font-bold ${getColorClass(score)}`}>{score}%</span>
          <span className="text-muted-foreground text-sm mb-1">de conformidade</span>
        </div>
        <Progress value={score} className="h-2" />
      </CardContent>
    </Card>
  );
}

function AlertaCard({ alerta }: { alerta: AlertaConformidade }) {
  const getAlertStyle = (tipo: string) => {
    switch (tipo) {
      case 'critico':
        return { bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', icon: XCircle, iconColor: 'text-red-500' };
      case 'atencao':
        return { bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800', icon: AlertTriangle, iconColor: 'text-yellow-500' };
      default:
        return { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800', icon: Clock, iconColor: 'text-blue-500' };
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

export default function ConformidadeISO() {
  const { unidadeSelecionada } = useUnidade();

  const { data: conformidade, isLoading, refetch, isFetching } = useQuery<ConformidadeData>({
    queryKey: ['/api/conformidade-iso', unidadeSelecionada],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const data = conformidade || {
    iso14001: { score: 0, requisitos: [] },
    iso9001: { score: 0, requisitos: [] },
    iso45001: { score: 0, requisitos: [] },
    alertas: [],
    resumo: { totalRequisitos: 0, conformes: 0, naoConformes: 0, emImplementacao: 0 }
  };

  const scoreGeral = Math.round((data.iso14001.score + data.iso9001.score + data.iso45001.score) / 3);

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
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
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

        <ScoreCard 
          title="ISO 14001" 
          score={data.iso14001.score} 
          icon={Leaf} 
          color="bg-green-500" 
        />
        <ScoreCard 
          title="ISO 9001" 
          score={data.iso9001.score} 
          icon={FileText} 
          color="bg-blue-500" 
        />
        <ScoreCard 
          title="ISO 45001" 
          score={data.iso45001.score} 
          icon={HardHat} 
          color="bg-orange-500" 
        />
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
                <TabsTrigger value="iso14001" className="gap-2">
                  <Leaf className="h-4 w-4" /> ISO 14001
                </TabsTrigger>
                <TabsTrigger value="iso9001" className="gap-2">
                  <FileText className="h-4 w-4" /> ISO 9001
                </TabsTrigger>
                <TabsTrigger value="iso45001" className="gap-2">
                  <HardHat className="h-4 w-4" /> ISO 45001
                </TabsTrigger>
              </TabsList>

              <TabsContent value="iso14001" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {data.iso14001.requisitos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhum requisito encontrado</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {data.iso14001.requisitos.map((req: RequisitoISO) => (
                        <AccordionItem key={req.id} value={req.id}>
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 text-left w-full pr-4">
                              <span className="font-mono text-sm text-muted-foreground min-w-[50px]">{req.codigo}</span>
                              <span className="flex-1 text-sm">{req.titulo}</span>
                              <StatusBadge status={req.status} />
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pl-4 space-y-3 border-l-2 border-green-500 ml-6">
                              <p className="text-sm text-muted-foreground">{req.descricao}</p>
                              {req.indicador !== undefined && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Indicador:</span>
                                  <Progress value={req.indicador} className="w-24 h-2" />
                                  <span className="text-sm font-medium">{req.indicador}%</span>
                                  {req.meta && <span className="text-sm text-muted-foreground">(Meta: {req.meta}%)</span>}
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
                                    {req.evidencias.map((ev, i) => <li key={i}>{ev}</li>)}
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
              </TabsContent>

              <TabsContent value="iso9001" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {data.iso9001.requisitos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhum requisito encontrado</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {data.iso9001.requisitos.map((req: RequisitoISO) => (
                        <AccordionItem key={req.id} value={req.id}>
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 text-left w-full pr-4">
                              <span className="font-mono text-sm text-muted-foreground min-w-[50px]">{req.codigo}</span>
                              <span className="flex-1 text-sm">{req.titulo}</span>
                              <StatusBadge status={req.status} />
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pl-4 space-y-3 border-l-2 border-blue-500 ml-6">
                              <p className="text-sm text-muted-foreground">{req.descricao}</p>
                              {req.indicador !== undefined && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Indicador:</span>
                                  <Progress value={req.indicador} className="w-24 h-2" />
                                  <span className="text-sm font-medium">{req.indicador}%</span>
                                  {req.meta && <span className="text-sm text-muted-foreground">(Meta: {req.meta}%)</span>}
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
                                    {req.evidencias.map((ev, i) => <li key={i}>{ev}</li>)}
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
              </TabsContent>

              <TabsContent value="iso45001" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {data.iso45001.requisitos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhum requisito encontrado</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {data.iso45001.requisitos.map((req: RequisitoISO) => (
                        <AccordionItem key={req.id} value={req.id}>
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 text-left w-full pr-4">
                              <span className="font-mono text-sm text-muted-foreground min-w-[50px]">{req.codigo}</span>
                              <span className="flex-1 text-sm">{req.titulo}</span>
                              <StatusBadge status={req.status} />
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pl-4 space-y-3 border-l-2 border-orange-500 ml-6">
                              <p className="text-sm text-muted-foreground">{req.descricao}</p>
                              {req.indicador !== undefined && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">Indicador:</span>
                                  <Progress value={req.indicador} className="w-24 h-2" />
                                  <span className="text-sm font-medium">{req.indicador}%</span>
                                  {req.meta && <span className="text-sm text-muted-foreground">(Meta: {req.meta}%)</span>}
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
                                    {req.evidencias.map((ev, i) => <li key={i}>{ev}</li>)}
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alertas de Conformidade
            </CardTitle>
            <CardDescription>
              Itens que requerem atenção imediata
            </CardDescription>
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
                  data.alertas.map((alerta) => (
                    <AlertaCard key={alerta.id} alerta={alerta} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {scoreGeral === 0 && (
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
                  <span className="font-medium">ISO 14001 - Ambiental</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Cadastre licenças ambientais e acompanhe condicionantes para melhorar este indicador.
                </p>
                <div className="flex gap-2">
                  <a href="/licencas">
                    <Button size="sm" variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" /> Licenças
                    </Button>
                  </a>
                  <a href="/condicionantes">
                    <Button size="sm" variant="outline" className="gap-1">
                      Condicionantes
                    </Button>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">ISO 9001 - Qualidade</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Mantenha treinamentos atualizados, fornecedores qualificados e documentos em dia.
                </p>
                <div className="flex gap-2">
                  <a href="/treinamentos">
                    <Button size="sm" variant="outline" className="gap-1">
                      <GraduationCap className="h-3 w-3" /> Treinamentos
                    </Button>
                  </a>
                  <a href="/fornecedores">
                    <Button size="sm" variant="outline" className="gap-1">
                      Fornecedores
                    </Button>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <HardHat className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">ISO 45001 - SST</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Registre colaboradores, CNHs, documentos SST e mantenha a frota regularizada.
                </p>
                <div className="flex gap-2">
                  <a href="/rh">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Users className="h-3 w-3" /> RH
                    </Button>
                  </a>
                  <a href="/frota">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Truck className="h-3 w-3" /> Frota
                    </Button>
                  </a>
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
          <CardDescription>
            Entenda como o sistema monitora automaticamente sua conformidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-500" />
                <h3 className="font-semibold text-green-600 dark:text-green-400">ISO 14001 - Gestão Ambiental</h3>
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
                <h3 className="font-semibold text-blue-600 dark:text-blue-400">ISO 9001 - Qualidade</h3>
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
                <h3 className="font-semibold text-orange-600 dark:text-orange-400">ISO 45001 - SST</h3>
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
          <CardDescription>
            Acesse os módulos para cadastrar dados e melhorar sua conformidade
          </CardDescription>
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
              <a key={i} href={mod.href} className="no-underline">
                <div 
                  className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer group"
                >
                  <mod.icon className={`h-8 w-8 ${mod.color} mb-2 group-hover:scale-110 transition-transform`} />
                  <span className="text-sm font-medium">{mod.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
