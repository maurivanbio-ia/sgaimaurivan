import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, FileText, Plus, Shield, AlertCircle, CheckCircle, 
  ClipboardList, Stethoscope, AlertTriangle, MessageSquare, Search,
  Calendar, Edit, Trash2, FileCheck, Activity
} from "lucide-react";
import { Link } from "wouter";
import type { 
  Colaborador, SegDocumentoColaborador, ProgramaSst, AsoOcupacional, 
  CatAcidente, DdsRegistro, InvestigacaoIncidente 
} from "@shared/schema";

export interface SstTabProps {
  empreendimentoId: number;
}

export function SstTab({ empreendimentoId }: SstTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("resumo");
  
  const { data: colaboradores = [], isLoading: isLoadingColaboradores } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/colaboradores?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar colaboradores");
      return res.json();
    },
  });

  const { data: documentos = [], isLoading: isLoadingDocumentos } = useQuery<SegDocumentoColaborador[]>({
    queryKey: ["/api/seg-documentos", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/seg-documentos?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar documentos");
      return res.json();
    },
  });

  const { data: programas = [] } = useQuery<ProgramaSst[]>({
    queryKey: ["/api/programas-sst", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/programas-sst?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar programas");
      return res.json();
    },
  });

  const { data: asos = [] } = useQuery<AsoOcupacional[]>({
    queryKey: ["/api/asos-ocupacionais", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/asos-ocupacionais?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar ASOs");
      return res.json();
    },
  });

  const { data: cats = [] } = useQuery<CatAcidente[]>({
    queryKey: ["/api/cat-acidentes", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/cat-acidentes?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar CATs");
      return res.json();
    },
  });

  const { data: ddsRegistros = [] } = useQuery<DdsRegistro[]>({
    queryKey: ["/api/dds-registros", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/dds-registros?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar DDS");
      return res.json();
    },
  });

  const { data: investigacoes = [] } = useQuery<InvestigacaoIncidente[]>({
    queryKey: ["/api/investigacoes-incidentes", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/investigacoes-incidentes?empreendimentoId=${empreendimentoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Erro ao carregar investigações");
      return res.json();
    },
  });

  const documentosValidos = documentos.filter((d) => d.status === "valido");
  const documentosVencidos = documentos.filter((d) => d.status === "vencido");
  const documentosAVencer = documentos.filter((d) => d.status === "a_vencer");

  if (isLoadingColaboradores || isLoadingDocumentos) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando informações de SST...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Segurança e Saúde do Trabalho</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão completa de SST: programas, exames, acidentes e DDS
          </p>
        </div>
        <Link href="/sst">
          <Button data-testid="button-manage-sst">
            <Shield className="mr-2 h-4 w-4" />
            Central SST
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="programas" className="text-xs">Programas</TabsTrigger>
          <TabsTrigger value="asos" className="text-xs">ASO</TabsTrigger>
          <TabsTrigger value="cat" className="text-xs">CAT</TabsTrigger>
          <TabsTrigger value="dds" className="text-xs">DDS</TabsTrigger>
          <TabsTrigger value="investigacoes" className="text-xs">Investigações</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-4">
          <ResumoSST 
            colaboradores={colaboradores}
            documentosValidos={documentosValidos}
            documentosAVencer={documentosAVencer}
            documentosVencidos={documentosVencidos}
            programas={programas}
            asos={asos}
            cats={cats}
            dds={ddsRegistros}
          />
        </TabsContent>

        <TabsContent value="programas" className="space-y-4 mt-4">
          <ProgramasSSTSection empreendimentoId={empreendimentoId} programas={programas} />
        </TabsContent>

        <TabsContent value="asos" className="space-y-4 mt-4">
          <ASOsSection empreendimentoId={empreendimentoId} asos={asos} colaboradores={colaboradores} />
        </TabsContent>

        <TabsContent value="cat" className="space-y-4 mt-4">
          <CATSection empreendimentoId={empreendimentoId} cats={cats} colaboradores={colaboradores} />
        </TabsContent>

        <TabsContent value="dds" className="space-y-4 mt-4">
          <DDSSection empreendimentoId={empreendimentoId} dds={ddsRegistros} />
        </TabsContent>

        <TabsContent value="investigacoes" className="space-y-4 mt-4">
          <InvestigacoesSection empreendimentoId={empreendimentoId} investigacoes={investigacoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResumoSST({ 
  colaboradores, documentosValidos, documentosAVencer, documentosVencidos, 
  programas, asos, cats, dds 
}: {
  colaboradores: Colaborador[];
  documentosValidos: SegDocumentoColaborador[];
  documentosAVencer: SegDocumentoColaborador[];
  documentosVencidos: SegDocumentoColaborador[];
  programas: ProgramaSst[];
  asos: AsoOcupacional[];
  cats: CatAcidente[];
  dds: DdsRegistro[];
}) {
  const programasVigentes = programas.filter(p => p.status === 'vigente');
  const asosValidos = asos.filter(a => a.resultado === 'apto');
  
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
                <p className="text-2xl font-bold text-blue-700">{colaboradores.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Programas SST</p>
                <p className="text-2xl font-bold text-purple-700">{programasVigentes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">ASOs Válidos</p>
                <p className="text-2xl font-bold text-green-700">{asosValidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">CATs Registradas</p>
                <p className="text-2xl font-bold text-red-700">{cats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Docs Válidos</p>
                <p className="text-2xl font-bold text-green-700">{documentosValidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Vencer</p>
                <p className="text-2xl font-bold text-yellow-700">{documentosAVencer.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-700">{documentosVencidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">DDS Realizados</p>
                <p className="text-2xl font-bold text-blue-700">{dds.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ProgramasSSTSection({ empreendimentoId, programas }: { empreendimentoId: number; programas: ProgramaSst[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: '',
    nome: '',
    descricao: '',
    responsavelTecnico: '',
    registroProfissional: '',
    dataElaboracao: '',
    dataValidade: '',
    observacoes: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/programas-sst', {
        method: 'POST',
        body: JSON.stringify({ ...data, empreendimentoId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programas-sst'] });
      toast({ title: 'Programa criado com sucesso!' });
      setIsOpen(false);
      setFormData({ tipo: '', nome: '', descricao: '', responsavelTecnico: '', registroProfissional: '', dataElaboracao: '', dataValidade: '', observacoes: '' });
    },
    onError: () => toast({ title: 'Erro ao criar programa', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/programas-sst/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programas-sst'] });
      toast({ title: 'Programa excluído!' });
    },
  });

  const tipoLabels: Record<string, string> = {
    ppra: 'PPRA',
    pcmso: 'PCMSO',
    pgr: 'PGR',
    ltcat: 'LTCAT',
    outro: 'Outro',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Programas de SST (PPRA, PCMSO, PGR, LTCAT)
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Programa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Programa SST</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Programa</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ppra">PPRA</SelectItem>
                      <SelectItem value="pcmso">PCMSO</SelectItem>
                      <SelectItem value="pgr">PGR</SelectItem>
                      <SelectItem value="ltcat">LTCAT</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Responsável Técnico</Label>
                  <Input value={formData.responsavelTecnico} onChange={(e) => setFormData({ ...formData, responsavelTecnico: e.target.value })} />
                </div>
                <div>
                  <Label>Registro Profissional</Label>
                  <Input value={formData.registroProfissional} onChange={(e) => setFormData({ ...formData, registroProfissional: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Elaboração</Label>
                  <Input type="date" value={formData.dataElaboracao} onChange={(e) => setFormData({ ...formData, dataElaboracao: e.target.value })} />
                </div>
                <div>
                  <Label>Data Validade</Label>
                  <Input type="date" value={formData.dataValidade} onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Salvando...' : 'Salvar Programa'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {programas.length === 0 ? (
        <Card className="py-8 text-center text-muted-foreground">
          <ClipboardList className="mx-auto h-12 w-12 mb-4" />
          <p>Nenhum programa SST cadastrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programas.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="mb-2">{tipoLabels[p.tipo] || p.tipo}</Badge>
                    <h5 className="font-semibold">{p.nome}</h5>
                    {p.responsavelTecnico && <p className="text-sm text-muted-foreground">Resp.: {p.responsavelTecnico}</p>}
                    {p.dataValidade && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Validade: {new Date(p.dataValidade).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={p.status === 'vigente' ? 'default' : 'destructive'}>
                      {p.status === 'vigente' ? 'Vigente' : p.status === 'vencido' ? 'Vencido' : 'Em Revisão'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ASOsSection({ empreendimentoId, asos, colaboradores }: { empreendimentoId: number; asos: AsoOcupacional[]; colaboradores: Colaborador[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    colaboradorId: '',
    tipo: '',
    dataExame: '',
    dataValidade: '',
    resultado: 'apto',
    medicoResponsavel: '',
    crm: '',
    clinica: '',
    observacoes: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/asos-ocupacionais', {
        method: 'POST',
        body: JSON.stringify({ ...data, colaboradorId: parseInt(data.colaboradorId), empreendimentoId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/asos-ocupacionais'] });
      toast({ title: 'ASO cadastrado com sucesso!' });
      setIsOpen(false);
    },
    onError: () => toast({ title: 'Erro ao cadastrar ASO', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/asos-ocupacionais/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/asos-ocupacionais'] });
      toast({ title: 'ASO excluído!' });
    },
  });

  const tipoLabels: Record<string, string> = {
    admissional: 'Admissional',
    periodico: 'Periódico',
    demissional: 'Demissional',
    retorno: 'Retorno ao Trabalho',
    mudanca_funcao: 'Mudança de Função',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          ASO - Atestados de Saúde Ocupacional
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo ASO</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo ASO</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Colaborador</Label>
                <Select value={formData.colaboradorId} onValueChange={(v) => setFormData({ ...formData, colaboradorId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de ASO</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admissional">Admissional</SelectItem>
                      <SelectItem value="periodico">Periódico</SelectItem>
                      <SelectItem value="demissional">Demissional</SelectItem>
                      <SelectItem value="retorno">Retorno ao Trabalho</SelectItem>
                      <SelectItem value="mudanca_funcao">Mudança de Função</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Resultado</Label>
                  <Select value={formData.resultado} onValueChange={(v) => setFormData({ ...formData, resultado: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apto">Apto</SelectItem>
                      <SelectItem value="apto_com_restricao">Apto c/ Restrição</SelectItem>
                      <SelectItem value="inapto">Inapto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do Exame</Label>
                  <Input type="date" value={formData.dataExame} onChange={(e) => setFormData({ ...formData, dataExame: e.target.value })} />
                </div>
                <div>
                  <Label>Data de Validade</Label>
                  <Input type="date" value={formData.dataValidade} onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Médico Responsável</Label>
                  <Input value={formData.medicoResponsavel} onChange={(e) => setFormData({ ...formData, medicoResponsavel: e.target.value })} />
                </div>
                <div>
                  <Label>CRM</Label>
                  <Input value={formData.crm} onChange={(e) => setFormData({ ...formData, crm: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Clínica/Hospital</Label>
                <Input value={formData.clinica} onChange={(e) => setFormData({ ...formData, clinica: e.target.value })} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Salvando...' : 'Salvar ASO'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {asos.length === 0 ? (
        <Card className="py-8 text-center text-muted-foreground">
          <Stethoscope className="mx-auto h-12 w-12 mb-4" />
          <p>Nenhum ASO cadastrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {asos.map((a: any) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{a.colaboradorNome || `Colaborador #${a.colaboradorId}`}</p>
                    <Badge variant="outline" className="my-1">{tipoLabels[a.tipo] || a.tipo}</Badge>
                    <p className="text-sm text-muted-foreground">
                      Exame: {new Date(a.dataExame).toLocaleDateString('pt-BR')}
                    </p>
                    {a.medicoResponsavel && <p className="text-xs text-muted-foreground">Dr(a). {a.medicoResponsavel}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={a.resultado === 'apto' ? 'default' : a.resultado === 'inapto' ? 'destructive' : 'secondary'}>
                      {a.resultado === 'apto' ? 'Apto' : a.resultado === 'inapto' ? 'Inapto' : 'Com Restrição'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CATSection({ empreendimentoId, cats, colaboradores }: { empreendimentoId: number; cats: CatAcidente[]; colaboradores: Colaborador[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    colaboradorId: '',
    numeroCat: '',
    dataAcidente: '',
    horaAcidente: '',
    tipoAcidente: '',
    localAcidente: '',
    descricao: '',
    parteCorpoAtingida: '',
    agenteCausador: '',
    houveAfastamento: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/cat-acidentes', {
        method: 'POST',
        body: JSON.stringify({ 
          ...data, 
          colaboradorId: parseInt(data.colaboradorId), 
          empreendimentoId,
          dataAcidente: new Date(data.dataAcidente).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cat-acidentes'] });
      toast({ title: 'CAT registrada com sucesso!' });
      setIsOpen(false);
    },
    onError: () => toast({ title: 'Erro ao registrar CAT', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/cat-acidentes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cat-acidentes'] });
      toast({ title: 'CAT excluída!' });
    },
  });

  const tipoLabels: Record<string, string> = {
    tipico: 'Típico',
    trajeto: 'Trajeto',
    doenca_ocupacional: 'Doença Ocupacional',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          CAT - Comunicação de Acidente de Trabalho
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive"><Plus className="h-4 w-4 mr-1" /> Registrar CAT</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar CAT</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Colaborador Acidentado</Label>
                <Select value={formData.colaboradorId} onValueChange={(v) => setFormData({ ...formData, colaboradorId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Acidente</Label>
                  <Select value={formData.tipoAcidente} onValueChange={(v) => setFormData({ ...formData, tipoAcidente: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tipico">Típico</SelectItem>
                      <SelectItem value="trajeto">Trajeto</SelectItem>
                      <SelectItem value="doenca_ocupacional">Doença Ocupacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número CAT</Label>
                  <Input value={formData.numeroCat} onChange={(e) => setFormData({ ...formData, numeroCat: e.target.value })} placeholder="Opcional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do Acidente</Label>
                  <Input type="date" value={formData.dataAcidente} onChange={(e) => setFormData({ ...formData, dataAcidente: e.target.value })} />
                </div>
                <div>
                  <Label>Hora do Acidente</Label>
                  <Input type="time" value={formData.horaAcidente} onChange={(e) => setFormData({ ...formData, horaAcidente: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Local do Acidente</Label>
                <Input value={formData.localAcidente} onChange={(e) => setFormData({ ...formData, localAcidente: e.target.value })} />
              </div>
              <div>
                <Label>Descrição do Acidente</Label>
                <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Parte do Corpo Atingida</Label>
                  <Input value={formData.parteCorpoAtingida} onChange={(e) => setFormData({ ...formData, parteCorpoAtingida: e.target.value })} />
                </div>
                <div>
                  <Label>Agente Causador</Label>
                  <Input value={formData.agenteCausador} onChange={(e) => setFormData({ ...formData, agenteCausador: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Registrando...' : 'Registrar CAT'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cats.length === 0 ? (
        <Card className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
          <p>Nenhuma CAT registrada</p>
          <p className="text-sm mt-1 text-green-600">Isso é bom! Significa que não houveram acidentes.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cats.map((c: any) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{c.colaboradorNome || `Colaborador #${c.colaboradorId}`}</p>
                    <Badge variant="outline" className="my-1">{tipoLabels[c.tipoAcidente] || c.tipoAcidente}</Badge>
                    <p className="text-sm">{c.descricao?.substring(0, 80)}...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(c.dataAcidente).toLocaleDateString('pt-BR')} {c.horaAcidente && `às ${c.horaAcidente}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={c.status === 'registrado' ? 'secondary' : c.status === 'encerrado' ? 'default' : 'outline'}>
                      {c.status === 'registrado' ? 'Registrado' : c.status === 'encerrado' ? 'Encerrado' : 'Em Investigação'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DDSSection({ empreendimentoId, dds }: { empreendimentoId: number; dds: DdsRegistro[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    data: '',
    horario: '',
    duracao: '',
    tema: '',
    conteudo: '',
    responsavelNome: '',
    totalParticipantes: '',
    observacoes: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/dds-registros', {
        method: 'POST',
        body: JSON.stringify({ 
          ...data, 
          empreendimentoId,
          duracao: data.duracao ? parseInt(data.duracao) : null,
          totalParticipantes: data.totalParticipantes ? parseInt(data.totalParticipantes) : null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dds-registros'] });
      toast({ title: 'DDS registrado com sucesso!' });
      setIsOpen(false);
    },
    onError: () => toast({ title: 'Erro ao registrar DDS', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/dds-registros/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dds-registros'] });
      toast({ title: 'DDS excluído!' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          DDS - Diálogo Diário de Segurança
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo DDS</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar DDS</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={formData.horario} onChange={(e) => setFormData({ ...formData, horario: e.target.value })} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" value={formData.duracao} onChange={(e) => setFormData({ ...formData, duracao: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Tema</Label>
                <Input value={formData.tema} onChange={(e) => setFormData({ ...formData, tema: e.target.value })} placeholder="Ex: Uso correto de EPIs" />
              </div>
              <div>
                <Label>Conteúdo Abordado</Label>
                <Textarea value={formData.conteudo} onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Responsável</Label>
                  <Input value={formData.responsavelNome} onChange={(e) => setFormData({ ...formData, responsavelNome: e.target.value })} />
                </div>
                <div>
                  <Label>Nº Participantes</Label>
                  <Input type="number" value={formData.totalParticipantes} onChange={(e) => setFormData({ ...formData, totalParticipantes: e.target.value })} />
                </div>
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Salvando...' : 'Registrar DDS'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dds.length === 0 ? (
        <Card className="py-8 text-center text-muted-foreground">
          <MessageSquare className="mx-auto h-12 w-12 mb-4" />
          <p>Nenhum DDS registrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dds.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{d.tema}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(d.data).toLocaleDateString('pt-BR')} {d.horario && `às ${d.horario}`}
                    </p>
                    {d.responsavelNome && <p className="text-xs text-muted-foreground">Por: {d.responsavelNome}</p>}
                    {d.totalParticipantes && (
                      <Badge variant="outline" className="mt-2">{d.totalParticipantes} participantes</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InvestigacoesSection({ empreendimentoId, investigacoes }: { empreendimentoId: number; investigacoes: InvestigacaoIncidente[] }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    dataIncidente: '',
    localIncidente: '',
    descricao: '',
    gravidade: 'media',
    tipo: '',
    metodologia: '',
    causaRaiz: '',
    acoesCorretivas: '',
    licoesAprendidas: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('/api/investigacoes-incidentes', {
        method: 'POST',
        body: JSON.stringify({ 
          ...data, 
          empreendimentoId,
          dataIncidente: new Date(data.dataIncidente).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investigacoes-incidentes'] });
      toast({ title: 'Investigação registrada com sucesso!' });
      setIsOpen(false);
    },
    onError: () => toast({ title: 'Erro ao registrar investigação', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/investigacoes-incidentes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investigacoes-incidentes'] });
      toast({ title: 'Investigação excluída!' });
    },
  });

  const tipoLabels: Record<string, string> = {
    acidente: 'Acidente',
    quase_acidente: 'Quase Acidente',
    incidente: 'Incidente',
    desvio: 'Desvio',
  };

  const gravidadeColors: Record<string, string> = {
    baixa: 'bg-green-100 text-green-800',
    media: 'bg-yellow-100 text-yellow-800',
    alta: 'bg-orange-100 text-orange-800',
    critica: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5 text-orange-500" />
          Investigação de Incidentes
        </h4>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Investigação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Investigação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acidente">Acidente</SelectItem>
                      <SelectItem value="quase_acidente">Quase Acidente</SelectItem>
                      <SelectItem value="incidente">Incidente</SelectItem>
                      <SelectItem value="desvio">Desvio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gravidade</Label>
                  <Select value={formData.gravidade} onValueChange={(v) => setFormData({ ...formData, gravidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data do Incidente</Label>
                  <Input type="date" value={formData.dataIncidente} onChange={(e) => setFormData({ ...formData, dataIncidente: e.target.value })} />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={formData.localIncidente} onChange={(e) => setFormData({ ...formData, localIncidente: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição do Ocorrido</Label>
                <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Metodologia de Análise</Label>
                <Select value={formData.metodologia} onValueChange={(v) => setFormData({ ...formData, metodologia: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5_porques">5 Porquês</SelectItem>
                    <SelectItem value="ishikawa">Diagrama de Ishikawa</SelectItem>
                    <SelectItem value="arvore_falhas">Árvore de Falhas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Causa Raiz</Label>
                <Textarea value={formData.causaRaiz} onChange={(e) => setFormData({ ...formData, causaRaiz: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Ações Corretivas</Label>
                <Textarea value={formData.acoesCorretivas} onChange={(e) => setFormData({ ...formData, acoesCorretivas: e.target.value })} rows={2} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Salvando...' : 'Registrar Investigação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {investigacoes.length === 0 ? (
        <Card className="py-8 text-center text-muted-foreground">
          <Search className="mx-auto h-12 w-12 mb-4" />
          <p>Nenhuma investigação registrada</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {investigacoes.map((inv) => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-semibold">{inv.titulo}</h5>
                    <div className="flex gap-2 my-2">
                      <Badge variant="outline">{tipoLabels[inv.tipo] || inv.tipo}</Badge>
                      <Badge className={gravidadeColors[inv.gravidade] || ''}>
                        {inv.gravidade?.charAt(0).toUpperCase() + inv.gravidade?.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{inv.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(inv.dataIncidente).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={inv.status === 'concluida' ? 'default' : 'secondary'}>
                      {inv.status === 'em_investigacao' ? 'Em Investigação' : inv.status === 'concluida' ? 'Concluída' : 'Arquivada'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(inv.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
