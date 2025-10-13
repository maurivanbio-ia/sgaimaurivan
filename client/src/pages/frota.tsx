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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
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
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
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
  criadoEm: string;
  atualizadoEm: string;
}

// Create form schema for Novo Veículo
const novoVeiculoSchema = z.object({
  placa: z.string().min(7, "Placa deve ter formato XXX-0000").max(8),
  marca: z.string().min(2, "Marca é obrigatória"),
  modelo: z.string().min(2, "Modelo é obrigatório"),
  ano: z.number().min(1990).max(new Date().getFullYear() + 1),
  tipo: z.enum(["carro", "caminhonete", "caminhao", "van", "moto"], { required_error: "Tipo é obrigatório" }),
  kmAtual: z.number().min(0, "Quilometragem deve ser maior ou igual a zero"),
  combustivel: z.enum(["gasolina", "etanol", "diesel", "flex"], { required_error: "Combustível é obrigatório" }),
  seguro: z.string().min(5, "Informações do seguro são obrigatórias"),
  proximaRevisao: z.date({ required_error: "Data da próxima revisão é obrigatória" }),
  localizacaoAtual: z.string().min(3, "Localização atual é obrigatória"),
  observacoes: z.string().optional(),
});

type NovoVeiculoFormData = z.infer<typeof novoVeiculoSchema>;

// Novo Veículo Form Component
interface NovoVeiculoFormProps {
  onSuccess: () => void;
}

function NovoVeiculoForm({ onSuccess }: NovoVeiculoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NovoVeiculoFormData>({
    resolver: zodResolver(novoVeiculoSchema),
    defaultValues: {
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
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar o veículo. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao cadastrar veículo:", error);
    },
  });

  const onSubmit = (data: NovoVeiculoFormData) => {
    createVeiculoMutation.mutate(data);
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
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      data-testid="button-revisao"
                    >
                      {field.value ? (
                        format(field.value, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data da próxima revisão</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
            disabled={createVeiculoMutation.isPending}
            data-testid="button-salvar"
          >
            {createVeiculoMutation.isPending ? (
              <>
                <Settings className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Cadastrar Veículo"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Vehicle Card Component
interface VehicleCardProps {
  veiculo: Veiculo;
  onEdit: (veiculo: Veiculo) => void;
  onView: (veiculo: Veiculo) => void;
}

function VehicleCard({ veiculo, onEdit, onView }: VehicleCardProps) {
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
          <Badge className={`${statusConfig.color} text-white`}>
            <statusConfig.icon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
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
        </div>
      </CardContent>
    </Card>
  );
}

export default function FrotaPage() {
  const [filters, setFilters] = useState({
    tipo: "",
    status: "",
    combustivel: "",
    search: ""
  });

  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Mock data - será substituído pela API real posteriormente
  const mockVeiculos: Veiculo[] = [
    {
      id: 1,
      placa: "ABC-1234",
      marca: "Toyota",
      modelo: "Hilux",
      ano: 2022,
      tipo: "caminhonete",
      status: "disponivel",
      kmAtual: 25000,
      combustivel: "diesel",
      seguro: "Porto Seguro - Apólice 987654 - Vence 03/2025",
      proximaRevisao: "2025-10-15",
      localizacaoAtual: "Garagem Principal",
      observacoes: "Veículo em excelente estado",
      criadoEm: "2024-01-15T10:00:00.000Z",
      atualizadoEm: "2024-01-15T10:00:00.000Z"
    },
    {
      id: 2,
      placa: "DEF-5678",
      marca: "Ford",
      modelo: "Ranger",
      ano: 2021,
      tipo: "caminhonete",
      status: "em_uso",
      kmAtual: 45000,
      combustivel: "diesel",
      seguro: "Bradesco Seguros - Apólice 123789 - Vence 06/2025",
      proximaRevisao: "2025-09-20",
      responsavelAtual: "João Silva",
      localizacaoAtual: "Campo - UHE Garibaldi",
      observacoes: "Pneu traseiro direito trocado recentemente",
      criadoEm: "2024-02-10T14:30:00.000Z",
      atualizadoEm: "2024-02-10T14:30:00.000Z"
    },
    {
      id: 3,
      placa: "GHI-9012",
      marca: "Volkswagen",
      modelo: "Amarok",
      ano: 2020,
      tipo: "caminhonete",
      status: "manutencao",
      kmAtual: 78000,
      combustivel: "diesel",
      seguro: "Allianz - Apólice 456123 - Vence 12/2024",
      proximaRevisao: "2025-08-30",
      localizacaoAtual: "Oficina Mecânica Central",
      observacoes: "Troca de embreagem em andamento",
      criadoEm: "2023-11-20T09:15:00.000Z",
      atualizadoEm: "2023-11-20T09:15:00.000Z"
    }
  ];

  // Filter vehicles based on current filters
  const filteredVeiculos = mockVeiculos.filter(veiculo => {
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
    // TODO: Open edit form dialog
    console.log("Edit veiculo:", veiculo);
  };

  const handleViewVeiculo = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    // TODO: Open view details dialog
    console.log("View veiculo:", veiculo);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
  };

  // Calculate statistics
  const stats = {
    total: mockVeiculos.length,
    disponivel: mockVeiculos.filter(v => v.status === 'disponivel').length,
    em_uso: mockVeiculos.filter(v => v.status === 'em_uso').length,
    manutencao: mockVeiculos.filter(v => v.status === 'manutencao').length,
    indisponivel: mockVeiculos.filter(v => v.status === 'indisponivel').length,
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
        {filteredVeiculos.map((veiculo) => (
          <VehicleCard
            key={veiculo.id}
            veiculo={veiculo}
            onEdit={handleEditVeiculo}
            onView={handleViewVeiculo}
          />
        ))}
      </div>

      {filteredVeiculos.length === 0 && (
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
    </div>
  );
}