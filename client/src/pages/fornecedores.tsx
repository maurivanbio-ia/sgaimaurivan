"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, Building2, Star, Filter, Phone, MapPin, Loader2 } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fornecedorSchema = z.object({
  id: z.number().optional(),
  razaoSocial: z.string().min(1, "Razão Social obrigatória"),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  tipo: z.string().min(1, "Tipo obrigatório"),
  categoria: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  site: z.string().optional(),
  contatoPrincipal: z.string().optional(),
  contatoEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contatoTelefone: z.string().optional(),
  servicosPrestados: z.string().optional(),
  observacoes: z.string().optional(),
  avaliacao: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(1).max(5).optional()).optional(),
  status: z.string().min(1, "Status obrigatório"),
  contratoVigente: z.boolean().optional().default(false),
  dataInicioContrato: z.string().optional(),
  dataFimContrato: z.string().optional(),
  valorContrato: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
});

type FornecedorForm = z.infer<typeof fornecedorSchema>;

interface Fornecedor extends FornecedorForm {
  id: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

const TIPO_OPTIONS = [
  { value: "laboratorio", label: "Laboratório" },
  { value: "transportadora", label: "Transportadora" },
  { value: "consultoria", label: "Consultoria" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "servicos", label: "Serviços" },
  { value: "materiais", label: "Materiais" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "inativo", label: "Inativo", color: "bg-gray-500" },
  { value: "bloqueado", label: "Bloqueado", color: "bg-red-500" },
];

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

function StarRating({ value, onChange, readOnly = false }: { value?: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            value && star <= value
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          } ${!readOnly ? "cursor-pointer hover:text-yellow-400" : ""}`}
          onClick={() => !readOnly && onChange?.(star)}
        />
      ))}
    </div>
  );
}

export default function FornecedoresPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter]);

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ["/api/fornecedores", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/fornecedores${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar fornecedores");
      return res.json();
    },
  });

  const form = useForm<FornecedorForm>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      razaoSocial: "",
      nomeFantasia: "",
      tipo: "",
      status: "ativo",
      contratoVigente: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FornecedorForm) => apiRequest("POST", "/api/fornecedores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fornecedores"] });
      toast({ title: "Sucesso", description: "Fornecedor cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar fornecedor",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FornecedorForm }) =>
      apiRequest("PUT", `/api/fornecedores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fornecedores"] });
      toast({ title: "Sucesso", description: "Fornecedor atualizado!" });
      setIsDialogOpen(false);
      setEditingFornecedor(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar fornecedor",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fornecedores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fornecedores"] });
      toast({ title: "Sucesso", description: "Fornecedor removido!" });
      setDeleteDialogOpen(false);
      setFornecedorToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir fornecedor",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FornecedorForm) => {
    const cleanData = {
      ...data,
      email: data.email || undefined,
      contatoEmail: data.contatoEmail || undefined,
    };
    editingFornecedor
      ? updateMutation.mutate({ id: editingFornecedor.id, data: cleanData })
      : createMutation.mutate(cleanData);
  };

  const handleNew = () => {
    setEditingFornecedor(null);
    form.reset({
      razaoSocial: "",
      nomeFantasia: "",
      tipo: "",
      status: "ativo",
      contratoVigente: false,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    form.reset({
      ...fornecedor,
      contratoVigente: fornecedor.contratoVigente ?? false,
      email: fornecedor.email || "",
      contatoEmail: fornecedor.contatoEmail || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setFornecedorToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (fornecedorToDelete) deleteMutation.mutate(fornecedorToDelete);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find((x) => x.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : null;
  };

  const getTipoLabel = (tipo: string) => {
    const t = TIPO_OPTIONS.find((x) => x.value === tipo);
    return t?.label ?? tipo;
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-fornecedores">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Banco de Fornecedores
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie fornecedores, prestadores de serviços e parceiros comerciais
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Button onClick={handleNew} data-testid="button-novo-fornecedor">
            <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social, CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-fornecedores"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores ({fornecedores.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fornecedores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum fornecedor encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{fornecedor.razaoSocial}</div>
                          {fornecedor.nomeFantasia && (
                            <div className="text-sm text-muted-foreground">
                              {fornecedor.nomeFantasia}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoLabel(fornecedor.tipo)}</Badge>
                      </TableCell>
                      <TableCell>
                        {fornecedor.cidade || fornecedor.uf ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[fornecedor.cidade, fornecedor.uf].filter(Boolean).join("/")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fornecedor.telefone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {fornecedor.telefone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StarRating value={fornecedor.avaliacao} readOnly />
                      </TableCell>
                      <TableCell>{getStatusBadge(fornecedor.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(fornecedor)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(fornecedor.id)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
                  <TabsTrigger value="contato">Contato</TabsTrigger>
                  <TabsTrigger value="contrato">Contrato</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="razaoSocial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razão Social *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Razão Social do fornecedor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nomeFantasia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Fantasia</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome fantasia" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00.000.000/0000-00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPO_OPTIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
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
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Subcategoria" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
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
                    name="avaliacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avaliação</FormLabel>
                        <FormControl>
                          <StarRating
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="servicosPrestados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serviços Prestados</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descrição dos serviços prestados" rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Observações adicionais" rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="contato" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@empresa.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="site"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://www.empresa.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 0000-0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="celular"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="endereco"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Rua, número, bairro" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UF_OPTIONS.map((uf) => (
                                <SelectItem key={uf} value={uf}>
                                  {uf}
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
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00000-000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Contato Principal</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="contatoPrincipal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome do contato" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contatoEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="contato@empresa.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contatoTelefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(00) 00000-0000" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contrato" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="contratoVigente"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Contrato Vigente
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="dataInicioContrato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Início Contrato</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dataFimContrato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Fim Contrato</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="valorContrato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor do Contrato (R$)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="0,00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingFornecedor ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
