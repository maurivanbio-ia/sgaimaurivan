import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, ChevronsUpDown, Check, User, Users, Wand2, Camera, Building2, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface Colaborador {
  id: number;
  nome: string;
  cargo: string | null;
  email: string | null;
  tipo: string;
}

const tipologiaOptions = [
  { value: "hidreletrica", label: "💧 Hidrelétrica" },
  { value: "parque_eolico", label: "🌪️ Parque Eólico" },
  { value: "usina_solar", label: "☀️ Usina Solar" },
  { value: "termoeletrica", label: "🔥 Termelétrica" },
  { value: "linha_transmissao", label: "⚡ Linha de Transmissão" },
  { value: "mina", label: "⛏️ Mineração" },
  { value: "pchs", label: "🏭 PCH" },
  { value: "outro", label: "📍 Outro" },
];

const statusOptions = [
  { value: "ativo", label: "✅ Ativo" },
  { value: "em_planejamento", label: "📋 Em Planejamento" },
  { value: "em_execucao", label: "🔄 Em Execução" },
  { value: "concluido", label: "🏁 Concluído" },
  { value: "inativo", label: "⏸️ Inativo" },
  { value: "cancelado", label: "❌ Cancelado" },
];
import { useUnidade } from "@/contexts/UnidadeContext";

const projectSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").regex(/^[A-Z0-9_-]+$/, "Código deve conter apenas letras maiúsculas, números, _ e -"),
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
  clienteEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clienteTelefone: z.string().optional(),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  latitude: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = Number(val);
    return !isNaN(num) && num >= -90 && num <= 90;
  }, "Latitude deve estar entre -90 e 90"),
  longitude: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = Number(val);
    return !isNaN(num) && num >= -180 && num <= 180;
  }, "Longitude deve estar entre -180 e 180"),
  responsavelInterno: z.string().min(1, "Responsável interno é obrigatório"),
  coordenadorId: z.number().optional(),
  tipo: z.enum(["hidreletrica", "parque_eolico", "usina_solar", "termoeletrica", "linha_transmissao", "mina", "pchs", "outro"]).default("outro"),
  status: z.enum(["ativo", "em_planejamento", "em_execucao", "concluido", "inativo", "cancelado"]).default("ativo"),
  gestorNome: z.string().optional(),
  gestorEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  gestorTelefone: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { unidadeSelecionada } = useUnidade();
  const [openResponsavel, setOpenResponsavel] = useState(false);
  const [openCoordenador, setOpenCoordenador] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoZoom, setLogoZoom] = useState(1);

  const { data: colaboradores = [], isLoading: isLoadingColabs } = useQuery<Colaborador[]>({
    queryKey: ['/api/colaboradores'],
    staleTime: 0,
  });

  const { data: existingProjects = [] } = useQuery<{ id: number; codigo: string | null }[]>({
    queryKey: ['/api/empreendimentos', unidadeSelecionada],
  });

  const generateCode = () => {
    const existingCodes = existingProjects
      .map(p => p.codigo)
      .filter((c): c is string => c !== null && c.startsWith('PROJ'))
      .map(c => parseInt(c.replace('PROJ', ''), 10))
      .filter(n => !isNaN(n));
    
    const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `PROJ${String(nextNumber).padStart(3, '0')}`;
  };

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      cliente: "",
      clienteEmail: "",
      clienteTelefone: "",
      localizacao: "",
      latitude: "",
      longitude: "",
      responsavelInterno: "",
      tipo: "outro",
      status: "ativo",
      gestorNome: "",
      gestorEmail: "",
      gestorTelefone: "",
    },
  });

  const handleGenerateCode = () => {
    const newCode = generateCode();
    form.setValue('codigo', newCode);
  };

  const createProject = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("POST", "/api/empreendimentos", {
        ...data,
        unidade: unidadeSelecionada,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({
        title: "Sucesso",
        description: "Empreendimento cadastrado com sucesso!",
      });
      setLocation("/empreendimentos");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar empreendimento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/image/server", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { filePath } = await response.json();
      setLogoUrl(filePath);
      toast({ title: "Logo enviada com sucesso!" });
    } catch {
      toast({ title: "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  };

  const onSubmit = (data: ProjectFormData) => {
    createProject.mutate({ ...data, logoUrl } as any);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Novo Empreendimento</h2>
        <p className="text-muted-foreground mt-2">Cadastre um novo empreendimento no sistema</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Logo do Empreendimento */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Logo do Empreendimento</p>
                <label className="relative cursor-pointer group" title="Clique para adicionar logo">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/60">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain transition-transform"
                        style={{ transform: `scale(${logoZoom})` }}
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-muted-foreground/50" />
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {logoUploading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-7 h-7 text-white" />
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setLogoZoom(1); handleLogoUpload(file); }
                      e.target.value = "";
                    }}
                  />
                </label>
                {logoUrl && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setLogoZoom(z => Math.max(0.3, parseFloat((z - 0.1).toFixed(1))))}
                      title="Diminuir zoom"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(logoZoom * 100)}%</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setLogoZoom(z => Math.min(3, parseFloat((z + 0.1).toFixed(1))))}
                      title="Aumentar zoom"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 5 MB</p>
              </div>

              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código do Projeto *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: PROJ001"
                          className="uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-project-code"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateCode}
                        className="shrink-0"
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Gerar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Código único para identificação nas pastas. Use letras maiúsculas, números, _ ou -
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do empreendimento *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o nome do empreendimento"
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia do Empreendimento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipologia">
                            <SelectValue placeholder="Selecione a tipologia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tipologiaOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do Empreendimento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do cliente responsável"
                        data-testid="input-client"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clienteEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Cliente</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email"
                          placeholder="cliente@empresa.com"
                          data-testid="input-client-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clienteTelefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone/WhatsApp do Cliente</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="(71) 98780-2223"
                          data-testid="input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Cidade, Estado"
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: -12.345678"
                          data-testid="input-latitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: -38.123456"
                          data-testid="input-longitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="responsavelInterno"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Responsável interno *</FormLabel>
                    <Popover open={openResponsavel} onOpenChange={setOpenResponsavel}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openResponsavel}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-responsible"
                          >
                            {field.value || "Selecione um colaborador do RH"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar colaborador..." />
                          <CommandList>
                            {isLoadingColabs ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                            ) : colaboradores.length === 0 ? (
                              <CommandEmpty>Nenhum colaborador encontrado. Cadastre colaboradores no RH.</CommandEmpty>
                            ) : (
                              <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                            )}
                            <CommandGroup>
                              {colaboradores.map((colab) => (
                                <CommandItem
                                  key={`${colab.tipo}-${colab.id}`}
                                  value={colab.nome}
                                  onSelect={() => {
                                    field.onChange(colab.nome);
                                    setOpenResponsavel(false);
                                  }}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  <div className="flex flex-col">
                                    <span>{colab.nome}</span>
                                    {colab.cargo && (
                                      <span className="text-xs text-primary font-medium">{colab.cargo}</span>
                                    )}
                                    {colab.email && (
                                      <span className="text-xs text-muted-foreground">{colab.email}</span>
                                    )}
                                  </div>
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      field.value === colab.nome ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coordenadorId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Coordenador do Projeto</FormLabel>
                    <Popover open={openCoordenador} onOpenChange={setOpenCoordenador}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCoordenador}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-coordenador"
                          >
                            {field.value
                              ? colaboradores.find((c) => c.tipo === 'user' && c.id === field.value)?.nome || "Selecione um coordenador"
                              : "Selecione um coordenador"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar coordenador..." />
                          <CommandList>
                            {isLoadingColabs ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                            ) : colaboradores.filter(c => c.tipo === 'user').length === 0 ? (
                              <CommandEmpty>Nenhum usuário do sistema encontrado.</CommandEmpty>
                            ) : (
                              <CommandEmpty>Nenhum coordenador encontrado.</CommandEmpty>
                            )}
                            <CommandGroup>
                              {colaboradores.filter(c => c.tipo === 'user').map((colab) => (
                                <CommandItem
                                  key={`coord-${colab.id}`}
                                  value={colab.nome}
                                  onSelect={() => {
                                    field.onChange(colab.id);
                                    setOpenCoordenador(false);
                                  }}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  <div className="flex flex-col">
                                    <span>{colab.nome}</span>
                                    {colab.cargo && (
                                      <span className="text-xs text-primary font-medium">{colab.cargo}</span>
                                    )}
                                    {colab.email && (
                                      <span className="text-xs text-muted-foreground">{colab.email}</span>
                                    )}
                                  </div>
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      field.value === colab.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Selecione o coordenador responsável pelo projeto para que apareça no Dashboard do Coordenador
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gestor Responsável pelo Contrato */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Gestor Responsável pelo Contrato
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={form.control} name="gestorNome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input placeholder="Nome do gestor" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gestorEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl><Input type="email" placeholder="email@empresa.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="gestorTelefone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="flex space-x-4">
                <Button 
                  type="submit" 
                  disabled={createProject.isPending}
                  className="font-medium"
                  data-testid="button-save-project"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createProject.isPending ? "Salvando..." : "Salvar Empreendimento"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/empreendimentos")}
                  className="font-medium"
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
