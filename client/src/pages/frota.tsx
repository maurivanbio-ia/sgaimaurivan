import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
import { 
  Plus, 
  Search, 
  Filter,
  Truck,
  Car,
  Settings,
  Calendar,
  MapPin,
  Fuel,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Clock,
  Edit,
  Eye,
  Trash2,
  RefreshCw,
  Upload,
  FileText,
  X,
  Download,
  Shield,
  FileCheck,
  ChevronDown
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshButton } from "@/components/RefreshButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest, apiRequestFormData } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";

// Status configuration for vehicles
const STATUS_CONFIG = {
  disponivel: { label: "Disponível", color: "bg-green-500", icon: CheckCircle },
  em_uso: { label: "Em Uso", color: "bg-blue-500", icon: Car },
  manutencao: { label: "Manutenção", color: "bg-yellow-500", icon: Wrench },
  indisponivel: { label: "Indisponível", color: "bg-red-500", icon: AlertTriangle }
};

// Vehicle type configuration
const TIPO_CONFIG = {
  carro: { label: "Carro", icon: Car },
  caminhonete: { label: "Caminhonete", icon: Truck },
  caminhao: { label: "Caminhão", icon: Truck },
  van: { label: "Van", icon: Car },
  moto: { label: "Motocicleta", icon: Car }
};

// Mock vehicle interface (will be replaced with proper schema later)
interface Veiculo {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  tipo: string;
  status: keyof typeof STATUS_CONFIG;
  kmAtual: number;
  combustivel: string;
  seguro: string;
  proximaRevisao: string;
  responsavelAtual?: string;
  localizacaoAtual: string;
  observacoes?: string;
  tipoPropriedade?: string;
  termoVistoriaId?: number;
  dataAluguel?: string;
  dataEntrega?: string;
  criadoEm: string;
  atualizadoEm: string;
}

// Create form schema for Novo Veículo with conditional validation
const novoVeiculoSchema = z.object({
  placa: z.string().min(7, "Placa deve ter formato XXX-0000").max(8),
  marca: z.string().min(2, "Marca é obrigatória"),
  modelo: z.string().min(2, "Modelo é obrigatório"),
  ano: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  tipo: z.enum(["carro", "caminhonete", "caminhao", "van", "moto"], { required_error: "Tipo é obrigatório" }),
  kmAtual: z.coerce.number().nonnegative({ message: "Quilometragem deve ser maior ou igual a zero" }),
  combustivel: z.enum(["gasolina", "etanol", "diesel", "flex"], { required_error: "Combustível é obrigatório" }),
  seguro: z.string().min(5, "Informações do seguro são obrigatórias"),
  proximaRevisao: z.date({ required_error: "Data da próxima revisão é obrigatória" }),
  localizacaoAtual: z.string().min(3, "Localização atual é obrigatória"),
  observacoes: z.string().optional(),
  empreendimentoId: z.number().int().positive().optional(),
  tipoPropriedade: z.enum(["proprio", "alugado"], { required_error: "Tipo de propriedade é obrigatório" }),
  termoVistoriaId: z.number().int().positive().optional(),
  dataAluguel: z.date().optional(),
  dataEntrega: z.date().optional(),
}).refine((data) => {
  if (data.tipoPropriedade === "alugado") {
    return data.dataAluguel != null;
  }
  return true;
}, {
  message: "Data de aluguel é obrigatória para veículos alugados",
  path: ["dataAluguel"],
}).refine((data) => {
  if (data.tipoPropriedade === "alugado") {
    return data.dataEntrega != null;
  }
  return true;
}, {
  message: "Data de entrega é obrigatória para veículos alugados",
  path: ["dataEntrega"],
});

type NovoVeiculoFormData = z.infer<typeof novoVeiculoSchema>;

// Novo Veículo Form Component
interface NovoVeiculoFormProps {
  onSuccess: () => void;
  veiculo?: Veiculo | null;
}

function NovoVeiculoForm({ onSuccess, veiculo }: NovoVeiculoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!veiculo;

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["/api/empreendimentos"],
  });

  const form = useForm<NovoVeiculoFormData>({
    resolver: zodResolver(novoVeiculoSchema),
    defaultValues: veiculo ? {
      placa: veiculo.placa,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano: veiculo.ano,
      tipo: veiculo.tipo as any,
      kmAtual: veiculo.kmAtual,
      combustivel: veiculo.combustivel as unknown,
      seguro: veiculo.seguro,
      localizacaoAtual: veiculo.localizacaoAtual,
      proximaRevisao: new Date(veiculo.proximaRevisao),
      observacoes: veiculo.observacoes || "",
      tipoPropriedade: (veiculo.tipoPropriedade as any) || "proprio",
      termoVistoriaId: veiculo.termoVistoriaId,
      dataAluguel: veiculo.dataAluguel ? new Date(veiculo.dataAluguel) : undefined,
      dataEntrega: veiculo.dataEntrega ? new Date(veiculo.dataEntrega) : undefined,
    } : {
      placa: "",
      marca: "",
      modelo: "",
      ano: new Date().getFullYear(),
      tipo: "carro",
      kmAtual: 0,
      combustivel: "flex",
      seguro: "",
      localizacaoAtual: "Garagem Principal",
      observacoes: "",
      tipoPropriedade: "proprio",
      dataAluguel: undefined,
      dataEntrega: undefined,
      termoVistoriaId: undefined,
    },
  });

  const createVeiculoMutation = useMutation({
    mutationFn: async (data: NovoVeiculoFormData) => {
      return apiRequest("POST", "/api/frota", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota"] });
      toast({
        title: "Veículo cadastrado",
        description: "Novo veículo foi adicionado à frota com sucesso!",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar o veículo. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao cadastrar veículo:", error);
    },
  });

  const updateVeiculoMutation = useMutation({
    mutationFn: async (data: NovoVeiculoFormData) => {
      return apiRequest("PUT", `/api/frota/${veiculo?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota"] });
      toast({
        title: "Veículo atualizado",
        description: "Veículo foi atualizado com sucesso!",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o veículo. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao atualizar veículo:", error);
    },
  });

  const onSubmit = (data: NovoVeiculoFormData) => {
    if (isEditing) {
      updateVeiculoMutation.mutate(data);
    } else {
      createVeiculoMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="placa"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Placa *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="ABC-1234"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    data-testid="input-placa"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="marca"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Toyota, Ford, Volkswagen"
                    {...field}
                    data-testid="input-marca"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="modelo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Hilux, Ranger, Amarok"
                    {...field}
                    data-testid="input-modelo"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ano"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2020"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                    data-testid="input-ano"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Veículo *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TIPO_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="w-4 h-4" />
                          {config.label}
                        </div>
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
            name="combustivel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Combustível *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-combustivel">
                      <SelectValue placeholder="Selecione o combustível" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="etanol">Etanol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="flex">Flex (Gasolina/Etanol)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="kmAtual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quilometragem Atual *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="50000"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                    data-testid="input-km"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="localizacaoAtual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localização Atual *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Garagem Principal, Campo - UHE Garibaldi"
                    {...field}
                    data-testid="input-localizacao"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="seguro"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Informações do Seguro *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Porto Seguro - Apólice 123456 - Vence em 12/2025"
                  {...field}
                  data-testid="input-seguro"
                />
              </FormControl>
              <FormDescription>
                Inclua seguradora, número da apólice e data de vencimento
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="proximaRevisao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Próxima Revisão *</FormLabel>
              <FormControl>
                <DateInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="DD/MM/AAAA"
                  data-testid="input-revisao"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="empreendimentoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Empreendimento</FormLabel>
              <Select
                onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))}
                value={field.value?.toString() || "none"}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-empreendimento">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {empreendimentos.map((e: any) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipoPropriedade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Propriedade *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-propriedade">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="proprio">Próprio</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Se o veículo é próprio da empresa ou alugado
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("tipoPropriedade") === "alugado" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dataAluguel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Aluguel *</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="DD/MM/AAAA"
                        data-testid="input-data-aluguel"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataEntrega"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Entrega Prevista *</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="DD/MM/AAAA"
                        data-testid="input-data-entrega"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormItem>
              <FormLabel>Termo de Vistoria (PDF)</FormLabel>
              <FormDescription>
                Upload do termo de vistoria assinado do veículo alugado
              </FormDescription>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Upload será implementado em breve"
                  disabled
                  data-testid="input-termo-vistoria"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </>
        )}

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações sobre o veículo, histórico, etc..."
                  className="min-h-[60px] resize-none"
                  {...field}
                  data-testid="textarea-observacoes"
                />
              </FormControl>
              <FormDescription>
                Informações adicionais sobre o veículo
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            data-testid="button-cancelar"
          >
            Limpar
          </Button>
          <Button
            type="submit"
            disabled={createVeiculoMutation.isPending || updateVeiculoMutation.isPending}
            data-testid="button-salvar"
          >
            {(createVeiculoMutation.isPending || updateVeiculoMutation.isPending) ? (
              <>
                <Settings className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              isEditing ? "Atualizar Veículo" : "Cadastrar Veículo"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Document interface
interface Documento {
  id: number;
  nome: string;
  descricao?: string;
  arquivoUrl: string;
  arquivoNome: string;
  arquivoTipo: string;
  arquivoTamanho: number;
  categoria: string;
  criadoEm: string;
}

// Document categories for vehicles
const DOCUMENTO_CATEGORIAS = [
  { value: "apolice_seguro", label: "Apólice de Seguro", icon: Shield },
  { value: "crlv", label: "CRLV (Licenciamento Anual)", icon: FileCheck },
  { value: "ipva", label: "Comprovante IPVA", icon: FileText },
  { value: "contrato_aluguel", label: "Contrato de Aluguel", icon: FileText },
  { value: "termo_vistoria", label: "Termo de Vistoria", icon: FileText },
  { value: "laudo_tecnico", label: "Laudo Técnico", icon: FileText },
  { value: "outro", label: "Outro Documento", icon: FileText },
];

// Vehicle Documents Component
interface VeiculoDocumentosProps {
  veiculoId: number;
}

function VeiculoDocumentos({ veiculoId }: VeiculoDocumentosProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docNome, setDocNome] = useState("");
  const [docCategoria, setDocCategoria] = useState("");
  const [docDescricao, setDocDescricao] = useState("");

  const { data: documentos = [], isLoading } = useQuery<Documento[]>({
    queryKey: ["/api/frota", veiculoId, "documentos"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequestFormData("POST", `/api/frota/${veiculoId}/documentos`, formData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota", veiculoId, "documentos"] });
      toast({ title: "Documento enviado", description: "Documento foi salvo com sucesso!" });
      setSelectedFile(null);
      setDocNome("");
      setDocCategoria("");
      setDocDescricao("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/frota/${veiculoId}/documentos/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota", veiculoId, "documentos"] });
      toast({ title: "Documento excluído", description: "Documento foi removido com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!docNome) {
        setDocNome(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !docNome || !docCategoria) {
      toast({ title: "Atenção", description: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", selectedFile);
    formData.append("nome", docNome);
    formData.append("categoria", docCategoria);
    formData.append("descricao", docDescricao);

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoriaLabel = (categoria: string) => {
    return DOCUMENTO_CATEGORIAS.find(c => c.value === categoria)?.label || categoria;
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Enviar Novo Documento
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Arquivo *</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selecionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={docCategoria} onValueChange={setDocCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENTO_CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-4 w-4" />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do Documento *</Label>
            <Input
              value={docNome}
              onChange={(e) => setDocNome(e.target.value)}
              placeholder="Ex: Apólice Seguro 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={docDescricao}
              onChange={(e) => setDocDescricao(e.target.value)}
              placeholder="Informações adicionais..."
            />
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploadMutation.isPending || !selectedFile || !docNome || !docCategoria}
          className="w-full"
        >
          {uploadMutation.isPending ? (
            <>
              <Settings className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar Documento
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos do Veículo ({documentos.length})
        </h4>

        {isLoading ? (
          <div className="text-center py-4">
            <Settings className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : documentos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum documento cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{doc.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{getCategoriaLabel(doc.categoria)}</Badge>
                      <span>{formatFileSize(doc.arquivoTamanho)}</span>
                      <span>{format(new Date(doc.criadoEm), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={doc.arquivoUrl} target="_blank" rel="noopener noreferrer" title="Abrir documento">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    title="Excluir documento"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Vehicle Card Component
interface VehicleCardProps {
  veiculo: Veiculo;
  onEdit: (veiculo: Veiculo) => void;
  onView: (veiculo: Veiculo) => void;
  onDelete: (veiculo: Veiculo) => void;
  onStatusChange: (veiculo: Veiculo, status: string) => void;
}

function VehicleCard({ veiculo, onEdit, onView, onDelete, onStatusChange }: VehicleCardProps) {
  const statusConfig = STATUS_CONFIG[veiculo.status];
  const tipoConfig = TIPO_CONFIG[veiculo.tipo as keyof typeof TIPO_CONFIG];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {tipoConfig && <tipoConfig.icon className="h-5 w-5 text-muted-foreground" />}
            <CardTitle className="text-lg font-semibold">
              {veiculo.placa}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Clique para alterar o status"
                className={`${statusConfig.color} text-white cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity select-none inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border border-transparent`}
              >
                <statusConfig.icon className="w-3 h-3" />
                {statusConfig.label}
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Alterar status</p>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onStatusChange(veiculo, key)}
                  className={veiculo.status === key ? "font-semibold bg-muted" : ""}
                >
                  <cfg.icon className="w-4 h-4 mr-2" />
                  {cfg.label}
                  {veiculo.status === key && <span className="ml-auto text-xs text-muted-foreground">atual</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          {veiculo.marca} {veiculo.modelo} ({veiculo.ano})
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2 text-sm">
          <Fuel className="h-4 w-4 text-muted-foreground" />
          <span className="capitalize">{veiculo.combustivel}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span>{veiculo.kmAtual.toLocaleString('pt-BR')} km</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{veiculo.localizacaoAtual}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>Revisão: {format(new Date(veiculo.proximaRevisao), "dd/MM/yyyy")}</span>
        </div>

        {veiculo.responsavelAtual && (
          <div className="flex items-center space-x-2 text-sm">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span>Com: {veiculo.responsavelAtual}</span>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(veiculo)}
            data-testid={`button-view-${veiculo.id}`}
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(veiculo)}
            data-testid={`button-edit-${veiculo.id}`}
          >
            <Edit className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(veiculo)}
            data-testid={`button-delete-${veiculo.id}`}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Deletar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FrotaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    tipo: "",
    status: "",
    combustivel: "",
    search: ""
  });

  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [veiculoToDelete, setVeiculoToDelete] = useState<Veiculo | null>(null);

  // Fetch veículos from API
  const { data: veiculos = [], isLoading } = useQuery<Veiculo[]>({
    queryKey: ["/api/frota"],
  });

  // Fetch stats from API
  const { data: stats = { total: 0, disponivel: 0, em_uso: 0, manutencao: 0, indisponivel: 0 } } = useQuery({
    queryKey: ["/api/frota/stats"],
  });

  // Delete mutation
  const deleteVeiculoMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/frota/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota"] });
      queryClient.invalidateQueries({ queryKey: ["/api/frota/stats"] });
      toast({
        title: "Veículo deletado",
        description: "Veículo foi removido da frota com sucesso!",
      });
      setVeiculoToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível deletar o veículo. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao deletar veículo:", error);
    },
  });

  // Filter vehicles based on current filters
  const filteredVeiculos = veiculos.filter(veiculo => {
    if (filters.tipo && filters.tipo !== "todos" && veiculo.tipo !== filters.tipo) return false;
    if (filters.status && filters.status !== "todos" && veiculo.status !== filters.status) return false;
    if (filters.combustivel && filters.combustivel !== "todos" && veiculo.combustivel !== filters.combustivel) return false;
    if (filters.search && !veiculo.placa.toLowerCase().includes(filters.search.toLowerCase()) && 
        !veiculo.marca.toLowerCase().includes(filters.search.toLowerCase()) &&
        !veiculo.modelo.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handleEditVeiculo = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsEditFormOpen(true);
  };

  const handleViewVeiculo = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsViewOpen(true);
  };

  const handleDeleteVeiculo = (veiculo: Veiculo) => {
    setVeiculoToDelete(veiculo);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/frota/${id}/status`, { status }),
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/frota"] });
      queryClient.invalidateQueries({ queryKey: ["/api/frota/stats"] });
      const label = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label ?? status;
      toast({ title: `Status atualizado para "${label}".` });
    },
    onError: () => {
      toast({ title: "Falha ao atualizar status", variant: "destructive" });
    },
  });

  const handleStatusChange = (veiculo: Veiculo, status: string) => {
    if (veiculo.status !== status) {
      statusMutation.mutate({ id: veiculo.id, status });
    }
  };

  const confirmDelete = () => {
    if (veiculoToDelete) {
      deleteVeiculoMutation.mutate(veiculoToDelete.id);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setIsEditFormOpen(false);
    setSelectedVeiculo(null);
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-frota">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestão de Frota
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie veículos, manutenções e agendamentos da frota
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-novo-veiculo">
                <Plus className="mr-2 h-4 w-4" />
                Novo Veículo
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
            </DialogHeader>
            <NovoVeiculoForm onSuccess={handleFormSuccess} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disponivel}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Uso</CardTitle>
            <Car className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.em_uso}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manutenção</CardTitle>
            <Wrench className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manutencao}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indisponíveis</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.indisponivel}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Placa, marca ou modelo..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={filters.tipo} onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {Object.entries(TIPO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="combustivel">Combustível</Label>
              <Select value={filters.combustivel} onValueChange={(value) => setFilters(prev => ({ ...prev, combustivel: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os combustíveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-spin" />
            <p className="text-muted-foreground">Carregando veículos...</p>
          </div>
        ) : (
          filteredVeiculos.map((veiculo) => (
            <VehicleCard
              key={veiculo.id}
              veiculo={veiculo}
              onEdit={handleEditVeiculo}
              onView={handleViewVeiculo}
              onDelete={handleDeleteVeiculo}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {!isLoading && filteredVeiculos.length === 0 && (
        <div className="text-center py-12">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Nenhum veículo encontrado
          </h3>
          <p className="text-sm text-muted-foreground">
            Ajuste os filtros ou cadastre um novo veículo
          </p>
        </div>
      )}

      {/* Edit Vehicle Dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
          </DialogHeader>
          <NovoVeiculoForm veiculo={selectedVeiculo} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!veiculoToDelete} onOpenChange={(open) => !deleteVeiculoMutation.isPending && !open && setVeiculoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o veículo <strong>{veiculoToDelete?.placa}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVeiculoMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteVeiculoMutation.isPending}
            >
              {deleteVeiculoMutation.isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Vehicle Dialog with Documents */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {selectedVeiculo?.placa} - {selectedVeiculo?.marca} {selectedVeiculo?.modelo}
            </DialogTitle>
          </DialogHeader>
          
          {selectedVeiculo && (
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados">Dados do Veículo</TabsTrigger>
                <TabsTrigger value="documentos">
                  <FileText className="h-4 w-4 mr-2" />
                  Documentos
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Placa</Label>
                    <p className="font-medium">{selectedVeiculo.placa}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Marca/Modelo</Label>
                    <p className="font-medium">{selectedVeiculo.marca} {selectedVeiculo.modelo}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Ano</Label>
                    <p className="font-medium">{selectedVeiculo.ano}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="font-medium capitalize">{TIPO_CONFIG[selectedVeiculo.tipo as keyof typeof TIPO_CONFIG].label || selectedVeiculo.tipo}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Combustível</Label>
                    <p className="font-medium capitalize">{selectedVeiculo.combustivel}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={`${STATUS_CONFIG[selectedVeiculo.status]?.color} text-white`}>
                      {STATUS_CONFIG[selectedVeiculo.status]?.label}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Quilometragem</Label>
                    <p className="font-medium">{selectedVeiculo.kmAtual.toLocaleString('pt-BR')} km</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Localização</Label>
                    <p className="font-medium">{selectedVeiculo.localizacaoAtual}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Próxima Revisão</Label>
                    <p className="font-medium">{format(new Date(selectedVeiculo.proximaRevisao), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-3">
                    <Label className="text-muted-foreground">Seguro</Label>
                    <p className="font-medium">{selectedVeiculo.seguro}</p>
                  </div>
                  {selectedVeiculo.tipoPropriedade === "alugado" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Tipo de Propriedade</Label>
                        <Badge variant="secondary">Alugado</Badge>
                      </div>
                      {selectedVeiculo.dataAluguel && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground">Data de Aluguel</Label>
                          <p className="font-medium">{format(new Date(selectedVeiculo.dataAluguel), "dd/MM/yyyy")}</p>
                        </div>
                      )}
                      {selectedVeiculo.dataEntrega && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground">Data de Entrega</Label>
                          <p className="font-medium">{format(new Date(selectedVeiculo.dataEntrega), "dd/MM/yyyy")}</p>
                        </div>
                      )}
                    </>
                  )}
                  {selectedVeiculo.observacoes && (
                    <div className="space-y-1 col-span-2 md:col-span-3">
                      <Label className="text-muted-foreground">Observações</Label>
                      <p className="text-sm">{selectedVeiculo.observacoes}</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="documentos" className="mt-4">
                <VeiculoDocumentos veiculoId={selectedVeiculo.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}