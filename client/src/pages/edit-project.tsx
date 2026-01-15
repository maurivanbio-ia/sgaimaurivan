import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, ChevronsUpDown, Check, User, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Empreendimento } from "@shared/schema";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Colaborador {
  id: number;
  nome: string;
  cargo: string | null;
  email: string | null;
  tipo: string; // exemplo: "user" ou "rh" etc
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

function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function makeSearchParams(unidadeSelecionada?: string | null) {
  const params = new URLSearchParams();
  if (unidadeSelecionada) params.set("unidade", unidadeSelecionada);
  return params;
}

/**
 * Melhoria importante.
 * 1) Persistir IDs em vez de nomes para responsável interno.
 * 2) Ainda enviar o nome como fallback para manter compatibilidade com backend antigo.
 * 3) Normalizar latitude e longitude para número ou null.
 * 4) Passar unidade nas rotas GET e PUT.
 * 5) Corrigir queryKeys e invalidações.
 */
const projectSchema = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]*$/, "Use apenas A-Z, 0-9, _ ou -")
    .optional()
    .or(z.literal("")),
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
  localizacao: z.string().min(1, "Localização é obrigatória"),

  latitude: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : Number(v)),
    z.number().min(-90, "Latitude deve estar entre -90 e 90").max(90, "Latitude deve estar entre -90 e 90").nullable()
  ),
  longitude: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : Number(v)),
    z.number().min(-180, "Longitude deve estar entre -180 e 180").max(180, "Longitude deve estar entre -180 e 180").nullable()
  ),

  // Novo padrão.
  responsavelInternoId: z.coerce.number().int().positive("Responsável interno é obrigatório"),

  // Compatibilidade.
  responsavelInterno: z.string().optional(),

  coordenadorId: z.coerce.number().int().positive().nullable().optional(),
  tipo: z.string().default("outro"),
  status: z.string().default("ativo"),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function EditProject() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { unidadeSelecionada } = useUnidade();

  const [openResponsavel, setOpenResponsavel] = useState(false);
  const [openCoordenador, setOpenCoordenador] = useState(false);

  const empreendimentoId = Number(id);
  const idOk = Number.isFinite(empreendimentoId);

  const unidadeParams = useMemo(() => makeSearchParams(unidadeSelecionada), [unidadeSelecionada]);
  const unidadeQuerySuffix = unidadeParams.toString();

  const {
    data: colaboradores = [],
    isLoading: isLoadingColabs,
    error: colabError,
  } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores", unidadeSelecionada],
    enabled: !!unidadeSelecionada,
    staleTime: 60_000,
    queryFn: async () => {
      const url = unidadeQuerySuffix ? `/api/colaboradores?${unidadeQuerySuffix}` : "/api/colaboradores";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar colaboradores");
      return (await r.json()) as Colaborador[];
    },
  });

  const usuariosSistema = useMemo(() => colaboradores.filter((c) => c.tipo === "user"), [colaboradores]);

  const {
    data: project,
    isLoading,
    error: projectError,
  } = useQuery<Empreendimento>({
    queryKey: ["/api/empreendimentos", empreendimentoId, unidadeSelecionada],
    enabled: idOk && !!unidadeSelecionada,
    staleTime: 30_000,
    queryFn: async () => {
      const url = unidadeQuerySuffix
        ? `/api/empreendimentos/${empreendimentoId}?${unidadeQuerySuffix}`
        : `/api/empreendimentos/${empreendimentoId}`;

      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Falha ao carregar empreendimento");
      return (await r.json()) as Empreendimento;
    },
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      cliente: "",
      localizacao: "",
      latitude: null,
      longitude: null,
      responsavelInternoId: 0 as any, // será setado no reset.
      responsavelInterno: "",
      coordenadorId: null,
      tipo: "outro",
      status: "ativo",
    },
    mode: "onChange",
  });

  const responsavelInternoId = form.watch("responsavelInternoId");
  const coordenadorId = form.watch("coordenadorId");

  const responsavelSelecionado = useMemo(() => {
    if (!responsavelInternoId) return null;
    return colaboradores.find((c) => c.id === responsavelInternoId) ?? null;
  }, [colaboradores, responsavelInternoId]);

  const coordenadorSelecionado = useMemo(() => {
    if (!coordenadorId) return null;
    return usuariosSistema.find((c) => c.id === coordenadorId) ?? null;
  }, [usuariosSistema, coordenadorId]);

  useEffect(() => {
    if (!project) return;

    // Compatibilidade.
    // Caso seu backend ainda não tenha responsavelInternoId, tentamos inferir pelo nome.
    const possibleRespId =
      (project as any).responsavelInternoId ??
      (project as any).responsavelInterno_id ??
      null;

    const respIdFromName =
      possibleRespId
        ? Number(possibleRespId)
        : (() => {
            const nome = (project as any).responsavelInterno as string | undefined;
            if (!nome) return null;
            const found = colaboradores.find((c) => c.nome === nome);
            return found?.id ?? null;
          })();

    const finalRespId = toNumberOrNull(respIdFromName) ?? 0;

    form.reset({
      codigo: (project.codigo || "").toUpperCase(),
      nome: project.nome ?? "",
      cliente: project.cliente ?? "",
      localizacao: project.localizacao ?? "",
      latitude: toNumberOrNull((project as any).latitude) as any,
      longitude: toNumberOrNull((project as any).longitude) as any,
      responsavelInternoId: finalRespId as any,
      responsavelInterno: (project as any).responsavelInterno ?? "",
      coordenadorId: toNumberOrNull((project as any).coordenadorId) as any,
      tipo: (project as any).tipo || "outro",
      status: (project as any).status || "ativo",
    });
  }, [project, colaboradores, form]);

  const updateProject = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      // Envia ID e nome como fallback, mantendo compatibilidade.
      const respName = colaboradores.find((c) => c.id === data.responsavelInternoId)?.nome ?? data.responsavelInterno ?? "";

      const payload = {
        ...data,
        responsavelInterno: respName,
      };

      const url = unidadeQuerySuffix
        ? `/api/empreendimentos/${empreendimentoId}?${unidadeQuerySuffix}`
        : `/api/empreendimentos/${empreendimentoId}`;

      const response = await apiRequest("PUT", url, payload);
      return response.json();
    },
    onSuccess: () => {
      // Corrige invalidação para bater com queryKey real.
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, unidadeSelecionada] });

      toast({
        title: "Sucesso",
        description: "Empreendimento atualizado com sucesso!",
      });

      setOpenResponsavel(false);
      setOpenCoordenador(false);
      setLocation(`/empreendimentos/${empreendimentoId}`);
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err?.message || "Erro ao atualizar empreendimento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    updateProject.mutate(data);
  };

  if (!idOk) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">ID inválido.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando dados do empreendimento...</div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-2">
        <div className="text-center">Falha ao carregar empreendimento.</div>
        <div className="text-center text-sm text-muted-foreground">
          {(projectError as any)?.message || "Erro desconhecido"}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Empreendimento não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Editar Empreendimento</h2>
        <p className="text-muted-foreground mt-2">Atualize as informações do empreendimento.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Código do Projeto
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: PROJ001"
                        className="uppercase"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-codigo"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Código usado para identificação nas pastas. Use letras maiúsculas, números, _ ou .
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
                    <FormLabel>Nome do Empreendimento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do empreendimento" data-testid="input-nome" />
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do cliente" data-testid="input-cliente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Localização do empreendimento" data-testid="input-localizacao" />
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
                          value={field.value === null || field.value === undefined ? "" : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="Ex: -12.345678"
                          inputMode="decimal"
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
                          value={field.value === null || field.value === undefined ? "" : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="Ex: -38.123456"
                          inputMode="decimal"
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
                name="responsavelInternoId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Responsável Interno *</FormLabel>

                    <Popover open={openResponsavel} onOpenChange={setOpenResponsavel}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openResponsavel}
                            disabled={isLoadingColabs || !!colabError}
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                            data-testid="input-responsavel"
                          >
                            {isLoadingColabs
                              ? "Carregando colaboradores..."
                              : colabError
                                ? "Falha ao carregar colaboradores"
                                : responsavelSelecionado
                                  ? responsavelSelecionado.nome
                                  : "Selecione um colaborador do RH"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>

                      <PopoverContent className="w-[420px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar colaborador..." />
                          <CommandList>
                            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                            <CommandGroup>
                              {colaboradores.map((colab) => (
                                <CommandItem
                                  key={`resp-${colab.id}`}
                                  value={`${colab.nome} ${colab.email ?? ""} ${colab.cargo ?? ""}`}
                                  onSelect={() => {
                                    field.onChange(colab.id);
                                    setOpenResponsavel(false);
                                  }}
                                  aria-selected={field.value === colab.id}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  <div className="flex flex-col">
                                    <span>{colab.nome}</span>
                                    {colab.cargo ? (
                                      <span className="text-xs text-primary font-medium">{colab.cargo}</span>
                                    ) : null}
                                    {colab.email ? (
                                      <span className="text-xs text-muted-foreground">{colab.email}</span>
                                    ) : null}
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
                            disabled={isLoadingColabs || !!colabError}
                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                            data-testid="input-coordenador"
                          >
                            {isLoadingColabs
                              ? "Carregando coordenadores..."
                              : colabError
                                ? "Falha ao carregar coordenadores"
                                : coordenadorSelecionado
                                  ? coordenadorSelecionado.nome
                                  : "Selecione um coordenador"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>

                      <PopoverContent className="w-[420px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar coordenador..." />
                          <CommandList>
                            <CommandEmpty>Nenhum coordenador encontrado.</CommandEmpty>
                            <CommandGroup>
                              {usuariosSistema.map((colab) => (
                                <CommandItem
                                  key={`coord-${colab.id}`}
                                  value={`${colab.nome} ${colab.email ?? ""} ${colab.cargo ?? ""}`}
                                  onSelect={() => {
                                    field.onChange(colab.id);
                                    setOpenCoordenador(false);
                                  }}
                                  aria-selected={field.value === colab.id}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  <div className="flex flex-col">
                                    <span>{colab.nome}</span>
                                    {colab.cargo ? (
                                      <span className="text-xs text-primary font-medium">{colab.cargo}</span>
                                    ) : null}
                                    {colab.email ? (
                                      <span className="text-xs text-muted-foreground">{colab.email}</span>
                                    ) : null}
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
                      Selecione o coordenador responsável pelo projeto para que apareça no Dashboard do Coordenador.
                    </p>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/empreendimentos/${empreendimentoId}`)}
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>

                <Button type="submit" disabled={updateProject.isPending} data-testid="button-save">
                  <Save className="mr-2 h-4 w-4" />
                  {updateProject.isPending ? "Salvando..." : "Atualizar"}
                </Button>
              </div>

              {/* Diagnóstico opcional para desenvolvimento */}
              {process.env.NODE_ENV !== "production" && (
                <div className="text-xs text-muted-foreground">
                  Unidade: {unidadeSelecionada || "nenhuma"}. EmpreendimentoId: {empreendimentoId}.
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
