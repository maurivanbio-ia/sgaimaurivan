import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
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
  FolderKanban
} from "lucide-react";
import type { Empreendimento } from "@shared/schema";
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
import { useUnidade } from "@/contexts/UnidadeContext";

const getTipoLabel = (tipo: string) => {
  const tipos: Record<string, string> = {
    hidreletrica: "Hidrelétrica",
    parque_eolico: "Parque Eólico",
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
  };
  return classes[status] || "";
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    em_planejamento: "Em Planejamento",
    em_execucao: "Em Execução",
    concluido: "Concluído",
    inativo: "Inativo",
  };
  return labels[status] || status;
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
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Gestor do Projeto
                  </p>
                  <p className="text-card-foreground">{project.gestorNome}</p>
                </div>
                {project.gestorEmail && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      Email do Gestor
                    </p>
                    <p className="text-card-foreground text-sm">{project.gestorEmail}</p>
                  </div>
                )}
                {project.gestorTelefone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      Telefone do Gestor
                    </p>
                    <p className="text-card-foreground">{project.gestorTelefone}</p>
                  </div>
                )}
              </>
            )}
            {project.dataInicio && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data de Início
                </p>
                <p className="text-card-foreground">{new Date(project.dataInicio).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
            {project.dataFimPrevista && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data de Fim Prevista
                </p>
                <p className="text-card-foreground">{new Date(project.dataFimPrevista).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs System */}
      <Tabs defaultValue="licencas" className="w-full">
        <TabsList className="grid w-full grid-cols-10 mb-6">
          <TabsTrigger value="licencas" className="flex items-center gap-2" data-testid="tab-licencas">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Licenças</span>
          </TabsTrigger>
          <TabsTrigger value="projetos" className="flex items-center gap-2" data-testid="tab-projetos">
            <FolderKanban className="h-4 w-4" />
            <span className="hidden sm:inline">Projetos</span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="flex items-center gap-2" data-testid="tab-contratos">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Contratos</span>
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex items-center gap-2" data-testid="tab-cronograma">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Cronograma</span>
          </TabsTrigger>
          <TabsTrigger value="rh" className="flex items-center gap-2" data-testid="tab-rh">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">RH</span>
          </TabsTrigger>
          <TabsTrigger value="demandas" className="flex items-center gap-2" data-testid="tab-demandas">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Demandas</span>
          </TabsTrigger>
          <TabsTrigger value="sst" className="flex items-center gap-2" data-testid="tab-sst">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">SST</span>
          </TabsTrigger>
          <TabsTrigger value="dados" className="flex items-center gap-2" data-testid="tab-dados">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="flex items-center gap-2" data-testid="tab-equipamentos">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Equipamentos</span>
          </TabsTrigger>
          <TabsTrigger value="frota" className="flex items-center gap-2" data-testid="tab-frota">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Frota</span>
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
      </Tabs>
    </div>
  );
}
