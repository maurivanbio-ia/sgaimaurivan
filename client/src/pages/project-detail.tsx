import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { formatDateBR } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  Calendar,
  Building,
  Briefcase,
  Users,
  ClipboardList,
  Shield,
  Database,
  Truck,
  Wrench,
  MapPin,
  Phone,
  Mail,
  FolderKanban,
  FilePlus2,
  ShieldCheck,
  BookOpen,
  MessageSquare
} from "lucide-react";
import type { Empreendimento, EmpreendimentoResponsavel } from "@shared/schema";
import { LicencasTab } from "@/components/empreendimento/LicencasTab";
import { ContratosTab } from "@/components/empreendimento/ContratosTab";
import { CronogramaTab } from "@/components/empreendimento/CronogramaTab";
import { RhTab } from "@/components/empreendimento/RhTab";
import { DemandasTab } from "@/components/empreendimento/DemandasTab";
import { SstTab } from "@/components/empreendimento/SstTab";
import { GestaoDadosTab } from "@/components/empreendimento/GestaoDadosTab";
import { EquipamentosTab } from "@/components/empreendimento/EquipamentosTab";
import { FrotaTab } from "@/components/empreendimento/FrotaTab";
import { ProjetosTab } from "@/components/empreendimento/ProjetosTab";
import { AditivosTab } from "@/components/empreendimento/AditivosTab";
import { AutorizacoesTab } from "@/components/empreendimento/AutorizacoesTab";
import { AtasReuniaoTab } from "@/components/empreendimento/AtasReuniaoTab";
import { DocumentosTecnicosTab } from "@/components/empreendimento/DocumentosTecnicosTab";
import { useUnidade } from "@/contexts/UnidadeContext";

const getTipoLabel = (tipo: string) => {
  const tipos: Record<string, string> = {
    hidreletrica: "Hidrelétrica",
    parque_eolico: "Parque Eólico",
    usina_solar: "Usina Solar",
    termoeletrica: "Termelétrica",
    linha_transmissao: "Linha de Transmissão",
    mina: "Mineração",
    pchs: "PCH",
    outro: "Outro",
  };
  return tipos[tipo] || tipo;
};

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    ativo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    em_planejamento: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    em_execucao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    concluido: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    inativo: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    cancelado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return classes[status?.toLowerCase()] || "";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    em_planejamento: "Em Planejamento",
    em_execucao: "Em Execução",
    concluido: "Concluído",
    inativo: "Inativo",
    cancelado: "Cancelado",
  };
  return labels[status?.toLowerCase()] || status;
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { unidadeSelecionada } = useUnidade();
  
  const { data: project, isLoading } = useQuery<Empreendimento>({
    queryKey: ["/api/empreendimentos", id, unidadeSelecionada],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unidadeSelecionada) {
        params.set("unidade", unidadeSelecionada);
      }
      const response = await fetch(`/api/empreendimentos/${id}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      return response.json();
    },
  });

  const { data: responsaveis = [] } = useQuery<EmpreendimentoResponsavel[]>({
    queryKey: ["/api/empreendimentos", id, "responsaveis"],
    queryFn: async () => {
      const res = await fetch(`/api/empreendimentos/${id}/responsaveis`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando detalhes do empreendimento...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Empreendimento não encontrado</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-card-foreground" data-testid="text-project-name">
              {project.nome}
            </h2>
            {project.status && (
              <Badge className={getStatusBadgeClass(project.status)} data-testid="badge-project-status">
                {getStatusLabel(project.status)}
              </Badge>
            )}
          </div>
          {project.tipo && (
            <p className="text-muted-foreground">{getTipoLabel(project.tipo)}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <Link href={`/empreendimentos/${id}/editar`}>
            <Button variant="outline" className="font-medium" data-testid="button-edit-project">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/empreendimentos")}
            className="font-medium"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Building className="h-4 w-4" />
                Cliente
              </p>
              <p className="text-card-foreground" data-testid="text-client">{project.cliente}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Localização
              </p>
              <p className="text-card-foreground" data-testid="text-location">{project.localizacao}</p>
            </div>
            {project.municipio && project.uf && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Município/UF</p>
                <p className="text-card-foreground">{project.municipio}/{project.uf}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Responsável Interno</p>
              <p className="text-card-foreground" data-testid="text-responsible">{project.responsavelInterno}</p>
            </div>
            {project.gestorNome && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 col-span-full sm:col-span-auto">
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4 text-primary" />
                  Gestor Responsável pelo Contrato
                </p>
                <p className="text-card-foreground font-medium">{project.gestorNome}</p>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {project.gestorEmail && (
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{project.gestorEmail}</span>
                  )}
                  {project.gestorTelefone && (
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{project.gestorTelefone}</span>
                  )}
                </div>
              </div>
            )}
            {responsaveis.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 col-span-full sm:col-span-auto">
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4 text-primary" />
                  Outros Responsáveis
                </p>
                {responsaveis.map(r => (
                  <div key={r.id} className="border-b last:border-0 pb-1 last:pb-0">
                    <p className="text-sm font-medium text-card-foreground">{r.nome} <span className="text-xs text-muted-foreground font-normal">— {r.responsabilidade}</span></p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {r.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                      {r.whatsapp && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.whatsapp}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {project.dataInicio && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data de Início
                </p>
                <p className="text-card-foreground">{formatDateBR(project.dataInicio)}</p>
              </div>
            )}
            {project.dataFimPrevista && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data de Fim Prevista
                </p>
                <p className="text-card-foreground">{formatDateBR(project.dataFimPrevista)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs System */}
      <Tabs defaultValue="licencas" className="w-full">
        <TabsList className="flex w-full overflow-x-auto mb-6 h-auto flex-nowrap justify-start">
          <TabsTrigger value="licencas" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-licencas">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span>Licenças</span>
          </TabsTrigger>
          <TabsTrigger value="projetos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-projetos">
            <FolderKanban className="h-4 w-4 flex-shrink-0" />
            <span>Projetos</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-contratos">
            <Briefcase className="h-4 w-4 flex-shrink-0" />
            <span>Contratos</span>
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-cronograma">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>Cronograma</span>
          </TabsTrigger>
          <TabsTrigger value="rh" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-rh">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>RH</span>
          </TabsTrigger>
          <TabsTrigger value="demandas" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-demandas">
            <ClipboardList className="h-4 w-4 flex-shrink-0" />
            <span>Demandas</span>
          </TabsTrigger>
          <TabsTrigger value="sst" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-sst">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <span>SST</span>
          </TabsTrigger>
          <TabsTrigger value="dados" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-dados">
            <Database className="h-4 w-4 flex-shrink-0" />
            <span>Dados</span>
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-equipamentos">
            <Wrench className="h-4 w-4 flex-shrink-0" />
            <span>Equipamentos</span>
          </TabsTrigger>
          <TabsTrigger value="frota" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-frota">
            <Truck className="h-4 w-4 flex-shrink-0" />
            <span>Frota</span>
          </TabsTrigger>
          <TabsTrigger value="aditivos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-aditivos">
            <FilePlus2 className="h-4 w-4 flex-shrink-0" />
            <span>Aditivos</span>
          </TabsTrigger>
          <TabsTrigger value="autorizacoes" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-autorizacoes">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>Autorizações</span>
          </TabsTrigger>
          <TabsTrigger value="documentos-tecnicos" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-documentos-tecnicos">
            <BookOpen className="h-4 w-4 flex-shrink-0" />
            <span>Documentos Técnicos</span>
          </TabsTrigger>
          <TabsTrigger value="atas-reuniao" className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap px-3" data-testid="tab-atas-reuniao">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span>Reuniões</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="licencas">
          <LicencasTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="projetos">
          <ProjetosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="contratos">
          <ContratosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="cronograma">
          <CronogramaTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="rh">
          <RhTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="demandas">
          <DemandasTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="sst">
          <SstTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="dados">
          <GestaoDadosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="equipamentos">
          <EquipamentosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="frota">
          <FrotaTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="aditivos">
          <AditivosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="autorizacoes">
          <AutorizacoesTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="documentos-tecnicos">
          <DocumentosTecnicosTab empreendimentoId={parseInt(id!)} />
        </TabsContent>

        <TabsContent value="atas-reuniao">
          <AtasReuniaoTab empreendimentoId={parseInt(id!)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
